import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import { projects, projectMilestones, projectUpdates, users } from "@/db/schema";
import { canManage, listOrgMembers, requireMembership } from "@/lib/session";
import {
  addMilestone,
  deleteMilestone,
  deleteProject,
  saveProjectUpdate,
  setMilestoneStatus,
  updateProject,
} from "@/lib/actions/projects";
import { ProjectForm } from "@/components/project-form";
import { MilestoneStatusBadge, ProjectStatusBadge } from "@/components/report-badges";
import { MILESTONE_STATUSES, MILESTONE_STATUS_LABELS, PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/enums";
import { currentPeriodString, formatDateOnly, formatPeriod } from "@/lib/utils";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();

  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, membership.organizationId)))
    .limit(1);
  const project = rows[0];
  if (!project) notFound();

  const [members, milestones, updates] = await Promise.all([
    listOrgMembers(membership.organizationId),
    db.select().from(projectMilestones).where(eq(projectMilestones.projectId, id)).orderBy(asc(projectMilestones.order)),
    db
      .select({ u: projectUpdates, authorName: users.name, authorEmail: users.email })
      .from(projectUpdates)
      .leftJoin(users, eq(projectUpdates.authorId, users.id))
      .where(eq(projectUpdates.projectId, id))
      .orderBy(desc(projectUpdates.period)),
  ]);

  const manager = canManage(membership.role);
  const currentPeriod = currentPeriodString();
  const latest = updates[0];
  // Copy-forward: prefill this month's write-up from the latest one.
  const prefill = latest && formatPeriod(latest.u.period) !== formatPeriod(new Date()) ? latest.u : undefined;
  const existingThisMonth = updates.find((x) => formatPeriod(x.u.period) === formatPeriod(new Date()))?.u;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          {project.summary ? <p className="mt-1 text-muted-foreground">{project.summary}</p> : null}
        </div>
        {manager ? (
          <form action={deleteProject}>
            <input type="hidden" name="id" value={project.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
              <CardDescription>The checkpoints the board tracks meeting to meeting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No milestones yet.</p>
              ) : (
                <ul className="space-y-3">
                  {milestones.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                      <div>
                        <span className="font-medium">{m.title}</span>
                        {m.dueDate ? (
                          <span className="ml-2 text-xs text-muted-foreground">due {formatDateOnly(m.dueDate)}</span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <MilestoneStatusBadge status={m.status} />
                        {manager ? (
                          <form action={setMilestoneStatus} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={m.id} />
                            <Select name="status" defaultValue={m.status}>
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MILESTONE_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {MILESTONE_STATUS_LABELS[s]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs">
                              Set
                            </Button>
                          </form>
                        ) : null}
                        {manager ? (
                          <form action={deleteMilestone}>
                            <input type="hidden" name="id" value={m.id} />
                            <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive">
                              ✕
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {manager ? (
                <form action={addMilestone} className="flex items-end gap-2 border-t pt-4">
                  <input type="hidden" name="projectId" value={project.id} />
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="ms-title">Add milestone</Label>
                    <Input id="ms-title" name="title" placeholder="e.g. First commercial deployment" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ms-due">Due</Label>
                    <Input id="ms-due" name="dueDate" type="date" />
                  </div>
                  <Button type="submit">Add</Button>
                </form>
              ) : null}
            </CardContent>
          </Card>

          {manager ? (
            <Card>
              <CardHeader>
                <CardTitle>Project settings</CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectForm action={updateProject} project={project} members={members} submitLabel="Save changes" />
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          {manager ? (
            <Card>
              <CardHeader>
                <CardTitle>{existingThisMonth ? "Edit this month's write-up" : "This month's write-up"}</CardTitle>
                <CardDescription>
                  One per month — it lands in the board pack automatically.
                  {prefill && !existingThisMonth ? " Prefilled from last month; edit what changed." : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={saveProjectUpdate} className="space-y-4">
                  <input type="hidden" name="projectId" value={project.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="up-period">Period</Label>
                      <Input id="up-period" name="period" type="month" defaultValue={currentPeriod} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="up-status">Status</Label>
                      <Select name="status" defaultValue={existingThisMonth?.status ?? project.status}>
                        <SelectTrigger id="up-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {PROJECT_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="up-headline">Headline</Label>
                    <Input
                      id="up-headline"
                      name="headline"
                      defaultValue={existingThisMonth?.headline ?? prefill?.headline ?? ""}
                      placeholder="The one-line takeaway for the board"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="up-body">Write-up</Label>
                    <Textarea
                      id="up-body"
                      name="body"
                      rows={6}
                      defaultValue={existingThisMonth?.body ?? prefill?.body ?? ""}
                      placeholder="Progress, blockers, asks of the board."
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">Save write-up</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Update history</CardTitle>
            </CardHeader>
            <CardContent>
              {updates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No write-ups yet.</p>
              ) : (
                <ol className="space-y-5">
                  {updates.map(({ u, authorName, authorEmail }) => (
                    <li key={u.id} className="border-l-2 border-brand-teal/40 pl-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{formatPeriod(u.period)}</span>
                        <ProjectStatusBadge status={u.status} />
                        <span className="text-xs text-muted-foreground">{authorName ?? authorEmail}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium">{u.headline}</p>
                      {u.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{u.body}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
