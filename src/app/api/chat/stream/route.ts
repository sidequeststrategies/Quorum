/**
 * Streaming chat endpoint.
 *
 * Why this exists separate from the `sendChatMessage` server action:
 *   - Server actions don't give the client a token-by-token stream.
 *   - For chat UIs the *perceived* latency is "time to first token", which
 *     is ~500ms with streaming vs ~5s blocking for a typical Sonnet response.
 *
 * Flow:
 *   1. POST { threadId, message }
 *   2. Validate caller has access to the thread (org membership scoping)
 *   3. Persist the user message
 *   4. Build the system prompt (with prompt caching on the org-context block)
 *   5. Stream Claude's response back as plain text chunks to the client
 *   6. After the stream closes, persist the full assistant message
 *
 * The response body is plain UTF-8 text (no SSE framing). Client just reads
 * `response.body` as a ReadableStream of bytes.
 */

import Anthropic from "@anthropic-ai/sdk";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { buildOrgContext } from "@/lib/chat-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM_PREAMBLE = `You are Quorum's AI assistant for a startup's leadership team. You have read access to the company's board meetings, resolutions, action items, financial snapshots and forward-looking plans, and published board reports. Answer questions about this content directly and concisely. When you reference data, cite the meeting title, period, or document by name. If the user asks about something not in the context, say so plainly rather than guessing.`;

export async function POST(req: Request) {
  const { user, membership } = await requireMembership();

  let payload: { threadId?: unknown; message?: unknown };
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const threadId = typeof payload.threadId === "string" ? payload.threadId : "";
  const userMessage = typeof payload.message === "string" ? payload.message.trim() : "";
  if (!threadId || !userMessage) {
    return new Response("Missing threadId or message", { status: 400 });
  }

  const tRows = await db
    .select()
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.id, threadId),
        eq(chatThreads.organizationId, membership.organizationId),
        eq(chatThreads.userId, user.id)
      )
    )
    .limit(1);
  const thread = tRows[0];
  if (!thread) return new Response("Thread not found", { status: 404 });

  // Persist the user message before we start the model call, so it's never
  // lost if the stream is interrupted.
  await db.insert(chatMessages).values({ threadId: thread.id, role: "user", content: userMessage });

  if (thread.title === "New conversation") {
    const title = userMessage.slice(0, 60) + (userMessage.length > 60 ? "…" : "");
    await db.update(chatThreads).set({ title, updatedAt: new Date() }).where(eq(chatThreads.id, thread.id));
  } else {
    await db.update(chatThreads).set({ updatedAt: new Date() }).where(eq(chatThreads.id, thread.id));
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const fallback =
      "⚠️ Claude API key not configured. Set the `ANTHROPIC_API_KEY` environment variable to enable AI chat.";
    await db.insert(chatMessages).values({ threadId: thread.id, role: "assistant", content: fallback });
    return new Response(fallback, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const [orgContext, history] = await Promise.all([
    buildOrgContext(membership.organizationId),
    db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, thread.id))
      .orderBy(asc(chatMessages.createdAt)),
  ]);

  const apiMessages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let assistantText = "";
      try {
        const sdkStream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: [
            { type: "text", text: SYSTEM_PREAMBLE },
            { type: "text", text: orgContext, cache_control: { type: "ephemeral" } },
          ],
          messages: apiMessages,
        });

        for await (const event of sdkStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const chunk = event.delta.text;
            assistantText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
        }
      } catch (err) {
        console.error("Claude stream error:", err);
        let msg: string;
        if (err instanceof Anthropic.AuthenticationError) {
          msg = "\n\n⚠️ Claude API authentication failed. Check that `ANTHROPIC_API_KEY` is valid.";
        } else if (err instanceof Anthropic.RateLimitError) {
          msg = "\n\n⚠️ Rate limited. Wait a moment and try again.";
        } else if (err instanceof Anthropic.APIError) {
          msg = `\n\n⚠️ Claude API error (${err.status}): ${err.message}`;
        } else {
          msg = `\n\n⚠️ Unexpected error: ${err instanceof Error ? err.message : String(err)}`;
        }
        assistantText += msg;
        controller.enqueue(encoder.encode(msg));
      } finally {
        // Persist whatever we got, even on partial failure.
        try {
          await db.insert(chatMessages).values({
            threadId: thread.id,
            role: "assistant",
            content: assistantText,
          });
        } catch (persistErr) {
          console.error("Failed to persist assistant message:", persistErr);
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no", // hint to disable buffering at proxies
    },
  });
}
