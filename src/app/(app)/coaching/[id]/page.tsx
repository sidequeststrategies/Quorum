import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";
import { coachingClients, coachingLessons, coachingPrograms } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { COACHING_PROGRAM_LABELS } from "@/lib/enums";
import { createLesson, deleteLesson } from "@/lib/actions/coaching";

type Exercise = { title: string; prompt: string };

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const rows = await db
    .select()
    .from(coachingPrograms)
    .where(and(eq(coachingPrograms.id, id), eq(coachingPrograms.ownerId, user.id)))
    .limit(1);
  const program = rows[0];
  if (!program) notFound();

  const [lessons, enrolledClients] = await Promise.all([
    db.select().from(coachingLessons).where(eq(coachingLessons.programId, program.id)).orderBy(asc(coachingLessons.order)),
    db.select().from(coachingClients).where(eq(coachingClients.programId, program.id)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">{COACHING_PROGRAM_LABELS[program.kind] ?? program.kind}</Badge>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{program.title}</h1>
        {program.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{program.description}</p>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Lessons</CardTitle>
            <CardDescription>
              {lessons.length} lesson{lessons.length === 1 ? "" : "s"} · {lessons.reduce((s, l) => s + l.durationMin, 0)} min total
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons yet. Add the first one below.</p>
          ) : (
            <ol className="space-y-3">
              {lessons.map((l, idx) => {
                let exercises: Exercise[] = [];
                try {
                  exercises = JSON.parse(l.exercises) as Exercise[];
                } catch {
                  /* noop */
                }
                return (
                  <li key={l.id} className="rounded-md border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="text-sm text-muted-foreground">Lesson {idx + 1} · {l.durationMin} min</div>
                        <div className="mt-1 font-medium">{l.title}</div>
                        {l.body ? <p className="mt-2 whitespace-pre-wrap text-sm">{l.body}</p> : null}
                        {exercises.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Exercises
                            </div>
                            <ul className="space-y-2">
                              {exercises.map((ex, i) => (
                                <li key={i} className="rounded-md bg-muted/30 p-3">
                                  <div className="text-sm font-medium">{ex.title}</div>
                                  {ex.prompt ? (
                                    <div className="mt-1 text-sm text-muted-foreground">{ex.prompt}</div>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                      <form action={deleteLesson}>
                        <input type="hidden" name="id" value={l.id} />
                        <Button type="submit" variant="ghost" size="icon" aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="rounded-md border bg-muted/20 p-4">
            <div className="mb-3 text-sm font-semibold">Add lesson</div>
            <form action={createLesson} className="space-y-3">
              <input type="hidden" name="programId" value={program.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" name="title" required placeholder="Defining your operating cadence" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="durationMin">Duration (min)</Label>
                  <Input id="durationMin" name="durationMin" type="number" min={5} max={480} defaultValue={60} required />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="body">Body</Label>
                <Textarea id="body" name="body" rows={4} placeholder="The teaching content / framework / story." />
              </div>
              <details className="rounded-md border bg-background p-3">
                <summary className="cursor-pointer text-sm font-medium">Exercises (optional, JSON)</summary>
                <Textarea
                  name="exercisesJson"
                  rows={5}
                  className="mt-2 font-mono text-xs"
                  defaultValue={`[\n  { "title": "Cadence inventory", "prompt": "List every meeting on your calendar this week..." }\n]`}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  JSON array of {`{ title, prompt }`}. Will be saved with the lesson.
                </p>
              </details>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Add lesson
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrolled clients</CardTitle>
          <CardDescription>{enrolledClients.length} on this program</CardDescription>
        </CardHeader>
        <CardContent>
          {enrolledClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No clients on this program yet. Enroll them from{" "}
              <Link href="/coaching/clients" className="text-primary hover:underline">
                Clients
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y">
              {enrolledClients.map((c) => (
                <li key={c.id} className="py-2">
                  <Link href={`/coaching/clients/${c.id}`} className="flex items-center justify-between hover:underline">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.role}
                      {c.company ? ` · ${c.company}` : ""}
                    </span>
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
