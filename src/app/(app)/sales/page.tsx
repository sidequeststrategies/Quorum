import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/db";
import { gtmUpdates, users } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { deleteGtmUpdate, saveGtmUpdate } from "@/lib/actions/updates";
import { TrendBars } from "@/components/metric-charts";
import { currentPeriodString, formatPeriod } from "@/lib/utils";
import { fmtUSD } from "@/lib/finance";

export default async function SalesPage() {
  const { membership } = await requireMembership();

  const updates = await db
    .select({ u: gtmUpdates, authorName: users.name, authorEmail: users.email })
    .from(gtmUpdates)
    .leftJoin(users, eq(gtmUpdates.authorId, users.id))
    .where(eq(gtmUpdates.organizationId, membership.organizationId))
    .orderBy(desc(gtmUpdates.period));

  const manager = canManage(membership.role);
  const latest = updates[0]?.u;
  const thisMonth = updates.find((x) => formatPeriod(x.u.period) === formatPeriod(new Date()))?.u;
  const trend = [...updates]
    .reverse()
    .slice(-8)
    .map(({ u }) => ({
      label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(u.period)),
      value: u.pipelineValue,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sales & go-to-market</h1>
        <p className="text-muted-foreground">Pipeline, wins, and the GTM narrative — one entry per month.</p>
      </div>

      {latest ? (
        <div className="grid gap-4 sm:grid-cols-5">
          <Kpi label="Pipeline" value={fmtUSD(latest.pipelineValue, { compact: true })} />
          <Kpi label="Qualified leads" value={String(latest.qualifiedLeads)} />
          <Kpi label="New wins" value={String(latest.newWins)} />
          <Kpi label="Lost deals" value={String(latest.lostDeals)} />
          <Kpi label="New ARR" value={fmtUSD(latest.newArr, { compact: true })} />
        </div>
      ) : null}

      {trend.length >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pipeline trend</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendBars points={trend} />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {manager ? (
          <Card>
            <CardHeader>
              <CardTitle>{thisMonth ? "Edit this month" : "This month's update"}</CardTitle>
              <CardDescription>
                {thisMonth ? "Already drafted — edits overwrite the same entry." : "Numbers first, then the story behind them."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={saveGtmUpdate} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2 sm:col-span-1">
                    <Label htmlFor="period">Period</Label>
                    <Input id="period" name="period" type="month" defaultValue={currentPeriodString()} required />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="headline">Headline</Label>
                    <Input id="headline" name="headline" defaultValue={thisMonth?.headline ?? ""} placeholder="One-line GTM summary" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-5">
                  <NumField name="pipelineValue" label="Pipeline ($)" defaultValue={thisMonth?.pipelineValue ?? latest?.pipelineValue ?? 0} />
                  <NumField name="qualifiedLeads" label="Qualified leads" defaultValue={thisMonth?.qualifiedLeads ?? 0} />
                  <NumField name="newWins" label="New wins" defaultValue={thisMonth?.newWins ?? 0} />
                  <NumField name="lostDeals" label="Lost deals" defaultValue={thisMonth?.lostDeals ?? 0} />
                  <NumField name="newArr" label="New ARR ($)" defaultValue={thisMonth?.newArr ?? 0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body">Narrative</Label>
                  <Textarea
                    id="body"
                    name="body"
                    rows={5}
                    defaultValue={thisMonth?.body ?? ""}
                    placeholder="Key deals in motion, channel/partner moves, pricing, competitive notes."
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Save GTM update</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            {updates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No GTM updates yet.</p>
            ) : (
              <ol className="space-y-6">
                {updates.map(({ u, authorName, authorEmail }) => (
                  <li key={u.id} className="border-l-2 border-brand-teal/40 pl-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{formatPeriod(u.period)}</span>
                        <span className="text-xs text-muted-foreground">
                          {fmtUSD(u.pipelineValue, { compact: true })} pipeline · {u.newWins} wins ·{" "}
                          {fmtUSD(u.newArr, { compact: true })} new ARR
                        </span>
                        <span className="text-xs text-muted-foreground">{authorName ?? authorEmail}</span>
                      </div>
                      {manager ? (
                        <form action={deleteGtmUpdate}>
                          <input type="hidden" name="id" value={u.id} />
                          <Button type="submit" variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive">
                            Delete
                          </Button>
                        </form>
                      ) : null}
                    </div>
                    {u.headline ? <p className="mt-1 text-sm font-medium">{u.headline}</p> : null}
                    {u.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{u.body}</p> : null}
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

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function NumField({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={0} step={1} defaultValue={defaultValue} />
    </div>
  );
}
