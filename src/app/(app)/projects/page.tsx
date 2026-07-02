import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { Plus, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { projects, projectMilestones, projectUpdates } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { ProjectStatusBadge } from "@/components/report-badges";
import { formatDateOnly, formatPeriod } from "@/lib/utils";

export default async function ProjectsPage() {
  const { membership } = await requireMembership();

  const list = await db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, membership.organizationId))
    .orderBy(desc(projects.updatedAt));

  const ids = list.map((p) => p.id);
  const [milestones, updates] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          db.select().from(projectMilestones).where(inArray(projectMilestones.projectId, ids)),
          db
            .select()
            .from(projectUpdates)
            .where(inArray(projectUpdates.projectId, ids))
            .orderBy(desc(projectUpdates.period)),
        ]);

  const active = list.filter((p) => p.status !== "COMPLETED");
  const completed = list.filter((p) => p.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Key projects & initiatives</h1>
          <p className="text-muted-foreground">
            The board-visible workstreams — each with milestones and a monthly write-up.
          </p>
        </div>
        {canManage(membership.role) ? (
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New project
            </Link>
          </Button>
        ) : null}
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Rocket className="h-8 w-8 text-brand-teal" />
            <p className="text-muted-foreground">No projects yet. Add the initiatives the board should track.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ProjectGrid list={active} milestones={milestones} updates={updates} />
          {completed.length > 0 ? (
            <>
              <h2 className="pt-2 text-lg font-semibold">Completed</h2>
              <ProjectGrid list={completed} milestones={milestones} updates={updates} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function ProjectGrid({
  list,
  milestones,
  updates,
}: {
  list: (typeof projects.$inferSelect)[];
  milestones: (typeof projectMilestones.$inferSelect)[];
  updates: (typeof projectUpdates.$inferSelect)[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((p) => {
        const ms = milestones.filter((m) => m.projectId === p.id);
        const done = ms.filter((m) => m.status === "DONE").length;
        const latest = updates.find((u) => u.projectId === p.id);
        return (
          <Link key={p.id} href={`/projects/${p.id}`} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <ProjectStatusBadge status={p.status} />
                </div>
                {p.summary ? <CardDescription className="line-clamp-2">{p.summary}</CardDescription> : null}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {ms.length > 0 ? (
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                      <span>Milestones</span>
                      <span>
                        {done}/{ms.length}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-brand-teal transition-all"
                        style={{ width: `${ms.length ? Math.round((done / ms.length) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ) : null}
                {latest ? (
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">{formatPeriod(latest.period)}:</span> {latest.headline}
                  </p>
                ) : (
                  <p className="text-muted-foreground">No monthly write-up yet.</p>
                )}
                {p.targetDate ? (
                  <p className="text-xs text-muted-foreground">Target: {formatDateOnly(p.targetDate)}</p>
                ) : null}
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
