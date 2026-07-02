import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";
import { teamUpdates, users } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { deleteTeamUpdate, saveTeamUpdate } from "@/lib/actions/updates";
import { currentPeriodString, formatPeriod } from "@/lib/utils";

export default async function TeamPage() {
  const { membership } = await requireMembership();

  const updates = await db
    .select({ u: teamUpdates, authorName: users.name, authorEmail: users.email })
    .from(teamUpdates)
    .leftJoin(users, eq(teamUpdates.authorId, users.id))
    .where(eq(teamUpdates.organizationId, membership.organizationId))
    .orderBy(desc(teamUpdates.period));

  const manager = canManage(membership.role);
  const currentPeriod = currentPeriodString();
  const thisMonth = updates.find((x) => formatPeriod(x.u.period) === formatPeriod(new Date()))?.u;
  // Copy-forward: open roles and headcount rarely change wholesale month to month.
  const prefill = thisMonth ?? updates[0]?.u;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team update</h1>
        <p className="text-muted-foreground">Hires, departures, open roles, and the people narrative — one entry per month.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {manager ? (
          <Card>
            <CardHeader>
              <CardTitle>{thisMonth ? "Edit this month" : "This month's update"}</CardTitle>
              <CardDescription>
                {thisMonth
                  ? "Already drafted — edits overwrite the same entry."
                  : prefill
                    ? "Prefilled from last month; adjust what changed."
                    : "First team update — it carries forward from here."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveTeamUpdate} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="period">Period</Label>
                    <Input id="period" name="period" type="month" defaultValue={currentPeriod} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headcount">Headcount</Label>
                    <Input id="headcount" name="headcount" type="number" min={0} defaultValue={prefill?.headcount ?? ""} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headline">Headline</Label>
                  <Input id="headline" name="headline" defaultValue={thisMonth?.headline ?? ""} placeholder="One-line people summary" />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="hires">Hires</Label>
                    <Textarea id="hires" name="hires" rows={3} defaultValue={thisMonth?.hires ?? ""} placeholder="Name — role" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="departures">Departures</Label>
                    <Textarea id="departures" name="departures" rows={3} defaultValue={thisMonth?.departures ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openRoles">Open roles</Label>
                    <Textarea id="openRoles" name="openRoles" rows={3} defaultValue={prefill?.openRoles ?? ""} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body">Narrative</Label>
                  <Textarea
                    id="body"
                    name="body"
                    rows={5}
                    defaultValue={thisMonth?.body ?? ""}
                    placeholder="Morale, org changes, key-person notes, hiring market."
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Save team update</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Every monthly update, in one consistent format.</CardDescription>
          </CardHeader>
          <CardContent>
            {updates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team updates yet.</p>
            ) : (
              <ol className="space-y-6">
                {updates.map(({ u, authorName, authorEmail }) => (
                  <li key={u.id} className="border-l-2 border-brand-teal/40 pl-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{formatPeriod(u.period)}</span>
                        {u.headcount != null ? (
                          <span className="text-xs text-muted-foreground">headcount {u.headcount}</span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">{authorName ?? authorEmail}</span>
                      </div>
                      {manager ? (
                        <form action={deleteTeamUpdate}>
                          <input type="hidden" name="id" value={u.id} />
                          <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive">
                            Delete
                          </Button>
                        </form>
                      ) : null}
                    </div>
                    {u.headline ? <p className="mt-1 text-sm font-medium">{u.headline}</p> : null}
                    {u.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{u.body}</p> : null}
                    <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      {u.hires ? (
                        <div>
                          <span className="font-medium text-foreground">Hires:</span> {u.hires}
                        </div>
                      ) : null}
                      {u.departures ? (
                        <div>
                          <span className="font-medium text-foreground">Departures:</span> {u.departures}
                        </div>
                      ) : null}
                      {u.openRoles ? (
                        <div>
                          <span className="font-medium text-foreground">Open roles:</span> {u.openRoles}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
