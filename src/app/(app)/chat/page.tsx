import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireMembership } from "@/lib/session";
import { createThread, listMyThreads } from "@/lib/actions/chat";
import { formatDate } from "@/lib/utils";

export default async function ChatHomePage() {
  const { user, membership } = await requireMembership();
  const threads = await listMyThreads(user.id, membership.organizationId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI assistant</h1>
          <p className="text-muted-foreground">
            Ask questions about {membership.organization.name}&apos;s meetings, financials, resolutions, and reports. Powered by Claude.
          </p>
        </div>
        <form action={createThread}>
          <Button type="submit">
            <Plus className="mr-1 h-4 w-4" />
            New conversation
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your conversations</CardTitle>
          <CardDescription>
            {threads.length} thread{threads.length === 1 ? "" : "s"} · scoped to {membership.organization.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {threads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No conversations yet. Start one — Claude can pull from this company&apos;s board pack, financial snapshots, and recent meetings.
            </p>
          ) : (
            <ul className="divide-y">
              {threads.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/chat/${t.id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-3 hover:bg-accent"
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-md border bg-background p-2">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{t.title}</div>
                        <div className="text-xs text-muted-foreground">Last activity {formatDate(t.updatedAt)}</div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-base">What you can ask</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• &quot;What was decided at our last board meeting?&quot;</li>
            <li>• &quot;What&apos;s our cash trajectory across the three scenarios?&quot;</li>
            <li>• &quot;Which action items are overdue?&quot;</li>
            <li>• &quot;Summarize the open resolutions and their vote tallies.&quot;</li>
            <li>• &quot;Compare this month&apos;s burn to three months ago.&quot;</li>
            <li>• &quot;Draft talking points for the upcoming board meeting based on our recent metrics.&quot;</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
