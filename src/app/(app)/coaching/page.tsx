import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { coachingClients, coachingLessons, coachingPrograms } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { COACHING_PROGRAM_LABELS } from "@/lib/enums";

export default async function CoachingPage() {
  const user = await requireUser();

  const programs = await db
    .select()
    .from(coachingPrograms)
    .where(eq(coachingPrograms.ownerId, user.id))
    .orderBy(desc(coachingPrograms.updatedAt));

  const enriched = await Promise.all(
    programs.map(async (p) => {
      const [l, c] = await Promise.all([
        db.select({ c: count() }).from(coachingLessons).where(eq(coachingLessons.programId, p.id)),
        db.select({ c: count() }).from(coachingClients).where(eq(coachingClients.programId, p.id)),
      ]);
      return { ...p, lessonCount: l[0]?.c ?? 0, clientCount: c[0]?.c ?? 0 };
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Coaching programs</h1>
          <p className="text-muted-foreground">
            Build curricula for your coaching practice. Programs hold lessons; assign them to clients individually.
          </p>
        </div>
        <Button asChild>
          <Link href="/coaching/new">New program</Link>
        </Button>
      </div>

      {enriched.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No programs yet. Start with the curriculum you already deliver to clients — you can refine as you go.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {enriched.map((p) => (
            <li key={p.id}>
              <Link href={`/coaching/${p.id}`} className="block rounded-lg border p-5 hover:bg-accent">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <Badge variant="outline">{COACHING_PROGRAM_LABELS[p.kind] ?? p.kind}</Badge>
                  </div>
                </div>
                <div className="mt-3 font-semibold">{p.title}</div>
                {p.description ? (
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-3">{p.description}</p>
                ) : null}
                <div className="mt-3 text-xs text-muted-foreground">
                  {p.lessonCount} lesson{p.lessonCount === 1 ? "" : "s"} · {p.clientCount} client
                  {p.clientCount === 1 ? "" : "s"} enrolled
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
