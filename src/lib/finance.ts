// Pure functions for projecting a financial scenario.
// All values in whole dollars; MRR/opex are monthly.

export type ScenarioAssumptions = {
  startingMRR: number;
  monthlyGrowthPct: number;     // e.g. 8 = 8%/mo
  churnPct: number;              // monthly logo/revenue churn
  grossMarginPct: number;        // 0-100
  monthlyOpexBase: number;       // current fixed monthly opex (rent, tools, etc.) — excludes salaries
  opexGrowthPct: number;         // monthly opex creep
  headcountStart: number;
  monthlyHires: number;
  avgFullyLoadedSalary: number;  // annual fully loaded
  oneTimeRevenue?: { month: number; amount: number }[];
  oneTimeCosts?: { month: number; amount: number }[];
};

export type MonthlyProjection = {
  month: number;          // 1-indexed
  monthLabel: string;     // "Jun 2026"
  mrr: number;
  arr: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  headcount: number;
  payroll: number;
  fixedOpex: number;
  oneTimeRevenue: number;
  oneTimeCosts: number;
  totalOpex: number;
  netBurn: number;        // negative = cash burned, positive = cash generated
  endingCash: number;
};

export type ProjectionSummary = {
  rows: MonthlyProjection[];
  runwayMonths: number | null;   // null if cash-flow positive throughout horizon
  endingCash: number;
  endingMRR: number;
  endingARR: number;
  totalCashUsed: number;         // max drawdown from start
  breakevenMonth: number | null; // month index when monthly net flow turns positive
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function projectScenario(
  startingCash: number,
  startMonth: Date,
  horizonMonths: number,
  a: ScenarioAssumptions
): ProjectionSummary {
  const rows: MonthlyProjection[] = [];
  let mrr = a.startingMRR;
  let opex = a.monthlyOpexBase;
  let headcount = a.headcountStart;
  let cash = startingCash;
  const monthlySalary = a.avgFullyLoadedSalary / 12;

  let breakevenMonth: number | null = null;
  let runwayMonths: number | null = null;
  let lowestCash = startingCash;

  for (let i = 1; i <= horizonMonths; i++) {
    const date = new Date(startMonth);
    date.setMonth(date.getMonth() + (i - 1));
    const monthLabel = `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;

    // Grow MRR (after churn)
    if (i > 1) {
      mrr = Math.max(0, mrr * (1 + a.monthlyGrowthPct / 100) * (1 - a.churnPct / 100));
      opex = opex * (1 + a.opexGrowthPct / 100);
      headcount += a.monthlyHires;
    }

    const oneTimeRev = (a.oneTimeRevenue ?? []).filter((x) => x.month === i).reduce((s, x) => s + x.amount, 0);
    const oneTimeCost = (a.oneTimeCosts ?? []).filter((x) => x.month === i).reduce((s, x) => s + x.amount, 0);

    const revenue = mrr + oneTimeRev;
    const cogs = (revenue * (100 - a.grossMarginPct)) / 100;
    const grossProfit = revenue - cogs;
    const payroll = headcount * monthlySalary;
    const totalOpex = opex + payroll + oneTimeCost;
    const netBurn = grossProfit - totalOpex; // positive = cash generated
    cash = cash + netBurn;

    if (cash < lowestCash) lowestCash = cash;
    if (breakevenMonth === null && netBurn >= 0 && i > 1) breakevenMonth = i;
    if (runwayMonths === null && cash <= 0) runwayMonths = i;

    rows.push({
      month: i,
      monthLabel,
      mrr: Math.round(mrr),
      arr: Math.round(mrr * 12),
      revenue: Math.round(revenue),
      cogs: Math.round(cogs),
      grossProfit: Math.round(grossProfit),
      headcount: Math.round(headcount),
      payroll: Math.round(payroll),
      fixedOpex: Math.round(opex),
      oneTimeRevenue: Math.round(oneTimeRev),
      oneTimeCosts: Math.round(oneTimeCost),
      totalOpex: Math.round(totalOpex),
      netBurn: Math.round(netBurn),
      endingCash: Math.round(cash),
    });
  }

  return {
    rows,
    runwayMonths,
    endingCash: Math.round(cash),
    endingMRR: Math.round(mrr),
    endingARR: Math.round(mrr * 12),
    totalCashUsed: Math.round(startingCash - lowestCash),
    breakevenMonth,
  };
}

export function fmtUSD(n: number, opts?: { compact?: boolean }) {
  if (opts?.compact) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// Plain-English summary lines from a snapshot series (latest month vs prior).
// Shared by the financials page and the board pack so they never disagree.
export function financialSummaryLines(
  snapshots: {
    cash: number;
    arr: number;
    revenue: number;
    burn: number;
    headcount: number;
    grossMargin: number;
  }[]
): string[] {
  const latest = snapshots[snapshots.length - 1];
  const prev = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  if (!latest) return [];

  const lines: string[] = [];
  const runway = latest.burn > 0 ? Math.floor(latest.cash / latest.burn) : null;
  lines.push(
    runway != null
      ? `Runway: ~${runway} months at the current net burn of ${fmtUSD(latest.burn, { compact: true })}/mo.`
      : `Cash-flow positive this period — no runway constraint at current burn.`
  );
  if (prev) {
    if (prev.revenue > 0) {
      const g = ((latest.revenue - prev.revenue) / prev.revenue) * 100;
      lines.push(
        `Revenue ${g >= 0 ? "grew" : "declined"} ${Math.abs(g).toFixed(1)}% month-over-month to ${fmtUSD(latest.revenue, { compact: true })}.`
      );
    }
    if (prev.arr > 0 && latest.arr !== prev.arr) {
      const d = latest.arr - prev.arr;
      lines.push(
        `ARR ${d >= 0 ? "added" : "lost"} ${fmtUSD(Math.abs(d), { compact: true })} (now ${fmtUSD(latest.arr, { compact: true })}).`
      );
    }
    const hcDelta = latest.headcount - prev.headcount;
    if (hcDelta !== 0) lines.push(`Headcount ${hcDelta > 0 ? "up" : "down"} ${Math.abs(hcDelta)} to ${latest.headcount}.`);
  }
  if (latest.grossMargin > 0) lines.push(`Gross margin at ${latest.grossMargin}%.`);
  return lines;
}

export const DEFAULT_ASSUMPTIONS: ScenarioAssumptions = {
  startingMRR: 50000,
  monthlyGrowthPct: 8,
  churnPct: 2,
  grossMarginPct: 75,
  monthlyOpexBase: 60000,
  opexGrowthPct: 1,
  headcountStart: 12,
  monthlyHires: 1,
  avgFullyLoadedSalary: 180000,
};
