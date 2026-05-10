import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { financialPlans, financialScenarios } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { fmtUSD, projectScenario, type ScenarioAssumptions } from "@/lib/finance";
import { formatDateOnly } from "@/lib/utils";
import { CashChart, Sparkline } from "@/components/cash-chart";

const SCENARIO_COLORS: Record<string, string> = {
  BASE: "#0ea5e9",
  UPSIDE: "#10b981",
  DOWNSIDE: "#ef4444",
  CUSTOM: "#a855f7",
};

export default async function FinancialPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();

  const planRows = await db
    .select()
    .from(financialPlans)
    .where(and(eq(financialPlans.id, id), eq(financialPlans.organizationId, membership.organizationId)))
    .limit(1);
  const plan = planRows[0];
  if (!plan) notFound();

  const scenarios = await db
    .select()
    .from(financialScenarios)
    .where(eq(financialScenarios.planId, plan.id))
    .orderBy(asc(financialScenarios.kind), asc(financialScenarios.createdAt));

  const projections = scenarios.map((s) => {
    let a: ScenarioAssumptions;
    try {
      a = JSON.parse(s.assumptions) as ScenarioAssumptions;
    } catch {
      a = {} as ScenarioAssumptions;
    }
    const summary = projectScenario(plan.startingCash, plan.startMonth, plan.horizonMonths, a);
    return { scenario: s, summary, assumptions: a };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{plan.name}</h1>
          {plan.description ? <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p> : null}
          <p className="mt-2 text-sm text-muted-foreground">
            Starts {formatDateOnly(plan.startMonth)} · {plan.horizonMonths} month horizon · {fmtUSD(plan.startingCash)} starting cash
          </p>
        </div>
        {canManage(membership.role) ? (
          <Button asChild>
            <Link href={`/financials/${plan.id}/scenarios/new`}>
              <Plus className="mr-1 h-4 w-4" />
              New scenario
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cash trajectory</CardTitle>
          <CardDescription>Ending cash by month across all scenarios.</CardDescription>
        </CardHeader>
        <CardContent>
          <CashChart
            curves={projections.map((p) => ({
              name: p.scenario.name,
              color: SCENARIO_COLORS[p.scenario.kind] ?? "#64748b",
              values: p.summary.rows.map((r) => r.endingCash),
            }))}
            height={280}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scenario comparison</CardTitle>
          <CardDescription>Side-by-side outcomes across the horizon.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-4 font-semibold">Metric</th>
                {projections.map(({ scenario }) => (
                  <th key={scenario.id} className="py-2 pr-4 font-semibold">
                    <div>{scenario.name}</div>
                    <Badge
                      variant={
                        scenario.kind === "BASE"
                          ? "default"
                          : scenario.kind === "UPSIDE"
                          ? "success"
                          : scenario.kind === "DOWNSIDE"
                          ? "destructive"
                          : "secondary"
                      }
                      className="mt-1"
                    >
                      {scenario.kind}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2 pr-4 text-muted-foreground">Cash trajectory</td>
                {projections.map(({ scenario, summary }) => (
                  <td key={scenario.id} className="py-2 pr-4">
                    <Sparkline
                      values={summary.rows.map((r) => r.endingCash)}
                      color={SCENARIO_COLORS[scenario.kind] ?? "#64748b"}
                      width={120}
                      height={28}
                    />
                  </td>
                ))}
              </tr>
              <Row
                label="Ending cash"
                vals={projections.map((p) => fmtUSD(p.summary.endingCash, { compact: true }))}
              />
              <Row label="Ending ARR" vals={projections.map((p) => fmtUSD(p.summary.endingARR, { compact: true }))} />
              <Row label="Ending MRR" vals={projections.map((p) => fmtUSD(p.summary.endingMRR, { compact: true }))} />
              <Row
                label="Runway (months)"
                vals={projections.map((p) =>
                  p.summary.runwayMonths === null ? `> ${plan.horizonMonths}` : String(p.summary.runwayMonths)
                )}
              />
              <Row
                label="Breakeven month"
                vals={projections.map((p) =>
                  p.summary.breakevenMonth === null ? "—" : `Month ${p.summary.breakevenMonth}`
                )}
              />
              <Row
                label="Max cash drawdown"
                vals={projections.map((p) => fmtUSD(p.summary.totalCashUsed, { compact: true }))}
              />
            </tbody>
          </table>
        </CardContent>
      </Card>

      {projections.map(({ scenario, summary, assumptions }) => (
        <Card key={scenario.id}>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>
                <Link href={`/financials/${plan.id}/scenarios/${scenario.id}`} className="hover:underline">
                  {scenario.name}
                </Link>{" "}
                <Badge variant="outline" className="ml-2 align-middle">
                  {scenario.kind}
                </Badge>
              </CardTitle>
              {scenario.notes ? <CardDescription className="mt-1">{scenario.notes}</CardDescription> : null}
            </div>
            {canManage(membership.role) ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/financials/${plan.id}/scenarios/${scenario.id}`}>Edit</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <Stat label="Starting MRR" value={fmtUSD(assumptions.startingMRR ?? 0)} />
              <Stat label="MoM growth" value={`${assumptions.monthlyGrowthPct ?? 0}%`} />
              <Stat label="Churn" value={`${assumptions.churnPct ?? 0}%`} />
              <Stat label="Gross margin" value={`${assumptions.grossMarginPct ?? 0}%`} />
              <Stat label="Monthly fixed opex" value={fmtUSD(assumptions.monthlyOpexBase ?? 0)} />
              <Stat label="Headcount" value={`${assumptions.headcountStart ?? 0} → +${assumptions.monthlyHires ?? 0}/mo`} />
            </div>

            <details className="rounded-md border">
              <summary className="cursor-pointer p-3 text-sm font-medium">Monthly projection</summary>
              <div className="overflow-x-auto p-3 pt-0">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-1.5 pr-3">Month</th>
                      <th className="py-1.5 pr-3 text-right">MRR</th>
                      <th className="py-1.5 pr-3 text-right">Revenue</th>
                      <th className="py-1.5 pr-3 text-right">Gross profit</th>
                      <th className="py-1.5 pr-3 text-right">Headcount</th>
                      <th className="py-1.5 pr-3 text-right">Total opex</th>
                      <th className="py-1.5 pr-3 text-right">Net burn</th>
                      <th className="py-1.5 pr-3 text-right">Ending cash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.rows.map((r) => (
                      <tr key={r.month}>
                        <td className="py-1.5 pr-3 font-medium">{r.monthLabel}</td>
                        <td className="py-1.5 pr-3 text-right">{fmtUSD(r.mrr, { compact: true })}</td>
                        <td className="py-1.5 pr-3 text-right">{fmtUSD(r.revenue, { compact: true })}</td>
                        <td className="py-1.5 pr-3 text-right">{fmtUSD(r.grossProfit, { compact: true })}</td>
                        <td className="py-1.5 pr-3 text-right">{r.headcount}</td>
                        <td className="py-1.5 pr-3 text-right">{fmtUSD(r.totalOpex, { compact: true })}</td>
                        <td
                          className={`py-1.5 pr-3 text-right ${r.netBurn < 0 ? "text-rose-600" : "text-emerald-600"}`}
                        >
                          {fmtUSD(r.netBurn, { compact: true })}
                        </td>
                        <td className={`py-1.5 pr-3 text-right ${r.endingCash < 0 ? "text-rose-600" : ""}`}>
                          {fmtUSD(r.endingCash, { compact: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Row({ label, vals }: { label: string; vals: string[] }) {
  return (
    <tr>
      <td className="py-2 pr-4 text-muted-foreground">{label}</td>
      {vals.map((v, i) => (
        <td key={i} className="py-2 pr-4 font-medium">
          {v}
        </td>
      ))}
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
