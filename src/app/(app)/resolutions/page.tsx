import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { meetings, resolutions, votes } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { formatDateOnly } from "@/lib/utils";
import { RESOLUTION_STATUS_LABELS } from "@/lib/enums";

export default async function ResolutionsPage() {
  const { membership } = await requireMembership();

  const rows = await db
    .select({
      id: resolutions.id,
      title: resolutions.title,
      kind: resolutions.kind,
      status: resolutions.status,
      openedAt: resolutions.openedAt,
      meetingTitle: meetings.title,
    })
    .from(resolutions)
    .leftJoin(meetings, eq(resolutions.meetingId, meetings.id))
    .where(eq(resolutions.organizationId, membership.organizationId))
    .orderBy(desc(resolutions.createdAt));

  const items = await Promise.all(
    rows.map(async (r) => {
      const [c] = await db
        .select({ c: sql<number>`count(*)` })
        .from(votes)
        .where(eq(votes.resolutionId, r.id));
      return { ...r, voteCount: Number(c?.c ?? 0) };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resolutions</h1>
          <p className="text-muted-foreground">Formal board decisions and unanimous written consents.</p>
        </div>
        {canManage(membership.role) ? (
          <Button asChild>
            <Link href="/resolutions/new">Propose resolution</Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All resolutions</CardTitle>
          <CardDescription>{items.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="divide-y">
              {items.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/resolutions/${r.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-3 hover:bg-accent"
                  >
                    <div>
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.kind === "WRITTEN_CONSENT" ? "Written consent" : "Meeting vote"}
                        {r.meetingTitle ? ` · ${r.meetingTitle}` : ""}
                        {" · "}
                        {r.voteCount} votes
                        {r.openedAt ? ` · opened ${formatDateOnly(r.openedAt)}` : ""}
                      </div>
                    </div>
                    <Badge
                      variant={
                        r.status === "PASSED"
                          ? "success"
                          : r.status === "FAILED"
                          ? "destructive"
                          : r.status === "OPEN"
                          ? "default"
                          : "secondary"
                      }
                    >
                      {RESOLUTION_STATUS_LABELS[r.status as keyof typeof RESOLUTION_STATUS_LABELS] ?? r.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
