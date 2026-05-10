import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import { coachingClients, coachingLessons, coachingPrograms, lessonAssignments, users } from "@/db/schema";
import { LESSON_ASSIGNMENT_STATUSES } from "@/lib/enums";
import { formatDateOnly } from "@/lib/utils";
import { clientUpdateAssignment } from "@/lib/actions/coaching";

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Done",
  SKIPPED: "Skipped",
};

export const dynamic = "force-dynamic";

export default async function ClientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const rows = await db
    .select({
      c: coachingClients,
      programTitle: coachingPrograms.title,
      programDescription: coachingPrograms.description,
      coachName: users.name,
      coachEmail: users.email,
    })
    .from(coachingClients)
    .leftJoin(coachingPrograms, eq(coachingClients.programId, coachingPrograms.id))
    .innerJoin(users, eq(coachingClients.ownerId, users.id))
    .where(eq(coachingClients.portalToken, token))
    .limit(1);
  const row = rows[0];
  if (!row || !row.c.portalEnabled) notFound();

  const assignments = await db
    .select({
      a: lessonAssignments,
      lessonTitle: coachingLessons.title,
      lessonBody: coachingLessons.body,
      lessonDuration: coachingLessons.durationMin,
      lessonOrder: coachingLessons.order,
      lessonExercises: coachingLessons.exercises,
    })
    .from(lessonAssignments)
    .innerJoin(coachingLessons, eq(lessonAssignments.lessonId, coachingLessons.id))
    .where(eq(lessonAssignments.clientId, row.c.id))
    .orderBy(asc(coachingLessons.order));

  return (
    <div className="min-h-screen bg-muted/20 py-12">
      <div className="container max-w-3xl">
        <div className="mb-8">
          <Badge variant="outline" className="mb-3">
            Coaching portal
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {row.c.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Coached by {row.coachName ?? row.coachEmail}
            {row.programTitle ? ` · ${row.programTitle}` : ""}
          </p>
          {row.programDescription ? (
            <p className="mt-3 text-sm">{row.programDescription}</p>
          ) : null}
        </div>

        <div className="space-y-6">
          {assignments.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No lessons assigned to you yet.
              </CardContent>
            </Card>
          ) : (
            assignments.map(({ a, lessonTitle, lessonBody, lessonDuration, lessonOrder, lessonExercises }) => {
              type Exercise = { title: string; prompt: string };
              let exercises: Exercise[] = [];
              try {
                exercises = JSON.parse(lessonExercises) as Exercise[];
              } catch {
                /* noop */
              }
              return (
                <Card key={a.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                          Lesson {lessonOrder} · {lessonDuration} min
                        </div>
                        <CardTitle className="mt-1">{lessonTitle}</CardTitle>
                      </div>
                      <Badge
                        variant={
                          a.status === "COMPLETED" ? "success" : a.status === "IN_PROGRESS" ? "warning" : "secondary"
                        }
                      >
                        {STATUS_LABEL[a.status] ?? a.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {lessonBody ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{lessonBody}</p> : null}
                    {exercises.length > 0 ? (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Exercises
                        </div>
                        <ul className="mt-2 space-y-2">
                          {exercises.map((ex, i) => (
                            <li key={i} className="rounded-md bg-muted/30 p-3 text-sm">
                              <div className="font-medium">{ex.title}</div>
                              {ex.prompt ? <p className="mt-1 text-muted-foreground">{ex.prompt}</p> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {a.completedAt ? (
                      <div className="text-xs text-muted-foreground">Marked complete {formatDateOnly(a.completedAt)}</div>
                    ) : null}

                    <form action={clientUpdateAssignment} className="flex items-center gap-2 border-t pt-3">
                      <input type="hidden" name="token" value={token} />
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <Select name="status" defaultValue={a.status}>
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LESSON_ASSIGNMENT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="submit" size="sm" variant="outline">
                        Update status
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <div className="mt-10 text-center text-xs text-muted-foreground">
          Questions? Email your coach directly.
        </div>
      </div>
    </div>
  );
}
