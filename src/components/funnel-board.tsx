// Customer-funnel display: stage bars for the current month with
// month-over-month movement, plus the velocity table — stage-to-stage
// conversion computed across prior reports' funnel snapshots. When the
// HubSpot sync is live, a provenance badge and actual time-in-stage numbers
// (from CRM stage-entry/exit timestamps) join the monthly-count velocity.

import { ArrowDownRight, ArrowRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtUSD } from "@/lib/finance";
import { FUNNEL_PATH, FUNNEL_STAGE_LABELS, type FunnelStage } from "@/lib/funnel";
import type { FunnelMeta, FunnelSeries } from "@/lib/financial-report";
import { fmtMonthString } from "@/lib/financial-report";

function fmtSynced(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function FunnelBoard({ series, meta }: { series: FunnelSeries; meta?: FunnelMeta }) {
  const n = series.months.length;
  if (n === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No funnel data yet. Connect HubSpot (HUBSPOT_ACCESS_TOKEN) for a live pipeline, or include a sheet with
        pipeline stages (Leads, Qualified, Proposal, Negotiation, Closed won…) in the monthly pack and it will be
        picked up automatically.
      </p>
    );
  }

  const cur = n - 1;
  const prev = n - 2;
  const stages = FUNNEL_PATH;
  const curCounts = stages.map((s) => series.countsByStage.get(s)?.[cur] ?? null);
  const maxCount = Math.max(...curCounts.map((c) => c ?? 0), 1);

  return (
    <div className="space-y-6">
      {/* Stage bars, latest month */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {fmtMonthString(series.months[cur])}
            {prev >= 0 ? ` · vs ${fmtMonthString(series.months[prev])}` : ""}
          </p>
          {meta?.live ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-teal/40 bg-brand-teal/10 px-2 py-0.5 text-xs font-medium text-brand-navy">
              <RefreshCw className="h-3 w-3" />
              Live from HubSpot{meta.syncedAt ? ` · synced ${fmtSynced(meta.syncedAt)}` : ""}
            </span>
          ) : null}
        </div>
        <div className="space-y-1.5">
          {stages.map((stage, i) => {
            const count = series.countsByStage.get(stage)?.[cur] ?? null;
            const prevCount = prev >= 0 ? (series.countsByStage.get(stage)?.[prev] ?? null) : null;
            const value = series.valuesByStage.get(stage)?.[cur] ?? null;
            const d = count != null && prevCount != null ? count - prevCount : null;
            const width = count != null ? Math.max((count / maxCount) * 100, 4) : 0;
            return (
              <div key={stage} className="flex items-center gap-3">
                <div className="w-24 shrink-0 text-sm">{FUNNEL_STAGE_LABELS[stage]}</div>
                <div className="relative h-7 flex-1 overflow-hidden rounded-sm bg-secondary">
                  {count != null ? (
                    <div
                      className="flex h-full items-center rounded-sm px-2 text-xs font-semibold text-white"
                      style={{
                        width: `${width}%`,
                        background: i === stages.length - 1 ? "#1A3569" : "#3FABBD",
                        opacity: 1 - i * 0.08,
                      }}
                    >
                      {count}
                    </div>
                  ) : (
                    <div className="flex h-full items-center px-2 text-xs text-muted-foreground">—</div>
                  )}
                </div>
                <div className="w-32 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {value != null && value > 0 ? fmtUSD(value, { compact: true }) : ""}
                </div>
                <div className="w-20 shrink-0 text-right text-xs">
                  {d != null && d !== 0 ? (
                    <span className={cn("inline-flex items-center gap-0.5 font-medium", d > 0 ? "text-emerald-700" : "text-red-700")}>
                      {d > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {d > 0 ? "+" : ""}
                      {d}
                    </span>
                  ) : d === 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                      <ArrowRight className="h-3 w-3" /> 0
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Velocity: stage-to-stage conversion across reports */}
      {n >= 2 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Velocity through the funnel
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            Each cell: this month's stage count as a share of the prior month's upstream stage — how fast pipeline is
            converting, comparable report to report.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Step</th>
                  {series.months.slice(1).map((m) => (
                    <th key={m} className="py-1.5 pr-3 text-right font-medium">
                      {fmtMonthString(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {series.velocity.map((step) => (
                  <tr key={`${step.from}-${step.to}`}>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {FUNNEL_STAGE_LABELS[step.from]} → {FUNNEL_STAGE_LABELS[step.to]}
                    </td>
                    {step.rates.map((r, i) => {
                      const prevRate = i > 0 ? step.rates[i - 1] : null;
                      const faster = r != null && prevRate != null ? r > prevRate : null;
                      return (
                        <td key={i} className="py-1.5 pr-3 text-right tabular-nums">
                          {r != null ? (
                            <span className={cn(i === step.rates.length - 1 && "font-semibold", faster === true && "text-emerald-700", faster === false && "text-red-700")}>
                              {r}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Velocity needs at least two months of funnel data — it will appear from the second monthly report onward.
        </p>
      )}

      {/* Actual time-in-stage from CRM stage timestamps (HubSpot sync only) */}
      {meta && meta.stageMetrics.some((m) => m.avgDaysInStage != null || m.avgOpenAgeDays != null) ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Actual time in stage
          </p>
          <p className="mb-2 text-xs text-muted-foreground">
            From HubSpot's stage-entry/exit timestamps: how long deals that moved on actually spent in each stage,
            and how long the deals sitting there now have been waiting.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Stage</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Avg days to move on</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Deals moved</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Open deals' current age</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Open deals</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {FUNNEL_PATH.filter((s) => s !== "CLOSED_WON").map((stage) => {
                  const m = meta.stageMetrics.find((x) => x.stage === stage);
                  if (!m) return null;
                  // An open cohort noticeably older than the historical pace
                  // is stalling pipeline — flag it.
                  const stalling =
                    m.avgOpenAgeDays != null && m.avgDaysInStage != null && m.avgOpenAgeDays > m.avgDaysInStage * 1.5;
                  return (
                    <tr key={stage}>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{FUNNEL_STAGE_LABELS[stage]}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        {m.avgDaysInStage != null ? `${Math.round(m.avgDaysInStage)}d` : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{m.completedCount}</td>
                      <td className={cn("py-1.5 pr-3 text-right tabular-nums", stalling && "font-semibold text-amber-700")}>
                        {m.avgOpenAgeDays != null ? `${Math.round(m.avgOpenAgeDays)}d` : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">{m.openCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
