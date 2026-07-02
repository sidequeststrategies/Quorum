import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Calendar, Clock, MapPin, Video, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/db";
import {
  agendaItems,
  attendances,
  documents,
  meetings,
  memberships,
  resolutions,
  users,
  votes,
} from "@/db/schema";
import { canManage, canVote, requireMembership } from "@/lib/session";
import { formatDate, initials } from "@/lib/utils";
import {
  ATTENDANCE_STATUSES,
  MEETING_STATUS_LABELS,
  MEETING_STATUSES,
  RESOLUTION_STATUS_LABELS,
} from "@/lib/enums";
import {
  addAgendaItem,
  deleteAgendaItem,
  rsvpMeeting,
  saveMinutes,
  updateMeetingStatus,
} from "@/lib/actions/meetings";
import { sql } from "drizzle-orm";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, membership } = await requireMembership();

  const meetingRows = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.organizationId, membership.organizationId)))
    .limit(1);
  const meeting = meetingRows[0];
  if (!meeting) notFound();

  const [agenda, attendanceRows, resolutionRows, documentRows, orgMembers] = await Promise.all([
    db
      .select({
        id: agendaItems.id,
        order: agendaItems.order,
        title: agendaItems.title,
        description: agendaItems.description,
        durationMin: agendaItems.durationMin,
        presenterName: users.name,
        presenterEmail: users.email,
      })
      .from(agendaItems)
      .leftJoin(users, eq(agendaItems.presenterId, users.id))
      .where(eq(agendaItems.meetingId, meeting.id))
      .orderBy(asc(agendaItems.order)),
    db
      .select({
        id: attendances.id,
        userId: attendances.userId,
        status: attendances.status,
        userName: users.name,
        userEmail: users.email,
      })
      .from(attendances)
      .innerJoin(users, eq(attendances.userId, users.id))
      .where(eq(attendances.meetingId, meeting.id)),
    db.select().from(resolutions).where(eq(resolutions.meetingId, meeting.id)),
    db
      .select({
        id: documents.id,
        title: documents.title,
        filename: documents.filename,
      })
      .from(documents)
      .where(eq(documents.meetingId, meeting.id))
      .orderBy(desc(documents.createdAt)),
    db
      .select({
        userId: memberships.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.organizationId, membership.organizationId)),
  ]);

  // One grouped query for vote counts across this meeting's resolutions.
  const resolutionIds = resolutionRows.map((r) => r.id);
  const voteCountRows = resolutionIds.length
    ? await db
        .select({ resolutionId: votes.resolutionId, c: sql<number>`count(*)` })
        .from(votes)
        .where(inArray(votes.resolutionId, resolutionIds))
        .groupBy(votes.resolutionId)
    : [];
  const votesByRes = new Map(voteCountRows.map((v) => [v.resolutionId, Number(v.c)]));
  const resWithCounts = resolutionRows.map((r) => ({ ...r, voteCount: votesByRes.get(r.id) ?? 0 }));

  const myAttendance = attendanceRows.find((a) => a.userId === user.id);
  const isManager = canManage(membership.role);
  const userCanVote = canVote(membership.role, membership.votingRights);

  const totalMinutes = agenda.reduce((acc, i) => acc + i.durationMin, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={meeting.status === "COMPLETED" ? "success" : "secondary"}>
              {MEETING_STATUS_LABELS[meeting.status as keyof typeof MEETING_STATUS_LABELS] ?? meeting.status}
            </Badge>
            <Badge variant="outline">{meeting.type.charAt(0) + meeting.type.slice(1).toLowerCase()}</Badge>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{meeting.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatDate(meeting.scheduledAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {meeting.durationMin} min
            </span>
            {meeting.location ? (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {meeting.location}
              </span>
            ) : null}
            {meeting.videoUrl ? (
              <a
                href={meeting.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-primary hover:underline"
              >
                <Video className="h-4 w-4" />
                Join video
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
        <Button asChild>
          <Link href={`/meetings/${meeting.id}/pack`}>View board pack</Link>
        </Button>
        {isManager ? (
          <form action={updateMeetingStatus} className="flex items-center gap-2">
            <input type="hidden" name="meetingId" value={meeting.id} />
            <Select name="status" defaultValue={meeting.status}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEETING_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {MEETING_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline" size="sm">
              Update status
            </Button>
          </form>
        ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Agenda */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Agenda</CardTitle>
            <CardDescription>
              {agenda.length} items · {totalMinutes} min total
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {agenda.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agenda items yet.</p>
            ) : (
              <ol className="space-y-2">
                {agenda.map((item, idx) => (
                  <li key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="font-medium">{item.title}</div>
                        {item.description ? (
                          <div className="text-sm text-muted-foreground">{item.description}</div>
                        ) : null}
                        <div className="mt-1 text-xs text-muted-foreground">
                          {item.durationMin} min
                          {item.presenterName ? ` · ${item.presenterName}` : item.presenterEmail ? ` · ${item.presenterEmail}` : ""}
                        </div>
                      </div>
                    </div>
                    {isManager ? (
                      <form action={deleteAgendaItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <Button type="submit" variant="ghost" size="icon" aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}

            {isManager ? (
              <>
                <Separator />
                <form action={addAgendaItem} className="space-y-3">
                  <input type="hidden" name="meetingId" value={meeting.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="title">New agenda item</Label>
                      <Input id="title" name="title" placeholder="e.g. CEO update" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="durationMin">Min</Label>
                      <Input id="durationMin" name="durationMin" type="number" min={1} defaultValue={10} required />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="presenterId">Presenter (optional)</Label>
                      <Select name="presenterId" defaultValue="none">
                        <SelectTrigger id="presenterId">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {orgMembers.map((m) => (
                            <SelectItem key={m.userId} value={m.userId}>
                              {m.userName ?? m.userEmail}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="description">Description (optional)</Label>
                      <Input id="description" name="description" />
                    </div>
                  </div>
                  <div>
                    <Button type="submit" size="sm" variant="outline">
                      <Plus className="mr-1 h-4 w-4" />
                      Add item
                    </Button>
                  </div>
                </form>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Attendance */}
        <Card>
          <CardHeader>
            <CardTitle>Attendees</CardTitle>
            <CardDescription>{attendanceRows.length} invited</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {attendanceRows.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">{initials(a.userName ?? a.userEmail)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm">{a.userName ?? a.userEmail}</span>
                  </div>
                  <Badge
                    variant={
                      a.status === "ACCEPTED" || a.status === "ATTENDED"
                        ? "success"
                        : a.status === "DECLINED" || a.status === "ABSENT"
                        ? "destructive"
                        : "outline"
                    }
                    className="shrink-0"
                  >
                    {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                  </Badge>
                </li>
              ))}
            </ul>

            {myAttendance ? (
              <>
                <Separator className="my-4" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">Your RSVP</p>
                  <form action={rsvpMeeting} className="flex gap-2">
                    <input type="hidden" name="meetingId" value={meeting.id} />
                    <Select name="status" defaultValue={myAttendance.status}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATTENDANCE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.charAt(0) + s.slice(1).toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="submit" size="sm" variant="outline">
                      Save
                    </Button>
                  </form>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Resolutions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Resolutions</CardTitle>
              <CardDescription>Votes proposed for this meeting.</CardDescription>
            </div>
            {isManager ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/resolutions/new?meetingId=${meeting.id}`}>
                  <Plus className="mr-1 h-4 w-4" />
                  Propose
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {resWithCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No resolutions tied to this meeting.</p>
            ) : (
              <ul className="divide-y">
                {resWithCounts.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/resolutions/${r.id}`}
                      className="flex items-center justify-between rounded-md px-2 py-3 hover:bg-accent"
                    >
                      <div>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-muted-foreground">{r.voteCount} votes cast</div>
                      </div>
                      <Badge
                        variant={r.status === "PASSED" ? "success" : r.status === "FAILED" ? "destructive" : "secondary"}
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

        {/* Board pack */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Board pack</CardTitle>
              <CardDescription>{documentRows.length} documents</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={`/documents/new?meetingId=${meeting.id}`}>
                <Plus className="mr-1 h-4 w-4" />
                Upload
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {documentRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents yet.</p>
            ) : (
              <ul className="space-y-2">
                {documentRows.map((d) => (
                  <li key={d.id}>
                    <Link href={`/documents/${d.id}`} className="block rounded-md border p-2 hover:bg-accent">
                      <div className="truncate text-sm font-medium">{d.title}</div>
                      <div className="text-xs text-muted-foreground">{d.filename}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Minutes */}
        {isManager || meeting.minutes ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Minutes</CardTitle>
              <CardDescription>The official record of what was discussed and decided.</CardDescription>
            </CardHeader>
            <CardContent>
              {isManager ? (
                <form action={saveMinutes} className="space-y-3">
                  <input type="hidden" name="meetingId" value={meeting.id} />
                  <Textarea
                    name="minutes"
                    defaultValue={meeting.minutes ?? ""}
                    rows={10}
                    placeholder="Recorded by the corporate secretary…"
                  />
                  <Button type="submit" size="sm">
                    Save minutes
                  </Button>
                </form>
              ) : (
                <div className="whitespace-pre-wrap text-sm">{meeting.minutes}</div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {!userCanVote ? (
        <p className="text-xs text-muted-foreground">
          Note: you don&apos;t currently hold voting rights on this board.
        </p>
      ) : null}
    </div>
  );
}
