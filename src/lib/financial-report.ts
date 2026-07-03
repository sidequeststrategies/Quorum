// Data assembly for the monthly financial reporting module.
//
// A "monthly report" is the unit the board sees: one uploaded Excel pack per
// calendar month, broken out into actuals (financialSnapshots), forward
// forecasts (financialForecastValues) and the funnel snapshot. This module
// gathers everything a report page or the delta dashboard needs, and computes
// the month-over-month deltas and plain-English callouts.

import { and, asc, desc, eq, gte, lt, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  customers,
  customerUpdates,
  financialDocuments,
  financialForecastValues,
  financialPlans,
  financialReports,
  financialScenarios,
  financialSnapshots,
  funnelSnapshots,
  type Customer,
  type CustomerUpdate,
  type FinancialDocument,
  type FinancialReport,
  type FinancialSnapshot,
} from "@/db/schema";
import type { MetricDelta } from "@/lib/meeting-compare";
import { fmtUSD } from "@/lib/finance";
import { FUNNEL_PATH, FUNNEL_STAGES, computeFunnelVelocity, type FunnelStage, type FunnelVelocityStep } from "@/lib/funnel";
import type { SnapshotField } from "@/lib/snapshot-fields";

// Periods are stored as the first day of the month at UTC midnight
// (periodFromString("2026-06") → 2026-06-01T00:00Z). Use UTC getters when
// turning them back into strings so the month never shifts across timezones.
export function periodToString(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtPeriodShort(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function fmtMonthString(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[mo - 1]} ${y}`;
}

function delta(
  key: string,
  label: string,
  current: number | null | undefined,
  previous: number | null | undefined,
  opts: { goodWhenUp?: boolean; money?: boolean; pct?: boolean } = {}
): MetricDelta {
  const c = current ?? null;
  const p = previous ?? null;
  return {
    key,
    label,
    current: c,
    previous: p,
    delta: c != null && p != null ? c - p : null,
    goodWhenUp: opts.goodWhenUp ?? true,
    money: opts.money ?? true,
    pct: opts.pct,
  };
}

const runwayOf = (s: FinancialSnapshot | null | undefined) =>
  s && s.burn > 0 ? Math.floor(s.cash / s.burn) : null;

// Periods should be unique per calendar month, but rows written from
// different timezones (e.g. seed data at local midnight vs imports at UTC
// midnight) can coexist. Collapse to one row per month — most recently
// updated wins — so series and deltas never double-count a month.
function dedupeByMonth(snapshots: FinancialSnapshot[]): FinancialSnapshot[] {
  const byMonth = new Map<string, FinancialSnapshot>();
  for (const s of snapshots) {
    const k = periodToString(s.period);
    const prev = byMonth.get(k);
    if (!prev || s.updatedAt.getTime() >= prev.updatedAt.getTime()) byMonth.set(k, s);
  }
  return [...byMonth.values()].sort((a, b) => a.period.getTime() - b.period.getTime());
}

// KPI deltas between two consecutive monthly snapshots (+ funnel pipeline).
export function snapshotDeltas(
  cur: FinancialSnapshot | null,
  prev: FinancialSnapshot | null,
  pipeline?: { current: number | null; previous: number | null }
): MetricDelta[] {
  if (!cur) return [];
  const out = [
    delta("cash", "Cash position", cur.cash, prev?.cash),
    delta("revenue", "Revenue / mo", cur.revenue, prev?.revenue),
    delta("arr", "ARR", cur.arr, prev?.arr),
    delta("mrr", "MRR", cur.mrr, prev?.mrr),
    delta("grossMargin", "Gross margin %", cur.grossMargin, prev?.grossMargin, { money: false, pct: true }),
    delta("burn", "Net burn / mo", cur.burn, prev?.burn, { goodWhenUp: false }),
    delta("runway", "Runway (months)", runwayOf(cur), runwayOf(prev), { money: false }),
    delta("headcount", "Headcount", cur.headcount, prev?.headcount, { money: false }),
  ];
  // Only show pipeline when dollar values are actually tracked — a funnel of
  // counts-only stages would otherwise render as a misleading "$0 pipeline".
  if (pipeline && pipeline.current != null && pipeline.current > 0) {
    out.push(delta("pipeline", "Open pipeline", pipeline.current, pipeline.previous));
  }
  return out;
}

// Plain-English callouts for movements a director should notice. Thresholds:
// ≥10% for money metrics, ≥3 points of gross margin, ≥2 months of runway,
// any headcount change.
export function deltaCallouts(deltas: MetricDelta[]): string[] {
  const lines: string[] = [];
  for (const d of deltas) {
    if (d.current == null || d.previous == null || d.delta == null || d.delta === 0) continue;
    const up = d.delta > 0;
    const dir = up ? "up" : "down";
    const good = up ? d.goodWhenUp : !d.goodWhenUp;
    const flag = good ? "" : " — worth discussion";
    if (d.money) {
      if (d.previous !== 0 && Math.abs(d.delta / d.previous) >= 0.1) {
        const pct = Math.abs((d.delta / d.previous) * 100).toFixed(0);
        lines.push(`${d.label} ${dir} ${pct}% (${fmtUSD(d.previous, { compact: true })} → ${fmtUSD(d.current, { compact: true })})${flag}.`);
      }
    } else if (d.key === "grossMargin") {
      if (Math.abs(d.delta) >= 3) lines.push(`Gross margin ${dir} ${Math.abs(d.delta)} points to ${d.current}%${flag}.`);
    } else if (d.key === "runway") {
      if (Math.abs(d.delta) >= 2) lines.push(`Runway ${up ? "extended" : "shortened"} by ${Math.abs(d.delta)} months to ~${d.current} months${flag}.`);
    } else if (d.key === "headcount") {
      lines.push(`Headcount ${dir} ${Math.abs(d.delta)} to ${d.current}.`);
    }
  }
  return lines;
}

// ── Funnel series ───────────────────────────────────────────────────────────

export type FunnelSeries = {
  months: string[]; // YYYY-MM ascending
  countsByStage: Map<FunnelStage, (number | null)[]>;
  valuesByStage: Map<FunnelStage, (number | null)[]>;
  velocity: FunnelVelocityStep[];
  // Total open-pipeline value (path stages, excl. closed) per month.
  openPipelineValue: (number | null)[];
};

export function buildFunnelSeries(rows: { period: Date; stage: string; count: number; value: number }[]): FunnelSeries {
  const months = [...new Set(rows.map((r) => periodToString(r.period)))].sort();
  const idx = new Map(months.map((m, i) => [m, i]));
  const countsByStage = new Map<FunnelStage, (number | null)[]>();
  const valuesByStage = new Map<FunnelStage, (number | null)[]>();
  for (const stage of FUNNEL_STAGES) {
    countsByStage.set(stage, months.map(() => null));
    valuesByStage.set(stage, months.map(() => null));
  }
  for (const r of rows) {
    const stage = r.stage as FunnelStage;
    if (!countsByStage.has(stage)) continue;
    const i = idx.get(periodToString(r.period))!;
    countsByStage.get(stage)![i] = r.count;
    valuesByStage.get(stage)![i] = r.value;
  }
  const openStages = FUNNEL_PATH.filter((s) => s !== "CLOSED_WON");
  const openPipelineValue = months.map((_, i) => {
    let sum = 0;
    let any = false;
    for (const s of openStages) {
      const v = valuesByStage.get(s)![i];
      if (v != null) {
        sum += v;
        any = true;
      }
    }
    return any ? sum : null;
  });
  return { months, countsByStage, valuesByStage, velocity: computeFunnelVelocity(months, countsByStage), openPipelineValue };
}

// ── Overview (delta dashboard) ──────────────────────────────────────────────

export type FinancialOverview = {
  snapshots: FinancialSnapshot[];
  reports: (FinancialReport & { sourceDocument: FinancialDocument | null })[];
  deltas: MetricDelta[];
  callouts: string[];
  funnel: FunnelSeries;
  latest: FinancialSnapshot | null;
  previous: FinancialSnapshot | null;
};

export async function getFinancialOverview(orgId: string): Promise<FinancialOverview> {
  const [snapshotRows, reportRows, funnelRows] = await Promise.all([
    db.select().from(financialSnapshots).where(eq(financialSnapshots.organizationId, orgId)).orderBy(asc(financialSnapshots.period)),
    db
      .select()
      .from(financialReports)
      .leftJoin(financialDocuments, eq(financialReports.sourceDocumentId, financialDocuments.id))
      .where(eq(financialReports.organizationId, orgId))
      .orderBy(desc(financialReports.period)),
    db.select().from(funnelSnapshots).where(eq(funnelSnapshots.organizationId, orgId)).orderBy(asc(funnelSnapshots.period)),
  ]);

  const snapshots = dedupeByMonth(snapshotRows);
  const latest = snapshots[snapshots.length - 1] ?? null;
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const funnel = buildFunnelSeries(funnelRows);
  const n = funnel.months.length;
  const pipeline = {
    current: n > 0 ? funnel.openPipelineValue[n - 1] : null,
    previous: n > 1 ? funnel.openPipelineValue[n - 2] : null,
  };
  const deltas = snapshotDeltas(latest, previous, pipeline);

  return {
    snapshots,
    reports: reportRows.map((r) => ({ ...r.FinancialReport, sourceDocument: r.FinancialDocument })),
    deltas,
    callouts: deltaCallouts(deltas),
    funnel,
    latest,
    previous,
  };
}

// ── Single monthly report ───────────────────────────────────────────────────

export type ForecastSeries = {
  // Months covered by actuals + forecast, ascending YYYY-MM.
  months: string[];
  // Per metric: value per month; actuals first, then this report's forecast.
  // actualCount = how many leading entries are actuals.
  byField: Map<SnapshotField, (number | null)[]>;
  actualCount: number;
};

export type MonthlyReportData = {
  report: FinancialReport & { sourceDocument: FinancialDocument | null };
  snapshot: FinancialSnapshot | null; // the report month's actuals
  prevSnapshot: FinancialSnapshot | null;
  snapshots: FinancialSnapshot[]; // all actuals ≤ report month, ascending
  deltas: MetricDelta[];
  callouts: string[];
  forecast: ForecastSeries;
  funnel: FunnelSeries; // all funnel data ≤ report month
  keyCustomers: { customer: Customer; update: CustomerUpdate | null }[];
  plans: { id: string; name: string; description: string | null; scenarioCount: number; horizonMonths: number; startingCash: number }[];
  prevReportPeriod: string | null;
  nextReportPeriod: string | null;
};

export async function getMonthlyReportData(orgId: string, periodStr: string): Promise<MonthlyReportData | null> {
  const period = new Date(periodStr + "-01");
  if (isNaN(period.getTime())) return null;

  const reportRows = await db
    .select()
    .from(financialReports)
    .leftJoin(financialDocuments, eq(financialReports.sourceDocumentId, financialDocuments.id))
    .where(and(eq(financialReports.organizationId, orgId), eq(financialReports.period, period)))
    .limit(1);
  if (!reportRows[0]) return null;
  const report = { ...reportRows[0].FinancialReport, sourceDocument: reportRows[0].FinancialDocument };

  const [snapshotRows, forecastRows, funnelRows, allCustomers, updates, plans, allReports] = await Promise.all([
    db
      .select()
      .from(financialSnapshots)
      .where(and(eq(financialSnapshots.organizationId, orgId), lte(financialSnapshots.period, period)))
      .orderBy(asc(financialSnapshots.period)),
    db
      .select()
      .from(financialForecastValues)
      .where(eq(financialForecastValues.reportId, report.id))
      .orderBy(asc(financialForecastValues.targetPeriod)),
    db
      .select()
      .from(funnelSnapshots)
      .where(and(eq(funnelSnapshots.organizationId, orgId), lte(funnelSnapshots.period, period)))
      .orderBy(asc(funnelSnapshots.period)),
    db.select().from(customers).where(eq(customers.organizationId, orgId)).orderBy(desc(customers.arr)),
    // Match the calendar month, not an exact timestamp — period rows may have
    // been written from another timezone (local vs UTC midnight). A ±12h
    // window around [month start, next month start) captures every offset.
    db
      .select()
      .from(customerUpdates)
      .where(
        and(
          gte(customerUpdates.period, new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), 1) - 12 * 3600 * 1000)),
          lt(customerUpdates.period, new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1) - 12 * 3600 * 1000))
        )
      ),
    db.select().from(financialPlans).where(eq(financialPlans.organizationId, orgId)).orderBy(desc(financialPlans.updatedAt)),
    db
      .select({ period: financialReports.period })
      .from(financialReports)
      .where(eq(financialReports.organizationId, orgId))
      .orderBy(asc(financialReports.period)),
  ]);

  const snapshots = dedupeByMonth(snapshotRows);
  const snapshot = snapshots.find((s) => periodToString(s.period) === periodStr) ?? null;
  const prevSnapshot = snapshot ? (snapshots[snapshots.indexOf(snapshot) - 1] ?? null) : (snapshots[snapshots.length - 1] ?? null);

  const funnel = buildFunnelSeries(funnelRows);
  const n = funnel.months.length;
  const deltas = snapshotDeltas(snapshot, prevSnapshot, {
    current: n > 0 ? funnel.openPipelineValue[n - 1] : null,
    previous: n > 1 ? funnel.openPipelineValue[n - 2] : null,
  });

  // Forecast series: last 12 months of actuals, then this report's forecast months.
  const trailing = snapshots.slice(-12);
  const actualMonths = trailing.map((s) => periodToString(s.period));
  const forecastMonths = [...new Set(forecastRows.map((f) => periodToString(f.targetPeriod)))].sort();
  const months = [...actualMonths, ...forecastMonths];
  const byField = new Map<SnapshotField, (number | null)[]>();
  const fields: SnapshotField[] = ["cash", "revenue", "mrr", "arr", "grossMargin", "burn", "headcount", "accountsReceivable", "accountsPayable"];
  for (const f of fields) {
    const actualVals = trailing.map((s) => (s[f] as number | null) ?? null);
    const fIdx = new Map(forecastMonths.map((m, i) => [m, i]));
    const forecastVals: (number | null)[] = forecastMonths.map(() => null);
    for (const row of forecastRows) {
      if (row.field !== f) continue;
      forecastVals[fIdx.get(periodToString(row.targetPeriod))!] = row.value;
    }
    byField.set(f, [...actualVals, ...forecastVals]);
  }
  const forecast: ForecastSeries = { months, byField, actualCount: actualMonths.length };

  // Key customers: everyone with an update this period, plus the top of the
  // ARR list; AT_RISK always surfaces.
  const updateByCustomer = new Map(updates.map((u) => [u.customerId, u]));
  const key = allCustomers
    .filter((c, i) => updateByCustomer.has(c.id) || c.status === "AT_RISK" || i < 8)
    .map((customer) => ({ customer, update: updateByCustomer.get(customer.id) ?? null }));

  // Scenario counts per plan.
  const planList = await Promise.all(
    plans.map(async (p) => {
      const scen = await db.select({ id: financialScenarios.id }).from(financialScenarios).where(eq(financialScenarios.planId, p.id));
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        scenarioCount: scen.length,
        horizonMonths: p.horizonMonths,
        startingCash: p.startingCash,
      };
    })
  );

  const reportPeriods = allReports.map((r) => periodToString(r.period));
  const i = reportPeriods.indexOf(periodStr);
  return {
    report,
    snapshot,
    prevSnapshot,
    snapshots,
    deltas,
    callouts: deltaCallouts(deltas),
    forecast,
    funnel,
    keyCustomers: key,
    plans: planList,
    prevReportPeriod: i > 0 ? reportPeriods[i - 1] : null,
    nextReportPeriod: i >= 0 && i < reportPeriods.length - 1 ? reportPeriods[i + 1] : null,
  };
}
