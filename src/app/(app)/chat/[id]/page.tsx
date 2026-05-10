import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { deleteThread, sendChatMessage } from "@/lib/actions/chat";
import { formatDate } from "@/lib/utils";

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

      <div className="space-y-4">
        {messages.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Ask anything about {membership.organization.name}&apos;s board pack, finances, or recent meetings.
            </CardContent>
          </Card>
        ) : (
          messages.map((m) => (
            <Card key={m.id} className={m.role === "user" ? "ml-12 bg-primary/5" : "mr-12"}>
              <CardContent className="py-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {m.role === "user" ? "You" : "Claude"} · {formatDate(m.createdAt)}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="sticky bottom-4">
        <CardContent className="py-4">
          <form action={sendChatMessage} className="space-y-2">
            <input type="hidden" name="threadId" value={thread.id} />
            <Textarea
              name="message"
              required
              rows={3}
              placeholder="Ask a question about this company…"
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Claude has read access to this org&apos;s data only — no cross-portfolio leakage.
              </p>
              <Button type="submit">Send</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
