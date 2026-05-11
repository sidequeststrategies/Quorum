import Link from "next/link";
import { Calendar, CheckSquare, FileText, Vote } from "lucide-react";
import { and, asc, count, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import {
  actionItems,
  agendaItems,
  attendances,
  meetings,
  memberships,
  resolutions,
  users,
  votes,
} from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { formatDate, formatDateOnly } from "@/lib/utils";
import { MEETING_STATUS_LABELS } from "@/lib/enums";

export default async function DashboardPage() {
  const { membership } = await requireMembership();
  const orgId = membership.organizationId;

  const now = new Date();

  const [upcomingRows, openResolutions, openActionItems, memberCountRow] = await Promise.all([
    db
      .select({
        id: meetings.id,
        title: meetings.title,
        scheduledAt: meetings.scheduledAt,
        status: meetings.status,
      })
      .from(meetings)
      .where(and(eq(meetings.organizationId, orgId), gte(meetings.scheduledAt, now), ne(meetings.status, "CANCELLED")))
      .orderBy(asc(meetings.scheduledAt))
      .limit(3),
    db
      .select()
      .from(resolutions)
      .where(and(eq(resolutions.organizationId, orgId), eq(resolutions.status, "OPEN")))
      .orderBy(desc(resolutions.openedAt))
      .limit(5),
    db
      .select({
        id: actionItems.id,
        title: actionItems.title,
        dueDate: actionItems.dueDate,
        status: actionItems.status,
        assigneeName: users.name,
        assigneeEmail: users.email,
      })
      .from(actionItems)
      .leftJoin(users, eq(actionItems.assigneeId, users.id))
      .where(and(eq(actionItems.organizationId, orgId), inArray(actionItems.status, ["OPEN", "IN_PROGRESS"])))
      .orderBy(asc(actionItems.dueDate))
      .limit(5),
    db.select({ c: count() }).from(memberships).where(eq(memberships.organizationId, orgId)),
  ]);

  const memberCount = memberCountRow[0]?.c ?? 0;

  // Resolve all per-meeting and per-resolution counts in 3 grouped queries
  // instead of (2 * meetings) + (1 * resolutions) point queries. On Turso the
  // round-trip savings are the dominant performance factor.
  const meetingIds = upcomingRows.map((m) => m.id);
  const resolutionIds = openResolutions.map((r) => r.id);
  const [agendaRows, attendanceRows, voteRows] = await Promise.all([
    meetingIds.length
      ? db
          .select({ meetingId: agendaItems.meetingId, c: count() })
          .from(agendaItems)
          .where(inArray(agendaItems.meetingId, meetingIds))
          .groupBy(agendaItems.meetingId)
      : Promise.resolve([]),
    meetingIds.length
      ? db
          .select({ meetingId: attendances.meetingId, c: count() })
          .from(attendances)
          .where(inArray(attendances.meetingId, meetingIds))
          .groupBy(attendances.meetingId)
      : Promise.resolve([]),
    resolutionIds.length
      ? db
          .select({ resolutionId: votes.resolutionId, c: count() })
          .from(votes)
          .where(inArray(votes.resolutionId, resolutionIds))
          .groupBy(votes.resolutionId)
      : Promise.resolve([]),
  ]);
  const agendaByMtg = new Map(agendaRows.map((r) => [r.meetingId, r.c]));
  const attendanceByMtg = new Map(attendanceRows.map((r) => [r.meetingId, r.c]));
  const votesByRes = new Map(voteRows.map((r) => [r.resolutionId, r.c]));

  const upcoming = upcomingRows.map((m) => ({
    ...m,
    agendaCount: agendaByMtg.get(m.id) ?? 0,
    attendanceCount: attendanceByMtg.get(m.id) ?? 0,
  }));
  const openWithCounts = openResolutions.map((r) => ({
    ...r,
    voteCount: votesByRes.get(r.id) ?? 0,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground">Here&apos;s what&apos;s on the board agenda.</p>
        </div>
        <Button asChild>
          <Link href="/meetings/new">Schedule meeting</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Members" value={memberCount} icon={<UsersIcon />} href="/members" />
        <StatCard label="Upcoming meetings" value={upcoming.length} icon={<Calendar className="h-4 w-4" />} href="/meetings" />
        <StatCard label="Open resolutions" value={openWithCounts.length} icon={<Vote className="h-4 w-4" />} href="/resolutions" />
        <StatCard label="Open action items" value={openActionItems.length} icon={<CheckSquare className="h-4 w-4" />} href="/action-items" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Upcoming meetings</CardTitle>
            <CardDescription>The next three on the calendar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing scheduled.{" "}
                <Link href="/meetings/new" className="font-medium text-primary hover:underline">
                  Schedule the first one
                </Link>
                .
              </p>
            ) : (
              upcoming.map((m) => (
                <Link
                  key={m.id}
                  href={`/meetings/${m.id}`}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-accent"
                >
                  <div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(m.scheduledAt)} · {m.agendaCount} agenda items · {m.attendanceCount} invited
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {MEETING_STATUS_LABELS[m.status as keyof typeof MEETING_STATUS_LABELS] ?? m.status}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open resolutions</CardTitle>
            <CardDescription>Awaiting your vote.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {openWithCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open votes right now.</p>
            ) : (
              openWithCounts.map((r) => (
                <Link
                  key={r.id}
                  href={`/resolutions/${r.id}`}
                  className="flex items-center justify-between rounded-md border p-3 hover:bg-accent"
                >
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.voteCount} vote{r.voteCount === 1 ? "" : "s"} cast · opened{" "}
                      {r.openedAt ? formatDateOnly(r.openedAt) : "—"}
                    </div>
                  </div>
                  <Badge>Open</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Open action items</CardTitle>
            <CardDescription>Follow-ups assigned across recent meetings.</CardDescription>
          </CardHeader>
          <CardContent>
            {openActionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing outstanding.</p>
            ) : (
              <ul className="divide-y">
                {openActionItems.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.assigneeName ?? a.assigneeEmail ?? "Unassigned"}
                        {a.dueDate ? ` · due ${formatDateOnly(a.dueDate)}` : ""}
                      </div>
                    </div>
                    <Badge variant={a.status === "IN_PROGRESS" ? "warning" : "secondary"}>
                      {a.status === "IN_PROGRESS" ? "In progress" : "Open"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, href }: { label: string; value: number; icon: React.ReactNode; href: string }) {
  return (
    <Link href={href}>
      <Card className="transition-colors hover:bg-accent/50">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{value}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

function UsersIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
