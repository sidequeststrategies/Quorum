// Customer-funnel display: stage bars for the current month with
// month-over-month movement, plus the velocity table — stage-to-stage
// conversion computed across prior reports' funnel snapshots.

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtUSD } from "@/lib/finance";
import { FUNNEL_PATH, FUNNEL_STAGE_LABELS, type FunnelStage } from "@/lib/funnel";
import type { FunnelSeries } from "@/lib/financial-report";
import { fmtMonthString } from "@/lib/financial-report";

export function FunnelBoard({ series }: { series: FunnelSeries }) {
  const n = series.months.length;
  if (n === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No funnel data yet. Include a sheet with pipeline stages (Leads, Qualified, Proposal, Negotiation, Closed won…)
        in the monthly pack and it will be picked up automatically.
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
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {fmtMonthString(series.months[cur])}
          {prev >= 0 ? ` · vs ${fmtMonthString(series.months[prev])}` : ""}
        </p>
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
    </div>
  );
}
