import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { deleteThread } from "@/lib/actions/chat";
import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, membership } = await requireMembership();

  const tRows = await db
    .select()
    .from(chatThreads)
    .where(
      and(
        eq(chatThreads.id, id),
        eq(chatThreads.organizationId, membership.organizationId),
        eq(chatThreads.userId, user.id)
      )
    )
    .limit(1);
  const thread = tRows[0];
  if (!thread) notFound();

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.threadId, thread.id))
    .orderBy(asc(chatMessages.createdAt));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/chat">
              <ArrowLeft className="mr-1 h-4 w-4" />
              All conversations
            </Link>
          </Button>
        </div>
        <form action={deleteThread}>
          <input type="hidden" name="id" value={thread.id} />
          <Button type="submit" variant="ghost" size="sm">
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
        </form>
      </div>

      <h1 className="text-xl font-semibold">{thread.title}</h1>

      <ChatClient
        threadId={thread.id}
        initialMessages={messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        }))}
        orgName={membership.organization.name}
      />
    </div>
  );
}
