import Link from "next/link";
import { Calendar } from "lucide-react";
import { and, asc, count, desc, eq, gte, inArray, lt, isNotNull } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { agendaItems, attendances, meetings, resolutions } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { MEETING_STATUS_LABELS } from "@/lib/enums";

// Resolve agenda/attendance/resolution counts for many meetings in 3 grouped
// queries instead of 3×N point queries. Cuts Turso round-trips from ~3*meetings
// down to a constant 3.
async function countsByMeetingId(meetingIds: string[]) {
  if (meetingIds.length === 0) {
    return { agenda: new Map<string, number>(), attendance: new Map<string, number>(), resolution: new Map<string, number>() };
  }
  const [agendaRows, attendanceRows, resolutionRows] = await Promise.all([
    db
      .select({ meetingId: agendaItems.meetingId, c: count() })
      .from(agendaItems)
      .where(inArray(agendaItems.meetingId, meetingIds))
      .groupBy(agendaItems.meetingId),
    db
      .select({ meetingId: attendances.meetingId, c: count() })
      .from(attendances)
      .where(inArray(attendances.meetingId, meetingIds))
      .groupBy(attendances.meetingId),
    db
      .select({ meetingId: resolutions.meetingId, c: count() })
      .from(resolutions)
      .where(and(isNotNull(resolutions.meetingId), inArray(resolutions.meetingId, meetingIds)))
      .groupBy(resolutions.meetingId),
  ]);
  return {
    agenda: new Map(agendaRows.map((r) => [r.meetingId, r.c])),
    attendance: new Map(attendanceRows.map((r) => [r.meetingId, r.c])),
    resolution: new Map(resolutionRows.map((r) => [r.meetingId as string, r.c])),
  };
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

  const allIds = [...upcomingRows.map((m) => m.id), ...pastRows.map((m) => m.id)];
  const c = await countsByMeetingId(allIds);
  const annotate = (rows: typeof upcomingRows) =>
    rows.map((m) => ({
      ...m,
      agendaCount: c.agenda.get(m.id) ?? 0,
      attendanceCount: c.attendance.get(m.id) ?? 0,
      resolutionCount: c.resolution.get(m.id) ?? 0,
    }));
  const upcoming = annotate(upcomingRows);
  const past = annotate(pastRows);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Board meetings</h1>
          <p className="text-muted-foreground">
            The spine of the boardroom — every meeting carries its own pack of financials, projects, risks,
            customers, team, and GTM, with changes tracked meeting to meeting.
          </p>
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
                <div className="flex items-center justify-between gap-4 rounded-md px-2 py-2 hover:bg-accent">
                  <Link href={`/meetings/${m.id}/pack`} className="flex flex-1 items-start gap-3">
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
                  </Link>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/meetings/${m.id}`}>Logistics</Link>
                    </Button>
                    <Badge
                      variant={m.status === "COMPLETED" ? "success" : m.status === "DRAFT" ? "secondary" : "default"}
                    >
                      {MEETING_STATUS_LABELS[m.status as keyof typeof MEETING_STATUS_LABELS] ?? m.status}
                    </Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
