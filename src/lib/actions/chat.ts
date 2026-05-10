"use server";
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { buildOrgContext } from "@/lib/chat-context";

const SYSTEM_PREAMBLE = `You are Quorum's AI assistant for a startup's leadership team. You have read access to the company's board meetings, resolutions, action items, financial snapshots and forward-looking plans, and published board reports. Answer questions about this content directly and concisely. When you reference data, cite the meeting title, period, or document by name. If the user asks about something not in the context, say so plainly rather than guessing.`;

export async function createThread() {
  const { user, membership } = await requireMembership();
  const [t] = await db
    .insert(chatThreads)
    .values({
      organizationId: membership.organizationId,
      userId: user.id,
      title: "New conversation",
    })
    .returning();
  redirect(`/chat/${t.id}`);
}

export async function deleteThread(formData: FormData) {
  const { user, membership } = await requireMembership();
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.id, id), eq(chatThreads.organizationId, membership.organizationId), eq(chatThreads.userId, user.id)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.delete(chatThreads).where(eq(chatThreads.id, id));
  revalidatePath("/chat");
  redirect("/chat");
}

export async function sendChatMessage(formData: FormData) {
  const { user, membership } = await requireMembership();
  const threadId = String(formData.get("threadId"));
  const userMessage = String(formData.get("message") ?? "").trim();
  if (!userMessage) return;

  const tRows = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.organizationId, membership.organizationId), eq(chatThreads.userId, user.id)))
    .limit(1);
  const thread = tRows[0];
  if (!thread) throw new Error("Thread not found");

  // Save the user's message
  await db.insert(chatMessages).values({ threadId: thread.id, role: "user", content: userMessage });

  // If this is the first user message, set the thread title to a snippet
  if (thread.title === "New conversation") {
    const title = userMessage.slice(0, 60) + (userMessage.length > 60 ? "…" : "");
    await db.update(chatThreads).set({ title, updatedAt: new Date() }).where(eq(chatThreads.id, thread.id));
  } else {
    await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, thread.id));
  }

  // Build context + history
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await db.insert(chatMessages).values({
      threadId: thread.id,
      role: "assistant",
      content:
        "⚠️ Claude API key not configured. Set the `ANTHROPIC_API_KEY` environment variable in `.env` and restart the server to enable AI chat. The rest of Quorum works without it.",
    });
    revalidatePath(`/chat/${thread.id}`);
    return;
  }

  const [orgContext, history] = await Promise.all([
    buildOrgContext(membership.organizationId),
    db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, thread.id))
      .orderBy(asc(chatMessages.createdAt)),
  ]);

  // Convert history to Anthropic message format. Drop the just-saved user msg
  // since we'll include it as the final user turn separately… actually no, we
  // include it because it IS the latest. Just send everything in order.
  const apiMessages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));

  const client = new Anthropic({ apiKey });

  let assistantText = "";
  try {
    // System prompt is broken into a stable preamble + a (large, cacheable)
    // org context block. The cache_control on the org block lets follow-up
    // turns in this thread re-use ~90% of the input tokens at ~10% price.
    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [
        { type: "text", text: SYSTEM_PREAMBLE },
        {
          type: "text",
          text: orgContext,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: apiMessages,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        assistantText += event.delta.text;
      }
    }

    const finalMessage = await stream.finalMessage();
    void finalMessage;
  } catch (err) {
    console.error("Claude API error:", err);
    if (err instanceof Anthropic.AuthenticationError) {
      assistantText = "⚠️ Claude API authentication failed. Check that `ANTHROPIC_API_KEY` is valid.";
    } else if (err instanceof Anthropic.RateLimitError) {
      assistantText = "⚠️ Rate limited. Wait a moment and try again.";
    } else if (err instanceof Anthropic.APIError) {
      assistantText = `⚠️ Claude API error (${err.status}): ${err.message}`;
    } else {
      assistantText = `⚠️ Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  await db.insert(chatMessages).values({
    threadId: thread.id,
    role: "assistant",
    content: assistantText,
  });

  revalidatePath(`/chat/${thread.id}`);
}

export async function listMyThreads(userId: string, organizationId: string) {
  return db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.userId, userId), eq(chatThreads.organizationId, organizationId)))
    .orderBy(desc(chatThreads.updatedAt));
}
