// The interactive monthly financial report: one page per calendar month,
// generated from that month's uploaded board pack. Sections: delta dashboard,
// cash flow & position, revenue & forecast, gross margin, headcount &
// forecast, key customer status, customer funnel & velocity, scenarios.

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, LineChart, Trash2, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireMembership, canManage } from "@/lib/session";
import { getMonthlyReportData, fmtMonthString } from "@/lib/financial-report";
import { deleteMonthlyReportAction } from "@/lib/actions/financial-reports";
import { DeltaStat } from "@/components/delta";
import { TrendChart } from "@/components/trend-chart";
import { FunnelBoard } from "@/components/funnel-board";
import { fmtUSD } from "@/lib/finance";
import { formatDateOnly } from "@/lib/utils";

const HEALTH_STYLES: Record<string, string> = {
  GREEN: "bg-emerald-100 text-emerald-800",
  AMBER: "bg-amber-100 text-amber-800",
  RED: "bg-red-100 text-red-800",
};
const STATUS_LABELS: Record<string, string> = {
  PROSPECT: "Prospect",
  PILOT: "Pilot",
  ACTIVE: "Active",
  AT_RISK: "At risk",
  CHURNED: "Churned",
};

export default async function MonthlyReportPage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  if (!/^\d{4}-\d{2}$/.test(period)) notFound();

  const { membership } = await requireMembership();
  const data = await getMonthlyReportData(membership.organizationId, period);
  if (!data) notFound();

  const isManager = canManage(membership.role);
  const monthLabel = fmtMonthString(period);
  const { forecast } = data;
  const hasForecast = forecast.months.length > forecast.actualCount;

  const curve = (field: Parameters<typeof forecast.byField.get>[0]) => forecast.byField.get(field) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/financials" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Financials
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Financial report — {monthLabel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Created {formatDateOnly(data.report.createdAt)}
            {data.report.sourceDocument ? (
              <>
                {" · from "}
                <a href={data.report.sourceDocument.storagePath} download={data.report.sourceDocument.filename} className="underline underline-offset-2 hover:text-foreground">
                  {data.report.sourceDocument.filename}
                </a>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.prevReportPeriod ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/financials/reports/${data.prevReportPeriod}`}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {fmtMonthString(data.prevReportPeriod)}
              </Link>
            </Button>
          ) : null}
          {data.nextReportPeriod ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/financials/reports/${data.nextReportPeriod}`}>
                {fmtMonthString(data.nextReportPeriod)}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          {data.report.sourceDocument ? (
            <Button asChild variant="outline" size="sm">
              <a href={data.report.sourceDocument.storagePath} download={data.report.sourceDocument.filename}>
                <Download className="mr-1 h-4 w-4" /> Pack
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Delta dashboard */}
      <section>
        <SectionTitle title="Key metrics vs prior month" />
        {data.deltas.length > 0 ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.deltas.map((d) => (
                <DeltaStat key={d.key} d={d} sinceLabel="vs prior month" noPriorLabel="no prior month" />
              ))}
            </div>
            {data.callouts.length > 0 ? (
              <Card className="mt-4 border-l-4 border-l-brand-teal">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Callouts</p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-sm">
                    {data.callouts.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No snapshot recorded for {monthLabel} yet.</p>
        )}
      </section>

      {/* Cash */}
      <section>
        <SectionTitle title="Cash flow & cash position" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cash position</CardTitle>
              <CardDescription>{hasForecast ? "Actuals with the pack's forward forecast (dashed)." : "Trailing actuals."}</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart months={forecast.months} curves={[{ name: "Cash", color: "#3FABBD", values: curve("cash") }]} actualCount={forecast.actualCount} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Net burn</CardTitle>
              <CardDescription>Positive = cash consumed in the month.</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart months={forecast.months} curves={[{ name: "Net burn", color: "#e11d48", values: curve("burn") }]} actualCount={forecast.actualCount} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Revenue & forecast */}
      <section>
        <SectionTitle title="Revenue & forecast" />
        <Card>
          <CardContent className="pt-6">
            <TrendChart
              months={forecast.months}
              curves={[
                { name: "Revenue / mo", color: "#285FAF", values: curve("revenue") },
                { name: "MRR", color: "#3FABBD", values: curve("mrr") },
              ]}
              actualCount={forecast.actualCount}
            />
            {data.snapshot ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <MiniStat label="Revenue this month" value={fmtUSD(data.snapshot.revenue, { compact: true })} />
                <MiniStat label="MRR" value={fmtUSD(data.snapshot.mrr, { compact: true })} />
                <MiniStat label="ARR" value={fmtUSD(data.snapshot.arr, { compact: true })} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* Gross margin */}
      <section>
        <SectionTitle title="Gross margin" />
        <Card>
          <CardContent className="pt-6">
            <TrendChart
              months={forecast.months}
              curves={[{ name: "Gross margin %", color: "#1A3569", values: curve("grossMargin") }]}
              actualCount={forecast.actualCount}
              money={false}
              pct
              height={170}
            />
          </CardContent>
        </Card>
      </section>

      {/* Headcount */}
      <section>
        <SectionTitle title="Headcount & forecast" />
        <Card>
          <CardContent className="pt-6">
            <TrendChart
              months={forecast.months}
              curves={[{ name: "Headcount", color: "#1A3569", values: curve("headcount") }]}
              actualCount={forecast.actualCount}
              money={false}
              height={170}
            />
          </CardContent>
        </Card>
      </section>

      {/* Key customers */}
      <section>
        <div className="flex items-center justify-between">
          <SectionTitle title="Key customer status" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/customers">
              <Users className="mr-1 h-4 w-4" /> All customers
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            {data.keyCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No customers on file yet — add them under <Link href="/customers" className="underline">Customers</Link> and
                their monthly health will appear here.
              </p>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Customer</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 text-right font-medium">ARR</th>
                    <th className="py-2 pr-3 font-medium">Health ({monthLabel})</th>
                    <th className="py-2 pr-3 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.keyCustomers.map(({ customer, update }) => (
                    <tr key={customer.id}>
                      <td className="py-2 pr-3">
                        <Link href={`/customers/${customer.id}`} className="font-medium hover:underline">
                          {customer.name}
                        </Link>
                        {customer.segment ? <span className="block text-xs text-muted-foreground">{customer.segment}</span> : null}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant={customer.status === "AT_RISK" ? "destructive" : "outline"}>
                          {STATUS_LABELS[customer.status] ?? customer.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{customer.arr > 0 ? fmtUSD(customer.arr, { compact: true }) : "—"}</td>
                      <td className="py-2 pr-3">
                        {update ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_STYLES[update.health] ?? ""}`}>{update.health}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">no update</span>
                        )}
                      </td>
                      <td className="max-w-md py-2 pr-3 text-xs text-muted-foreground">{update?.note || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Funnel */}
      <section>
        <SectionTitle title="Customer funnel & velocity" />
        <Card>
          <CardContent className="pt-6">
            <FunnelBoard series={data.funnel} meta={data.funnelMeta} />
          </CardContent>
        </Card>
      </section>

      {/* Scenarios */}
      <section>
        <div className="flex items-center justify-between">
          <SectionTitle title="Scenarios" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/financials/new">
              <LineChart className="mr-1 h-4 w-4" /> New scenario plan
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            {data.plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No scenario plans yet. Create one to model base/upside/downside cases from the latest actuals.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.plans.map((p) => (
                  <li key={p.id}>
                    <Link href={`/financials/${p.id}`} className="flex items-start gap-3 rounded-md border p-4 hover:bg-accent">
                      <LineChart className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <div className="font-medium">{p.name}</div>
                        {p.description ? <div className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{p.description}</div> : null}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {p.scenarioCount} scenario{p.scenarioCount === 1 ? "" : "s"} · {p.horizonMonths} mo horizon ·{" "}
                          {fmtUSD(p.startingCash, { compact: true })} starting cash
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Placeholder for future components */}
      <section>
        <Card className="border-dashed">
          <CardContent className="p-6 text-sm text-muted-foreground">
            More sections coming — this report is modular, so new components (e.g. AR/AP aging, cohort retention,
            forecast-vs-actual review) slot in per month without restructuring.
          </CardContent>
        </Card>
      </section>

      {isManager ? (
        <form action={deleteMonthlyReportAction} className="flex justify-end">
          <input type="hidden" name="id" value={data.report.id} />
          <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="mr-1 h-4 w-4" /> Delete this report (keeps actuals)
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-3 text-xl font-semibold tracking-tight">{title}</h2>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-bold">{value}</div>
    </div>
  );
}
