"use client";
// Interactive pro forma: drag assumption sliders, the whole P&L and cash
// curve recompute instantly (pure math over the parsed baseline — see
// lib/proforma.ts). Includes one-at-a-time tornado sensitivity and a
// two-driver (volume × price) grid.

import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  NEUTRAL_ADJUSTMENTS,
  runProForma,
  tornado,
  sensitivityGrid,
  metricValue,
  type ProFormaAdjustments,
  type ProFormaBaseline,
  type SensitivityMetric,
} from "@/lib/proforma";

// ── formatting ───────────────────────────────────────────────────────────────

function fmtGBP(v: number, opts?: { sign?: boolean }): string {
  const sign = v < 0 ? "−" : opts?.sign && v > 0 ? "+" : "";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${sign}£${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}£${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}£${(abs / 1e3).toFixed(0)}K`;
  return `${sign}£${abs.toFixed(0)}`;
}

const LINE_COLORS = ["#3FABBD", "#285FAF", "#1A3569", "#4FC1D4", "#7C9CC9", "#9DB4D6"];

// ── slider definitions ───────────────────────────────────────────────────────

type SliderDef = {
  key: keyof Omit<ProFormaAdjustments, "grantsOn" | "lineVolumePct">;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  hint: string;
};

const SLIDER_GROUPS: { title: string; sliders: SliderDef[] }[] = [
  {
    title: "Growth & pricing",
    sliders: [
      { key: "volumePct", label: "Volume (bookings & km)", min: -50, max: 50, step: 5, unit: "%", hint: "Scales revenue and cost of sales together" },
      { key: "pricePct", label: "Pricing", min: -30, max: 30, step: 1, unit: "%", hint: "Revenue only — flows straight to margin" },
      { key: "growthDeltaPct", label: "Growth ramp", min: -5, max: 5, step: 0.5, unit: "pp/qtr", hint: "Compounds every quarter — faster or slower ramp" },
    ],
  },
  {
    title: "Costs",
    sliders: [
      { key: "cogsPct", label: "Unit costs (COGS)", min: -30, max: 30, step: 1, unit: "%", hint: "Cost of sales only" },
      { key: "staffingPct", label: "Staffing costs", min: -30, max: 30, step: 1, unit: "%", hint: "The payroll overhead line (also scales headcount view)" },
      { key: "rdPct", label: "R&D spend", min: -50, max: 50, step: 5, unit: "%", hint: "Research & Development overhead" },
      { key: "otherOverheadPct", label: "Other overheads", min: -30, max: 30, step: 1, unit: "%", hint: "All remaining overhead categories" },
    ],
  },
  {
    title: "Cash",
    sliders: [
      { key: "capexPct", label: "CAPEX", min: -50, max: 50, step: 5, unit: "%", hint: "Capital expenditure programme" },
      { key: "dsoDelta", label: "Debtor days (DSO)", min: -30, max: 60, step: 5, unit: "d", hint: "Collection speed — feeds the working-capital model" },
    ],
  },
];

// ── charts (inline SVG, no deps) ─────────────────────────────────────────────

function AnnualBars({
  fys,
  baseline,
  adjusted,
  height = 190,
}: {
  fys: string[];
  baseline: number[];
  adjusted: number[];
  height?: number;
}) {
  const pad = { top: 14, right: 8, bottom: 22, left: 48 };
  const W = 640;
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const all = [...baseline, ...adjusted, 0];
  const yMin = Math.min(...all) * 1.06;
  const yMax = Math.max(...all) * 1.06 || 1;
  const y = (v: number) => pad.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const group = innerW / fys.length;
  const bw = Math.min(26, group / 3);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img">
      {[yMin, 0, yMax].filter((v, i, a) => a.indexOf(v) === i).map((tv, i) => (
        <g key={i}>
          <line x1={pad.left} y1={y(tv)} x2={W - pad.right} y2={y(tv)} stroke="hsl(var(--border))" strokeWidth={tv === 0 ? 1.5 : 1} strokeDasharray={tv === 0 ? "0" : "2 4"} />
          <text x={pad.left - 6} y={y(tv)} fontSize="9" textAnchor="end" dominantBaseline="middle" fill="hsl(var(--muted-foreground))">
            {fmtGBP(tv)}
          </text>
        </g>
      ))}
      {fys.map((fy, i) => {
        const cx = pad.left + group * i + group / 2;
        return (
          <g key={fy}>
            {/* baseline ghost */}
            <rect x={cx - bw - 2} width={bw} y={Math.min(y(0), y(baseline[i]))} height={Math.abs(y(baseline[i]) - y(0))} fill="hsl(var(--muted-foreground))" opacity="0.28" rx="2" />
            {/* adjusted */}
            <rect x={cx + 2} width={bw} y={Math.min(y(0), y(adjusted[i]))} height={Math.abs(y(adjusted[i]) - y(0))} fill={adjusted[i] >= 0 ? "#3FABBD" : "#e11d48"} rx="2" />
            <text x={cx} y={height - 8} fontSize="9" textAnchor="middle" fill="hsl(var(--muted-foreground))">
              {fy}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function CashCurve({
  quarters,
  baseline,
  adjusted,
  height = 210,
}: {
  quarters: string[];
  baseline: number[];
  adjusted: number[];
  height?: number;
}) {
  const pad = { top: 14, right: 10, bottom: 24, left: 52 };
  const W = 820;
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const all = [...baseline, ...adjusted, 0];
  const yMin = Math.min(...all) * 1.08;
  const yMax = Math.max(...all) * 1.08 || 1;
  const x = (i: number) => pad.left + (i / (quarters.length - 1)) * innerW;
  const y = (v: number) => pad.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const pts = (arr: number[]) => arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img">
      {[yMin, 0, yMax].filter((v, i, a) => a.indexOf(v) === i).map((tv, i) => (
        <g key={i}>
          <line x1={pad.left} y1={y(tv)} x2={W - pad.right} y2={y(tv)} stroke={tv === 0 ? "hsl(var(--destructive))" : "hsl(var(--border))"} strokeWidth={tv === 0 ? 1.2 : 1} strokeDasharray={tv === 0 ? "4 3" : "2 4"} />
          <text x={pad.left - 6} y={y(tv)} fontSize="9" textAnchor="end" dominantBaseline="middle" fill="hsl(var(--muted-foreground))">
            {fmtGBP(tv)}
          </text>
        </g>
      ))}
      {quarters.map((q, i) =>
        i % 4 === 0 ? (
          <text key={q} x={x(i)} y={height - 8} fontSize="9" textAnchor="middle" fill="hsl(var(--muted-foreground))">
            {q.replace("Q1 ", "")}
          </text>
        ) : null
      )}
      <polyline points={pts(baseline)} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.8" strokeDasharray="5 4" opacity="0.6" />
      <polyline points={pts(adjusted)} fill="none" stroke="#285FAF" strokeWidth="2.5" strokeLinejoin="round" />
      {(() => {
        const minI = adjusted.indexOf(Math.min(...adjusted));
        return <circle cx={x(minI)} cy={y(adjusted[minI])} r="3.5" fill={adjusted[minI] < 0 ? "#e11d48" : "#285FAF"} />;
      })()}
    </svg>
  );
}

// ── main component ───────────────────────────────────────────────────────────

export function ProFormaClient({ baseline }: { baseline: ProFormaBaseline }) {
  const [adj, setAdj] = useState<ProFormaAdjustments>(NEUTRAL_ADJUSTMENTS);
  const [metric, setMetric] = useState<SensitivityMetric>("minCash");
  const [showLines, setShowLines] = useState(false);

  const base = useMemo(() => runProForma(baseline, NEUTRAL_ADJUSTMENTS), [baseline]);
  const result = useMemo(() => runProForma(baseline, adj), [baseline, adj]);
  const torn = useMemo(() => tornado(baseline, adj, metric), [baseline, adj, metric]);

  const GRID_ROWS = { key: "pricePct" as const, values: [-15, -10, -5, 0, 5, 10, 15] };
  const GRID_COLS = { key: "volumePct" as const, values: [-30, -20, -10, 0, 10, 20, 30] };
  const grid = useMemo(() => sensitivityGrid(baseline, adj, metric, GRID_ROWS, GRID_COLS), [baseline, adj, metric]);

  const isNeutral = JSON.stringify(adj) === JSON.stringify(NEUTRAL_ADJUSTMENTS);
  const set = (key: SliderDef["key"], v: number) => setAdj((a) => ({ ...a, [key]: v }));
  const fys = result.annual.map((a) => a.fy);

  const kpi = (label: string, adjVal: string, baseVal: string, changed: boolean, danger = false) => (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-xl font-bold", danger && "text-destructive")}>{adjVal}</p>
      {changed ? <p className="mt-0.5 text-xs text-muted-foreground">model: {baseVal}</p> : null}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpi("FY28 revenue", fmtGBP(result.kpis.fy28Revenue), fmtGBP(base.kpis.fy28Revenue), !isNeutral)}
        {kpi(`${fys[fys.length - 1]} revenue`, fmtGBP(result.kpis.finalFyRevenue), fmtGBP(base.kpis.finalFyRevenue), !isNeutral)}
        {kpi("EBITDA breakeven", result.kpis.ebitdaBreakevenQuarter ?? "beyond horizon", base.kpis.ebitdaBreakevenQuarter ?? "beyond horizon", !isNeutral, result.kpis.ebitdaBreakevenQuarter == null)}
        {kpi(`Cash trough (${result.kpis.minCashQuarter})`, fmtGBP(result.kpis.minCash), fmtGBP(base.kpis.minCash), !isNeutral, result.kpis.minCash < 0)}
        {kpi("Extra funding needed", result.kpis.fundingGap > 0 ? fmtGBP(result.kpis.fundingGap) : "none", base.kpis.fundingGap > 0 ? fmtGBP(base.kpis.fundingGap) : "none", !isNeutral, result.kpis.fundingGap > 0)}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Sliders */}
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Assumptions</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setAdj(NEUTRAL_ADJUSTMENTS)} disabled={isNeutral}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
              </Button>
            </div>
            <CardDescription>Deltas on top of the uploaded model.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {SLIDER_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</p>
                <div className="space-y-3">
                  {group.sliders.map((s) => {
                    const v = adj[s.key] as number;
                    return (
                      <div key={s.key}>
                        <div className="flex items-baseline justify-between">
                          <label className="text-sm" title={s.hint}>
                            {s.label}
                          </label>
                          <span className={cn("text-sm font-semibold tabular-nums", v !== 0 && (v > 0 ? "text-emerald-700" : "text-red-700"))}>
                            {v > 0 ? "+" : ""}
                            {v}
                            {s.unit}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={s.min}
                          max={s.max}
                          step={s.step}
                          value={v}
                          onChange={(e) => set(s.key, Number(e.target.value))}
                          className="w-full accent-[#3FABBD]"
                          aria-label={s.label}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={adj.grantsOn} onChange={(e) => setAdj((a) => ({ ...a, grantsOn: e.target.checked }))} className="accent-[#3FABBD]" />
                Include grant income ({fmtGBP(baseline.grants.reduce((s, g) => s + g, 0))})
              </label>
            </div>

            <div>
              <button type="button" onClick={() => setShowLines((s) => !s)} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground underline-offset-2 hover:underline">
                Per-product-line volume {showLines ? "▾" : "▸"}
              </button>
              {showLines ? (
                <div className="mt-2 space-y-3">
                  {baseline.lines.map((line) => {
                    const v = adj.lineVolumePct[line.name] ?? 0;
                    return (
                      <div key={line.name}>
                        <div className="flex items-baseline justify-between">
                          <label className="text-sm">{line.name}</label>
                          <span className={cn("text-sm font-semibold tabular-nums", v !== 0 && (v > 0 ? "text-emerald-700" : "text-red-700"))}>
                            {v > 0 ? "+" : ""}
                            {v}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={5}
                          value={v}
                          onChange={(e) =>
                            setAdj((a) => ({ ...a, lineVolumePct: { ...a.lineVolumePct, [line.name]: Number(e.target.value) } }))
                          }
                          className="w-full accent-[#285FAF]"
                          aria-label={`${line.name} volume`}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Outputs */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Cash position by quarter</CardTitle>
              <CardDescription>
                Solid: your assumptions · dashed: uploaded model · dot marks the trough. Financing rows (incl. the
                planned raise) stay as modeled.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CashCurve quarters={baseline.quarters} baseline={base.quarterly.closingCash} adjusted={result.quarterly.closingCash} />
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Revenue by year</CardTitle>
                <CardDescription>Grey: model · teal: adjusted</CardDescription>
              </CardHeader>
              <CardContent>
                <AnnualBars fys={fys} baseline={base.annual.map((a) => a.revenue)} adjusted={result.annual.map((a) => a.revenue)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">EBITDA by year</CardTitle>
                <CardDescription>Grey: model · teal/red: adjusted</CardDescription>
              </CardHeader>
              <CardContent>
                <AnnualBars fys={fys} baseline={base.annual.map((a) => a.ebitda)} adjusted={result.annual.map((a) => a.ebitda)} />
              </CardContent>
            </Card>
          </div>

          {/* Annual table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Adjusted P&amp;L summary</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 pr-3 font-medium">FY</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Revenue</th>
                    <th className="py-1.5 pr-3 text-right font-medium">GM%</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Overheads</th>
                    <th className="py-1.5 pr-3 text-right font-medium">EBITDA</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Δ vs model</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Closing cash</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {result.annual.map((a, i) => {
                    const dE = a.ebitda - base.annual[i].ebitda;
                    return (
                      <tr key={a.fy}>
                        <td className="py-1.5 pr-3 font-medium">{a.fy}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{fmtGBP(a.revenue)}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{a.grossMarginPct != null ? `${a.grossMarginPct.toFixed(1)}%` : "—"}</td>
                        <td className="py-1.5 pr-3 text-right tabular-nums">{fmtGBP(a.overheads)}</td>
                        <td className={cn("py-1.5 pr-3 text-right font-semibold tabular-nums", a.ebitda < 0 && "text-destructive")}>{fmtGBP(a.ebitda)}</td>
                        <td className={cn("py-1.5 pr-3 text-right tabular-nums", dE > 0 ? "text-emerald-700" : dE < 0 ? "text-red-700" : "text-muted-foreground")}>
                          {Math.abs(dE) < 1000 ? "—" : fmtGBP(dE, { sign: true })}
                        </td>
                        <td className={cn("py-1.5 pr-3 text-right tabular-nums", a.closingCash < 0 && "font-semibold text-destructive")}>{fmtGBP(a.closingCash)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Sensitivity */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Sensitivity analysis</CardTitle>
                  <CardDescription>Around your current slider settings.</CardDescription>
                </div>
                <div className="flex rounded-md border p-0.5 text-xs">
                  {(
                    [
                      ["minCash", "Cash trough"],
                      ["fy29Ebitda", "FY29 EBITDA"],
                    ] as [SensitivityMetric, string][]
                  ).map(([m, label]) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetric(m)}
                      className={cn("rounded px-2.5 py-1 font-medium", metric === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tornado */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Driver impact on {metric === "minCash" ? "cash trough" : "FY29 EBITDA"}
                </p>
                {(() => {
                  const maxSwing = Math.max(...torn.map((t) => Math.max(Math.abs(t.lowValue - t.base), Math.abs(t.highValue - t.base))), 1);
                  return (
                    <div className="space-y-1.5">
                      {torn.map(({ driver, lowValue, highValue, base: b }) => {
                        const lo = lowValue - b;
                        const hi = highValue - b;
                        const w = (v: number) => (Math.abs(v) / maxSwing) * 50;
                        return (
                          <div key={driver.key} className="flex items-center gap-2 text-xs">
                            <div className="w-40 shrink-0">{driver.label}</div>
                            <div className="relative h-5 flex-1">
                              <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                              {[lo, hi].map((v, i) => (
                                <div
                                  key={i}
                                  className={cn("absolute inset-y-0.5 rounded-sm", v >= 0 ? "bg-emerald-500/70" : "bg-red-500/70")}
                                  style={v >= 0 ? { left: "50%", width: `${w(v)}%` } : { right: "50%", width: `${w(v)}%` }}
                                  title={`${driver.format(i === 0 ? driver.low : driver.high)}: ${fmtGBP(v, { sign: true })}`}
                                />
                              ))}
                            </div>
                            <div className="w-40 shrink-0 text-right tabular-nums text-muted-foreground">
                              {driver.format(driver.low)}: {fmtGBP(lo, { sign: true })} · {driver.format(driver.high)}: {fmtGBP(hi, { sign: true })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Two-driver grid */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Volume × pricing grid — {metric === "minCash" ? "cash trough" : "FY29 EBITDA"}
                </p>
                <div className="overflow-x-auto">
                  <table className="text-xs tabular-nums">
                    <thead>
                      <tr>
                        <th className="p-1 pr-2 text-right font-medium text-muted-foreground">price ↓ / vol →</th>
                        {GRID_COLS.values.map((c) => (
                          <th key={c} className={cn("p-1 text-center font-medium", c === 0 ? "text-foreground" : "text-muted-foreground")}>
                            {c > 0 ? "+" : ""}
                            {c}%
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {GRID_ROWS.values.map((r, ri) => (
                        <tr key={r}>
                          <td className={cn("p-1 pr-2 text-right font-medium", r === 0 ? "text-foreground" : "text-muted-foreground")}>
                            {r > 0 ? "+" : ""}
                            {r}%
                          </td>
                          {GRID_COLS.values.map((c, ci) => {
                            const v = grid[ri][ci];
                            const bad = v < 0;
                            const warn = !bad && metric === "minCash" && v < 5e6;
                            return (
                              <td
                                key={c}
                                className={cn(
                                  "border border-background p-1 text-center",
                                  bad ? "bg-red-100 font-semibold text-red-900" : warn ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-900",
                                  r === 0 && c === 0 && "ring-1 ring-inset ring-primary"
                                )}
                              >
                                {fmtGBP(v)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Red: {metric === "minCash" ? "cash goes negative — additional funding required" : "FY29 EBITDA negative"}
                  {metric === "minCash" ? " · amber: trough below £5M" : ""} · outlined cell = current settings.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
