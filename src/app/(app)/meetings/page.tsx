import Link from "next/link";
import { Calendar } from "lucide-react";
import { and, asc, count, desc, eq, gte, lt } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { agendaItems, attendances, meetings, resolutions } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { MEETING_STATUS_LABELS } from "@/lib/enums";

async function withCounts(rows: Array<typeof meetings.$inferSelect>) {
  return Promise.all(
    rows.map(async (m) => {
      const [a, t, r] = await Promise.all([
        db.select({ c: count() }).from(agendaItems).where(eq(agendaItems.meetingId, m.id)),
        db.select({ c: count() }).from(attendances).where(eq(attendances.meetingId, m.id)),
        db.select({ c: count() }).from(resolutions).where(eq(resolutions.meetingId, m.id)),
      ]);
      return {
        ...m,
        agendaCount: a[0]?.c ?? 0,
        attendanceCount: t[0]?.c ?? 0,
        resolutionCount: r[0]?.c ?? 0,
      };
    })
  );
}

export default async function MeetingsPage() {
  const { membership } = await requireMembership();
  const orgId = membership.organizationId;
  const now = new Date();

  const [upcomingRows, pastRows] = await Promise.all([
    db
      .select()
      .from(meetings)
      .where(and(eq(meetings.organizationId, orgId), gte(meetings.scheduledAt, now)))
      .orderBy(asc(meetings.scheduledAt)),
    db
      .select()
      .from(meetings)
      .where(and(eq(meetings.organizationId, orgId), lt(meetings.scheduledAt, now)))
      .orderBy(desc(meetings.scheduledAt))
      .limit(20),
  ]);

  const [upcoming, past] = await Promise.all([withCounts(upcomingRows), withCounts(pastRows)]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meetings</h1>
          <p className="text-muted-foreground">Schedule, run, and archive your board meetings.</p>
        </div>
        <Button asChild>
          <Link href="/meetings/new">Schedule meeting</Link>
        </Button>
      </div>

      <Section title="Upcoming" empty="Nothing scheduled yet." meetings={upcoming} />
      <Section title="Past meetings" empty="No past meetings." meetings={past} />
    </div>
  );
}

function Section({
  title,
  empty,
  meetings,
}: {
  title: string;
  empty: string;
  meetings: Array<{
    id: string;
    title: string;
    scheduledAt: Date;
    status: string;
    type: string;
    agendaCount: number;
    attendanceCount: number;
    resolutionCount: number;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {meetings.length} meeting{meetings.length === 1 ? "" : "s"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y">
            {meetings.map((m) => (
              <li key={m.id} className="py-3">
                <Link
                  href={`/meetings/${m.id}`}
                  className="flex items-center justify-between gap-4 rounded-md px-2 py-2 hover:bg-accent"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 rounded-md border bg-background p-2">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium">{m.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(m.scheduledAt)} · {m.agendaCount} agenda · {m.attendanceCount} invited ·{" "}
                        {m.resolutionCount} resolutions
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={m.status === "COMPLETED" ? "success" : m.status === "DRAFT" ? "secondary" : "default"}
                  >
                    {MEETING_STATUS_LABELS[m.status as keyof typeof MEETING_STATUS_LABELS] ?? m.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
