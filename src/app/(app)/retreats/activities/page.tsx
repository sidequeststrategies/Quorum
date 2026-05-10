import Link from "next/link";
import { asc, eq, isNull, or } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { retreatActivities } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { ACTIVITY_KIND_LABELS } from "@/lib/enums";

export default async function ActivityLibraryPage() {
  const { membership } = await requireMembership();

  const activities = await db
    .select()
    .from(retreatActivities)
    .where(or(eq(retreatActivities.organizationId, membership.organizationId), isNull(retreatActivities.organizationId)))
    .orderBy(asc(retreatActivities.kind), asc(retreatActivities.title));

  // Group by kind
  const byKind = activities.reduce<Record<string, typeof activities>>((acc, a) => {
    (acc[a.kind] ||= []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity library</h1>
          <p className="text-muted-foreground">
            Reusable exercises for offsites — drop them into any retreat agenda.
          </p>
        </div>
        <Button asChild>
          <Link href="/retreats/activities/new">New activity</Link>
        </Button>
      </div>

      {Object.entries(byKind).map(([kind, items]) => (
        <Card key={kind}>
          <CardHeader>
            <CardTitle>{ACTIVITY_KIND_LABELS[kind] ?? kind}</CardTitle>
            <CardDescription>{items.length} activit{items.length === 1 ? "y" : "ies"}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((a) => (
                <li key={a.id} className="rounded-md border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{a.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {a.durationMin} min · {a.groupSizeMin}–{a.groupSizeMax} people
                      </div>
                    </div>
                    {a.isGlobal ? <Badge variant="outline">Built-in</Badge> : null}
                  </div>
                  {a.description ? <p className="mt-2 text-sm text-muted-foreground">{a.description}</p> : null}
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-primary">How to run it</summary>
                    <div className="mt-2 whitespace-pre-wrap rounded-md bg-muted/30 p-3 text-xs">{a.instructions}</div>
                    {a.materials ? (
                      <div className="mt-2 text-xs">
                        <span className="font-semibold">Materials:</span> {a.materials}
                      </div>
                    ) : null}
                    {a.learningObjectives ? (
                      <div className="mt-1 text-xs">
                        <span className="font-semibold">Objectives:</span> {a.learningObjectives}
                      </div>
                    ) : null}
                  </details>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
