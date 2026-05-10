import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq, isNull, or } from "drizzle-orm";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import {
  retreatActivities,
  retreatAgendaItems,
  retreatIntakeResponses,
  retreatTakeaways,
  retreats,
  users,
} from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { ACTIVITY_KIND_LABELS, RETREAT_STATUSES } from "@/lib/enums";
import { formatDate, formatDateOnly } from "@/lib/utils";
import {
  addRetreatAgendaItem,
  addTakeaway,
  deleteRetreatAgendaItem,
  generateIntakeToken,
  setIntakeOpen,
  updateRetreatStatus,
} from "@/lib/actions/retreats";
import { headers } from "next/headers";

const STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default async function RetreatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();

  const rows = await db
    .select()
    .from(retreats)
    .where(and(eq(retreats.id, id), eq(retreats.organizationId, membership.organizationId)))
    .limit(1);
  const retreat = rows[0];
  if (!retreat) notFound();

  const [agenda, takeaways, activities, intakeRows] = await Promise.all([
    db
      .select({
        a: retreatAgendaItems,
        activityKind: retreatActivities.kind,
      })
      .from(retreatAgendaItems)
      .leftJoin(retreatActivities, eq(retreatAgendaItems.activityId, retreatActivities.id))
      .where(eq(retreatAgendaItems.retreatId, retreat.id))
      .orderBy(asc(retreatAgendaItems.order)),
    db
      .select({
        t: retreatTakeaways,
        authorName: users.name,
        authorEmail: users.email,
      })
      .from(retreatTakeaways)
      .innerJoin(users, eq(retreatTakeaways.authorId, users.id))
      .where(eq(retreatTakeaways.retreatId, retreat.id))
      .orderBy(desc(retreatTakeaways.createdAt)),
    db
      .select()
      .from(retreatActivities)
      .where(or(eq(retreatActivities.organizationId, membership.organizationId), isNull(retreatActivities.organizationId)))
      .orderBy(asc(retreatActivities.title)),
    db
      .select()
      .from(retreatIntakeResponses)
      .where(eq(retreatIntakeResponses.retreatId, retreat.id))
      .orderBy(desc(retreatIntakeResponses.submittedAt)),
  ]);

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const intakeUrl = retreat.intakeToken ? `${proto}://${host}/r/${retreat.intakeToken}` : null;

  const isManager = canManage(membership.role);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge
            variant={
              retreat.status === "COMPLETED"
                ? "success"
                : retreat.status === "IN_PROGRESS"
                ? "default"
                : retreat.status === "CANCELLED"
                ? "destructive"
                : "secondary"
            }
          >
            {STATUS_LABEL[retreat.status] ?? retreat.status}
          </Badge>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{retreat.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(retreat.startDate)} – {formatDate(retreat.endDate)}
            {retreat.location ? ` · ${retreat.location}` : ""}
          </p>
          {retreat.description ? <p className="mt-2 text-sm">{retreat.description}</p> : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          {isManager ? (
            <form action={updateRetreatStatus} className="flex items-center gap-2">
              <input type="hidden" name="id" value={retreat.id} />
              <Select name="status" defaultValue={retreat.status}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RETREAT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" size="sm">
                Update
              </Button>
            </form>
          ) : null}
          <Button asChild size="sm">
            <Link href={`/retreats/${retreat.id}/run`}>▶ Run retreat (facilitation mode)</Link>
          </Button>
        </div>
      </div>

      {retreat.philosophy ? (
        <Card>
          <CardHeader>
            <CardTitle>Day at a glance</CardTitle>
            <CardDescription>The frame for the retreat — share with attendees ahead of time.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
              {retreat.philosophy}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Pre-retreat intake form</CardTitle>
            <CardDescription>
              {intakeUrl ? "Share this link with attendees. Their responses populate this page." : "No intake link yet."}
            </CardDescription>
          </div>
          {isManager ? (
            <div className="flex gap-2">
              {intakeUrl ? (
                <form action={setIntakeOpen}>
                  <input type="hidden" name="id" value={retreat.id} />
                  <input type="hidden" name="open" value={retreat.intakeOpen ? "false" : "true"} />
                  <Button type="submit" variant="outline" size="sm">
                    {retreat.intakeOpen ? "Close intake" : "Reopen intake"}
                  </Button>
                </form>
              ) : null}
              <form action={generateIntakeToken}>
                <input type="hidden" name="id" value={retreat.id} />
                <Button type="submit" size="sm">
                  {intakeUrl ? "Regenerate link" : "Create intake link"}
                </Button>
              </form>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {intakeUrl ? (
            <>
              <div className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs">
                {intakeUrl}
                <span className="ml-2 text-muted-foreground">
                  {retreat.intakeOpen ? "(open)" : "(closed)"}
                </span>
              </div>
              <div className="mt-4">
                <h4 className="text-sm font-semibold">Responses ({intakeRows.length})</h4>
                {intakeRows.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No responses yet.</p>
                ) : (
                  <ul className="mt-2 divide-y">
                    {intakeRows.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/retreats/${retreat.id}/intake/${r.id}`}
                          className="flex items-center justify-between py-2 text-sm hover:underline"
                        >
                          <span>
                            <span className="font-medium">{r.participantName}</span>
                            {r.participantRole ? (
                              <span className="text-muted-foreground"> · {r.participantRole}</span>
                            ) : null}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDateOnly(r.submittedAt)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agenda</CardTitle>
          <CardDescription>
            {agenda.length} item{agenda.length === 1 ? "" : "s"} · {agenda.reduce((s, x) => s + x.a.durationMin, 0)} min total
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {agenda.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agenda items yet.</p>
          ) : (
            <ol className="space-y-2">
              {agenda.map((row, idx) => (
                <li key={row.a.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                  <div className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{row.a.title}</div>
                        {row.activityKind ? (
                          <Badge variant="outline" className="text-xs">
                            {ACTIVITY_KIND_LABELS[row.activityKind] ?? row.activityKind}
                          </Badge>
                        ) : null}
                      </div>
                      {row.a.description ? (
                        <div className="mt-0.5 text-sm text-muted-foreground">{row.a.description}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {row.a.durationMin} min
                        {row.a.facilitatorName ? ` · facilitated by ${row.a.facilitatorName}` : ""}
                      </div>
                    </div>
                  </div>
                  {isManager ? (
                    <form action={deleteRetreatAgendaItem}>
                      <input type="hidden" name="id" value={row.a.id} />
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
            <details className="rounded-md border bg-muted/20 p-3">
              <summary className="cursor-pointer text-sm font-medium">Add agenda item</summary>
              <form action={addRetreatAgendaItem} className="mt-3 space-y-3">
                <input type="hidden" name="retreatId" value={retreat.id} />
                <div className="space-y-1.5">
                  <Label htmlFor="activityId">From activity library (optional)</Label>
                  <Select name="activityId" defaultValue="none">
                    <SelectTrigger id="activityId">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None / custom —</SelectItem>
                      {activities.map((act) => (
                        <SelectItem key={act.id} value={act.id}>
                          {ACTIVITY_KIND_LABELS[act.kind]}: {act.title} ({act.durationMin} min)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" name="title" required placeholder="Pre-mortem on the FY plan" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="durationMin">Duration (min)</Label>
                    <Input id="durationMin" name="durationMin" type="number" min={5} max={480} defaultValue={30} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="facilitatorName">Facilitator</Label>
                    <Input id="facilitatorName" name="facilitatorName" placeholder="Riley" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input id="description" name="description" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm">
                    <Plus className="mr-1 h-4 w-4" />
                    Add to agenda
                  </Button>
                </div>
              </form>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Takeaways</CardTitle>
          <CardDescription>What we want to remember after the retreat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {takeaways.length === 0 ? (
            <p className="text-sm text-muted-foreground">No takeaways yet.</p>
          ) : (
            <ul className="space-y-2">
              {takeaways.map((row) => (
                <li key={row.t.id} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">
                    {row.authorName ?? row.authorEmail} · {formatDateOnly(row.t.createdAt)}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{row.t.content}</p>
                </li>
              ))}
            </ul>
          )}

          <form action={addTakeaway} className="space-y-2">
            <input type="hidden" name="retreatId" value={retreat.id} />
            <Label htmlFor="content">Add a takeaway</Label>
            <Textarea id="content" name="content" rows={3} required />
            <div className="flex justify-end">
              <Button type="submit" size="sm" variant="outline">
                Save takeaway
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
