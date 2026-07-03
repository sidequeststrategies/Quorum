import Link from "next/link";
import { count, desc, eq, inArray } from "drizzle-orm";
import { CalendarDays, FileSpreadsheet, FileText, LineChart, Plus, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { financialDocuments, financialPlans, financialScenarios } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { financialSummaryLines, fmtUSD } from "@/lib/finance";
import { formatDateOnly } from "@/lib/utils";
import { CashChart } from "@/components/cash-chart";
import { DeltaStat } from "@/components/delta";
import { deleteSnapshot, deleteFinancialDocument } from "@/lib/actions/financials-data";
import { FINANCIAL_DOC_LABELS } from "@/lib/financial-docs";
import { getFinancialOverview, periodToString, fmtPeriodShort } from "@/lib/financial-report";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtPeriod = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
const fmtBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export default async function FinancialsPage() {
  const { membership } = await requireMembership();
  const orgId = membership.organizationId;

  const [plans, overview, docs] = await Promise.all([
    db.select().from(financialPlans).where(eq(financialPlans.organizationId, orgId)).orderBy(desc(financialPlans.updatedAt)),
    getFinancialOverview(orgId),
    db.select().from(financialDocuments).where(eq(financialDocuments.organizationId, orgId)).orderBy(desc(financialDocuments.period), desc(financialDocuments.createdAt)),
  ]);
  const snapshots = overview.snapshots;

  // Replace per-plan scenario count with a single grouped query.
  const planIds = plans.map((p) => p.id);
  const scenarioCountRows = planIds.length
    ? await db
        .select({ planId: financialScenarios.planId, c: count() })
        .from(financialScenarios)
        .where(inArray(financialScenarios.planId, planIds))
        .groupBy(financialScenarios.planId)
    : [];
  const scenarioCountByPlan = new Map(scenarioCountRows.map((r) => [r.planId, r.c]));
  const plansWithCount = plans.map((p) => ({ ...p, scenarioCount: scenarioCountByPlan.get(p.id) ?? 0 }));

  const isManager = canManage(membership.role);

  // Charts: derive from snapshots
  const cashCurve = snapshots.map((s) => s.cash);
  const arrCurve = snapshots.map((s) => s.arr);
  const headcountCurve = snapshots.map((s) => s.headcount);
  const periodLabels = snapshots.map((s) => fmtPeriod(s.period));
  const latest = snapshots[snapshots.length - 1];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financials</h1>
          <p className="text-muted-foreground">
            Monthly snapshots, source documents, and forward-looking scenarios.
          </p>
        </div>
        {isManager ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/financials/uploads/new">
                <Upload className="mr-1 h-4 w-4" />
                Upload document
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/financials/snapshots/new">
                <Plus className="mr-1 h-4 w-4" />
                Add monthly snapshot
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/financials/new">
                <LineChart className="mr-1 h-4 w-4" />
                New scenario plan
              </Link>
            </Button>
            <Button asChild>
              <Link href="/financials/reports/new">
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                New monthly report
              </Link>
            </Button>
          </div>
        ) : null}
      </div>

      {/* Delta dashboard: latest month vs prior */}
      {latest ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-xl font-semibold tracking-tight">
              {fmtPeriod(latest.period)} vs {overview.previous ? fmtPeriod(overview.previous.period) : "prior month"}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {overview.deltas.map((d) => (
              <DeltaStat key={d.key} d={d} sinceLabel="vs prior month" noPriorLabel="no prior month" />
            ))}
          </div>
          {overview.callouts.length > 0 ? (
            <Card className="mt-4 border-l-4 border-l-brand-teal">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Delta callouts</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-sm">
                  {overview.callouts.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {/* Monthly reports */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly reports</CardTitle>
          <CardDescription>
            One report per calendar month, generated from that month's uploaded board financial pack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {overview.reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No monthly reports yet.{" "}
              {isManager ? (
                <>
                  <Link href="/financials/reports/new" className="underline underline-offset-2">
                    Upload the first board financial pack
                  </Link>{" "}
                  to generate one.
                </>
              ) : (
                "They'll appear here once the first pack is uploaded."
              )}
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {overview.reports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/financials/reports/${periodToString(r.period)}`}
                    className="flex items-start gap-3 rounded-md border p-4 hover:bg-accent"
                  >
                    <CalendarDays className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{fmtPeriodShort(r.period)}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {r.sourceDocument ? r.sourceDocument.filename : "no source file"} · created {formatDateOnly(r.createdAt)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pro forma & modeling */}
      <Card>
        <CardHeader>
          <CardTitle>Pro forma &amp; scenario modeling</CardTitle>
          <CardDescription>
            The company's forward model, interactive: adjust assumptions with sliders, watch the P&amp;L and cash
            position recompute, and stress-test with sensitivity analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/financials/proforma">
              <SlidersHorizontal className="mr-1 h-4 w-4" />
              Open the modeling workbench
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Auto-computed report summary */}
      {latest ? <AutoSummary snapshots={snapshots} /> : null}

      {/* Snapshots time-series chart */}
      {snapshots.length >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Trend lines</CardTitle>
            <CardDescription>{snapshots.length} months of actuals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="mb-1 text-sm font-medium">Cash on hand</h4>
              <CashChart curves={[{ name: "Cash", color: "#3FABBD", values: cashCurve }]} height={180} />
            </div>
            <div>
              <h4 className="mb-1 text-sm font-medium">ARR</h4>
              <CashChart curves={[{ name: "ARR", color: "#285FAF", values: arrCurve }]} height={180} />
            </div>
            <div>
              <h4 className="mb-1 text-sm font-medium">Headcount</h4>
              <CashChart curves={[{ name: "Headcount", color: "#1A3569", values: headcountCurve }]} height={140} />
            </div>
            <div className="text-xs text-muted-foreground">
              Periods: {periodLabels[0]} → {periodLabels[periodLabels.length - 1]}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Snapshots list */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly snapshots</CardTitle>
          <CardDescription>{snapshots.length} recorded</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No snapshots yet. {isManager ? "Add your first month to start the time-series." : "Once your finance team adds them, they'll show up here."}
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-3 font-semibold">Period</th>
                  <th className="py-2 pr-3 text-right font-semibold">Cash</th>
                  <th className="py-2 pr-3 text-right font-semibold">ARR</th>
                  <th className="py-2 pr-3 text-right font-semibold">MRR</th>
                  <th className="py-2 pr-3 text-right font-semibold">GM%</th>
                  <th className="py-2 pr-3 text-right font-semibold">Net burn</th>
                  <th className="py-2 pr-3 text-right font-semibold">HC</th>
                  <th className="py-2 pr-3 text-right font-semibold">AR</th>
                  <th className="py-2 pr-3 text-right font-semibold">AP</th>
                  {isManager ? <th /> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...snapshots].reverse().map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-3 font-medium">{fmtPeriod(s.period)}</td>
                    <td className="py-2 pr-3 text-right">{fmtUSD(s.cash, { compact: true })}</td>
                    <td className="py-2 pr-3 text-right">{fmtUSD(s.arr, { compact: true })}</td>
                    <td className="py-2 pr-3 text-right">{fmtUSD(s.mrr, { compact: true })}</td>
                    <td className="py-2 pr-3 text-right">{s.grossMargin}%</td>
                    <td className={`py-2 pr-3 text-right ${s.burn > 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmtUSD(s.burn, { compact: true })}</td>
                    <td className="py-2 pr-3 text-right">{s.headcount}</td>
                    <td className="py-2 pr-3 text-right">{fmtUSD(s.accountsReceivable, { compact: true })}</td>
                    <td className="py-2 pr-3 text-right">{fmtUSD(s.accountsPayable, { compact: true })}</td>
                    {isManager ? (
                      <td className="py-2 pr-3 text-right">
                        <form action={deleteSnapshot}>
                          <input type="hidden" name="id" value={s.id} />
                          <Button type="submit" variant="ghost" size="icon" aria-label="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Source documents */}
      <Card>
        <CardHeader>
          <CardTitle>Source documents</CardTitle>
          <CardDescription>{docs.length} uploaded — balance sheets, P&Ls, AR/AP, pro forma, headcount, etc.</CardDescription>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No financial documents uploaded yet.</p>
          ) : (
            <ul className="divide-y">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md border bg-background p-2">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{FINANCIAL_DOC_LABELS[d.kind] ?? d.kind}</Badge>
                        <span className="text-sm font-medium">{d.title}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {fmtPeriod(d.period)} · {d.filename} · {fmtBytes(d.sizeBytes)} · uploaded {formatDateOnly(d.createdAt)}
                      </div>
                      {d.description ? <p className="mt-1 text-xs text-muted-foreground">{d.description}</p> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <a href={d.storagePath} target="_blank" rel="noreferrer" download={d.filename}>
                        Download
                      </a>
                    </Button>
                    {isManager ? (
                      <form action={deleteFinancialDocument}>
                        <input type="hidden" name="id" value={d.id} />
                        <Button type="submit" variant="ghost" size="icon" aria-label="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Scenario plans */}
      <Card>
        <CardHeader>
          <CardTitle>Forward-looking scenarios</CardTitle>
          <CardDescription>Multi-scenario projections for board strategy discussions.</CardDescription>
        </CardHeader>
        <CardContent>
          {plansWithCount.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plans yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {plansWithCount.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/financials/${p.id}`}
                    className="flex items-start gap-3 rounded-md border p-4 hover:bg-accent"
                  >
                    <LineChart className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{p.name}</div>
                      {p.description ? (
                        <div className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{p.description}</div>
                      ) : null}
                      <div className="mt-2 text-xs text-muted-foreground">
                        {p.scenarioCount} scenario{p.scenarioCount === 1 ? "" : "s"} · starts {formatDateOnly(p.startMonth)} · {p.horizonMonths} mo horizon · {fmtUSD(p.startingCash, { compact: true })} cash
                      </div>
                    </div>
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

// Plain-English summary a director can read in ten seconds — computed, so
// it's always consistent with the numbers above it.
function AutoSummary({ snapshots }: { snapshots: import("@/db/schema").FinancialSnapshot[] }) {
  const lines = financialSummaryLines(snapshots);
  if (lines.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-brand-teal">
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report summary</p>
        <ul className="mt-1.5 space-y-0.5 text-sm">
          {lines.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
