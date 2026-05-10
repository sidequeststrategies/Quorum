import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import {
  coachingClients,
  coachingLessons,
  coachingPrograms,
  coachingSessions,
  lessonAssignments,
} from "@/db/schema";
import { requireUser } from "@/lib/session";
import { COACHING_CLIENT_STATUSES, LESSON_ASSIGNMENT_STATUSES } from "@/lib/enums";
import { formatDate, formatDateOnly } from "@/lib/utils";
import {
  assignLesson,
  generatePortalToken,
  logSession,
  setPortalEnabled,
  updateAssignmentStatus,
  updateClientStatus,
} from "@/lib/actions/coaching";
import { headers } from "next/headers";

const ASSIGNMENT_LABEL: Record<string, string> = {
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
};

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const rows = await db
    .select({ c: coachingClients, programTitle: coachingPrograms.title, programId: coachingPrograms.id })
    .from(coachingClients)
    .leftJoin(coachingPrograms, eq(coachingClients.programId, coachingPrograms.id))
    .where(and(eq(coachingClients.id, id), eq(coachingClients.ownerId, user.id)))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();

  const [assignments, sessions, allLessons] = await Promise.all([
    db
      .select({
        a: lessonAssignments,
        lessonTitle: coachingLessons.title,
        lessonId: coachingLessons.id,
        lessonOrder: coachingLessons.order,
        durationMin: coachingLessons.durationMin,
      })
      .from(lessonAssignments)
      .innerJoin(coachingLessons, eq(lessonAssignments.lessonId, coachingLessons.id))
      .where(eq(lessonAssignments.clientId, row.c.id))
      .orderBy(asc(coachingLessons.order)),
    db
      .select()
      .from(coachingSessions)
      .where(eq(coachingSessions.clientId, row.c.id))
      .orderBy(desc(coachingSessions.sessionDate)),
    row.c.programId
      ? db.select().from(coachingLessons).where(eq(coachingLessons.programId, row.c.programId)).orderBy(asc(coachingLessons.order))
      : Promise.resolve([] as Array<typeof coachingLessons.$inferSelect>),
  ]);

  const assignedLessonIds = new Set(assignments.map((a) => a.lessonId));
  const unassignedLessons = allLessons.filter((l) => !assignedLessonIds.has(l.id));

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const portalUrl = row.c.portalToken ? `${proto}://${host}/c/${row.c.portalToken}` : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant={row.c.status === "ACTIVE" ? "success" : row.c.status === "COMPLETED" ? "outline" : "secondary"}>
            {row.c.status.charAt(0) + row.c.status.slice(1).toLowerCase()}
          </Badge>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{row.c.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.c.role}
            {row.c.company ? ` · ${row.c.company}` : ""}
            {row.c.email ? ` · ${row.c.email}` : ""}
          </p>
          {row.programTitle ? (
            <p className="mt-1 text-sm">
              Program:{" "}
              <Link href={`/coaching/${row.programId}`} className="text-primary hover:underline">
                {row.programTitle}
              </Link>
            </p>
          ) : null}
        </div>

        <form action={updateClientStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={row.c.id} />
          <Select name="status" defaultValue={row.c.status}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COACHING_CLIENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline" size="sm">
            Update
          </Button>
        </form>
      </div>

      {row.c.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{row.c.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Client portal</CardTitle>
            <CardDescription>
              {portalUrl
                ? "Share this link with your client. They can view lessons and update their own progress."
                : "No portal link yet — generate one to share."}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {portalUrl ? (
              <form action={setPortalEnabled}>
                <input type="hidden" name="id" value={row.c.id} />
                <input type="hidden" name="enabled" value={row.c.portalEnabled ? "false" : "true"} />
                <Button type="submit" variant="outline" size="sm">
                  {row.c.portalEnabled ? "Disable portal" : "Enable portal"}
                </Button>
              </form>
            ) : null}
            <form action={generatePortalToken}>
              <input type="hidden" name="id" value={row.c.id} />
              <Button type="submit" size="sm">
                {portalUrl ? "Regenerate link" : "Create portal link"}
              </Button>
            </form>
          </div>
        </CardHeader>
        {portalUrl ? (
          <CardContent>
            <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
              {portalUrl}
              <span className="ml-2 text-muted-foreground">
                {row.c.portalEnabled ? "(active)" : "(disabled)"}
              </span>
            </div>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lessons</CardTitle>
          <CardDescription>{assignments.length} assigned from this client&apos;s program</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons assigned yet.</p>
          ) : (
            <ul className="divide-y">
              {assignments.map(({ a, lessonTitle, lessonOrder, durationMin }) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Lesson {lessonOrder} · {durationMin} min
                    </div>
                    <div className="font-medium">{lessonTitle}</div>
                    {a.completedAt ? (
                      <div className="text-xs text-muted-foreground">Completed {formatDateOnly(a.completedAt)}</div>
                    ) : null}
                  </div>
                  <form action={updateAssignmentStatus} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={a.id} />
                    <Select name="status" defaultValue={a.status}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LESSON_ASSIGNMENT_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {ASSIGNMENT_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="submit" variant="outline" size="sm">
                      Update
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {unassignedLessons.length > 0 ? (
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="mb-2 text-sm font-semibold">Assign more lessons</div>
              <div className="flex flex-wrap gap-2">
                {unassignedLessons.map((l) => (
                  <form key={l.id} action={assignLesson}>
                    <input type="hidden" name="lessonId" value={l.id} />
                    <input type="hidden" name="clientId" value={row.c.id} />
                    <Button type="submit" variant="outline" size="sm">
                      + Lesson {l.order}: {l.title}
                    </Button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session log</CardTitle>
          <CardDescription>{sessions.length} session{sessions.length === 1 ? "" : "s"} recorded</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions logged yet.</p>
          ) : (
            <ul className="space-y-3">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-md border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(s.sessionDate)} · {s.durationMin} min
                      </div>
                      {s.topic ? <div className="mt-1 font-medium">{s.topic}</div> : null}
                    </div>
                  </div>
                  {s.notes ? <p className="mt-2 whitespace-pre-wrap text-sm">{s.notes}</p> : null}
                  {s.followUps ? (
                    <div className="mt-2 rounded-md bg-muted/40 p-2 text-sm">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Follow-ups
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{s.followUps}</p>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <details className="rounded-md border bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-medium">Log a session</summary>
            <form action={logSession} className="mt-3 space-y-3">
              <input type="hidden" name="clientId" value={row.c.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="topic">Topic</Label>
                  <Input id="topic" name="topic" placeholder="Series B narrative coaching" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="durationMin">Duration (min)</Label>
                  <Input id="durationMin" name="durationMin" type="number" min={5} max={480} defaultValue={60} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sessionDate">Session date & time</Label>
                <Input id="sessionDate" name="sessionDate" type="datetime-local" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={4} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="followUps">Follow-ups</Label>
                <Textarea id="followUps" name="followUps" rows={2} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Save session
                </Button>
              </div>
            </form>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
