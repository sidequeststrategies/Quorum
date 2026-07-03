// Pro forma modeling engine.
//
// A ProFormaBaseline is the quarterly skeleton parsed from the company's
// financial-model workbook (see lib/proforma-import.ts). This module applies
// assumption adjustments (the sliders) on top of that baseline and rebuilds
// the P&L and cash position quarter by quarter — pure functions, no imports,
// so the client can recompute on every slider move.
//
// Adjustment semantics (board-level economics, not cell-level replication):
//   volume      scales revenue AND cost of sales together (more/fewer km delivered)
//   price       scales revenue only (price flows straight to margin)
//   growthDelta compounds quarter over quarter — models a faster/slower ramp
//   cogs        scales cost of sales only (unit-cost efficiency)
//   overhead multipliers scale the parsed overhead categories
//   dsoDelta    shifts debtor days, feeding the working-capital model the
//               workbook itself uses (debtors = revenue × DSO/91.25 etc.);
//               VAT/PAYE and other WC components stay at baseline via a
//               residual so the untouched model reproduces the workbook.
// Financing rows (equity raise, loans, interest) stay at baseline.

export type ProFormaLine = { name: string; revenue: number[]; cogs: number[] }; // cogs positive
export type ProFormaOverhead = { name: string; values: number[] }; // positive

export type ProFormaBaseline = {
  currency: string; // "£"
  quarters: string[]; // "Q1 FY27" … length N
  fiscalYears: string[]; // "FY27" … one per 4 quarters
  lines: ProFormaLine[];
  overheads: ProFormaOverhead[];
  grants: number[];
  capex: number[]; // positive
  tax: number[]; // signed as in workbook (usually negative)
  financing: number[]; // net financing incl. interest income (signed)
  openingCash: number; // start of first quarter
  // Working capital drivers (from the workbook's own WC model)
  dso: number;
  dpo: number;
  inventoryDays: number;
  nwcActual: number[]; // net working capital per quarter, from workbook
  nwcOpening: number; // NWC before the first quarter
  headcount: number[]; // EOQ FTE
  staffingOverheadName: string; // which overhead row is payroll (for the slider label)
  // Workbook-reported EBITDA/closing cash for validation (not used in math)
  reportedEbitda?: number[];
  reportedClosingCash?: number[];
};

export type ProFormaAdjustments = {
  volumePct: number; // -50..+50 (%)
  pricePct: number; // -30..+30
  growthDeltaPct: number; // -5..+5 (pp per quarter, compounding)
  cogsPct: number; // -30..+30
  staffingPct: number; // -30..+30
  rdPct: number; // -50..+50
  otherOverheadPct: number; // -30..+30
  capexPct: number; // -50..+50
  grantsOn: boolean;
  dsoDelta: number; // -30..+60 days
  lineVolumePct: Record<string, number>; // per product line, -100..+100
};

export const NEUTRAL_ADJUSTMENTS: ProFormaAdjustments = {
  volumePct: 0,
  pricePct: 0,
  growthDeltaPct: 0,
  cogsPct: 0,
  staffingPct: 0,
  rdPct: 0,
  otherOverheadPct: 0,
  capexPct: 0,
  grantsOn: true,
  dsoDelta: 0,
  lineVolumePct: {},
};

export type ProFormaQuarterly = {
  revenue: number[];
  revenueByLine: { name: string; values: number[] }[];
  cogs: number[];
  grossProfit: number[];
  grossMarginPct: (number | null)[];
  overheads: number[];
  grants: number[];
  ebitda: number[];
  capex: number[];
  wcChange: number[];
  closingCash: number[];
  headcount: number[];
};

export type ProFormaAnnual = {
  fy: string;
  revenue: number;
  grossProfit: number;
  grossMarginPct: number | null;
  overheads: number;
  ebitda: number;
  capex: number;
  closingCash: number; // end of FY
};

export type ProFormaResult = {
  quarterly: ProFormaQuarterly;
  annual: ProFormaAnnual[];
  kpis: {
    fy28Revenue: number;
    finalFyRevenue: number;
    ebitdaBreakevenQuarter: string | null; // first quarter with EBITDA ≥ 0 that stays positive
    minCash: number;
    minCashQuarter: string;
    cumulativeEbitda: number;
    fundingGap: number; // max(0, -minCash): extra capital needed to stay above zero
  };
};

const QUARTER_DAYS = 91.25;

const isRd = (name: string) => /r\s*&\s*d|research/i.test(name);
const isStaffing = (name: string) => /staff|payroll|people|salaries/i.test(name);

export function runProForma(b: ProFormaBaseline, a: ProFormaAdjustments): ProFormaResult {
  const n = b.quarters.length;
  const vol = 1 + a.volumePct / 100;
  const price = 1 + a.pricePct / 100;
  const cogsMult = 1 + a.cogsPct / 100;
  const growth = (q: number) => Math.pow(1 + a.growthDeltaPct / 100, q);

  // ── Revenue & COGS per line ──
  const revenueByLine = b.lines.map((line) => {
    const lineVol = 1 + (a.lineVolumePct[line.name] ?? 0) / 100;
    return {
      name: line.name,
      values: line.revenue.map((v, q) => v * vol * lineVol * price * growth(q)),
    };
  });
  const cogsByLine = b.lines.map((line) => {
    const lineVol = 1 + (a.lineVolumePct[line.name] ?? 0) / 100;
    return line.cogs.map((v, q) => v * vol * lineVol * cogsMult * growth(q));
  });
  const revenue = Array.from({ length: n }, (_, q) => revenueByLine.reduce((s, l) => s + l.values[q], 0));
  const cogs = Array.from({ length: n }, (_, q) => cogsByLine.reduce((s, l) => s + l[q], 0));
  const grossProfit = revenue.map((r, q) => r - cogs[q]);
  const grossMarginPct = revenue.map((r, q) => (r > 0 ? (grossProfit[q] / r) * 100 : null));

  // ── Overheads ──
  const staffingMult = 1 + a.staffingPct / 100;
  const rdMult = 1 + a.rdPct / 100;
  const otherMult = 1 + a.otherOverheadPct / 100;
  const overheadRows = b.overheads.map((o) => {
    const mult = isStaffing(o.name) ? staffingMult : isRd(o.name) ? rdMult : otherMult;
    return o.values.map((v) => v * mult);
  });
  const overheads = Array.from({ length: n }, (_, q) => overheadRows.reduce((s, o) => s + o[q], 0));
  const staffingRow = b.overheads.findIndex((o) => isStaffing(o.name));
  const nonStaffOverheads = Array.from({ length: n }, (_, q) =>
    overheadRows.reduce((s, o, i) => (i === staffingRow ? s : s + o[q]), 0)
  );

  // ── Grants / EBITDA ──
  const grants = b.grants.map((g) => (a.grantsOn ? g : 0));
  const ebitda = revenue.map((r, q) => r - cogs[q] - overheads[q] + grants[q]);

  // ── Working capital: the workbook's own day-count model + fixed residual ──
  const dso = b.dso + a.dsoDelta;
  const nwcFormula = (rev: number, cos: number, nonStaffOh: number, dsoDays: number) =>
    (rev * dsoDays) / QUARTER_DAYS - ((cos + nonStaffOh) * b.dpo) / QUARTER_DAYS + (cos * b.inventoryDays) / QUARTER_DAYS;

  // Residual = what the workbook's NWC includes beyond the day-count core
  // (VAT, PAYE timing, flooring). Held at baseline.
  const baseNonStaff = Array.from({ length: n }, (_, q) =>
    b.overheads.reduce((s, o, i) => (i === staffingRow ? s : s + o.values[q]), 0)
  );
  const residual = b.nwcActual.map((actual, q) => {
    const lineRev = b.lines.reduce((s, l) => s + l.revenue[q], 0);
    const lineCogs = b.lines.reduce((s, l) => s + l.cogs[q], 0);
    return actual - nwcFormula(lineRev, lineCogs, baseNonStaff[q], b.dso);
  });

  const nwc = Array.from({ length: n }, (_, q) => nwcFormula(revenue[q], cogs[q], nonStaffOverheads[q], dso) + residual[q]);
  const wcChange = nwc.map((v, q) => -(v - (q === 0 ? b.nwcOpening : nwc[q - 1])));

  // ── Cash ──
  const capexMult = 1 + a.capexPct / 100;
  const capex = b.capex.map((c) => c * capexMult);
  const closingCash: number[] = [];
  let cash = b.openingCash;
  for (let q = 0; q < n; q++) {
    cash += ebitda[q] + wcChange[q] + (b.tax[q] ?? 0) - capex[q] + (b.financing[q] ?? 0);
    closingCash.push(cash);
  }

  // ── Headcount (indicative: scales with the staffing slider) ──
  const headcount = b.headcount.map((h) => Math.round(h * staffingMult));

  // ── Annual roll-up ──
  const annual: ProFormaAnnual[] = b.fiscalYears.map((fy, i) => {
    const qs = [0, 1, 2, 3].map((k) => i * 4 + k).filter((q) => q < n);
    const sum = (arr: number[]) => qs.reduce((s, q) => s + arr[q], 0);
    const rev = sum(revenue);
    const gp = sum(grossProfit);
    return {
      fy,
      revenue: rev,
      grossProfit: gp,
      grossMarginPct: rev > 0 ? (gp / rev) * 100 : null,
      overheads: sum(overheads),
      ebitda: sum(ebitda),
      capex: sum(capex),
      closingCash: closingCash[qs[qs.length - 1]],
    };
  });

  // ── KPIs ──
  let breakeven: string | null = null;
  for (let q = 0; q < n; q++) {
    if (ebitda[q] >= 0 && ebitda.slice(q).every((e) => e >= 0)) {
      breakeven = b.quarters[q];
      break;
    }
  }
  let minCash = Infinity;
  let minQ = 0;
  closingCash.forEach((c, q) => {
    if (c < minCash) {
      minCash = c;
      minQ = q;
    }
  });
  const fy28 = annual.find((x) => x.fy === "FY28");

  return {
    quarterly: {
      revenue,
      revenueByLine,
      cogs,
      grossProfit,
      grossMarginPct,
      overheads,
      grants,
      ebitda,
      capex,
      wcChange,
      closingCash,
      headcount,
    },
    annual,
    kpis: {
      fy28Revenue: fy28?.revenue ?? annual[1]?.revenue ?? 0,
      finalFyRevenue: annual[annual.length - 1]?.revenue ?? 0,
      ebitdaBreakevenQuarter: breakeven,
      minCash,
      minCashQuarter: b.quarters[minQ],
      cumulativeEbitda: ebitda.reduce((s, e) => s + e, 0),
      fundingGap: Math.max(0, -minCash),
    },
  };
}

// ── Sensitivity ──────────────────────────────────────────────────────────────

export type TornadoDriver = {
  key: keyof Omit<ProFormaAdjustments, "grantsOn" | "lineVolumePct">;
  label: string;
  low: number;
  high: number;
  format: (v: number) => string;
};

export const TORNADO_DRIVERS: TornadoDriver[] = [
  { key: "volumePct", label: "Volume (bookings)", low: -20, high: 20, format: (v) => `${v > 0 ? "+" : ""}${v}%` },
  { key: "pricePct", label: "Pricing", low: -10, high: 10, format: (v) => `${v > 0 ? "+" : ""}${v}%` },
  { key: "growthDeltaPct", label: "Growth ramp (per qtr)", low: -2, high: 2, format: (v) => `${v > 0 ? "+" : ""}${v}pp` },
  { key: "cogsPct", label: "Unit costs (COGS)", low: -10, high: 10, format: (v) => `${v > 0 ? "+" : ""}${v}%` },
  { key: "staffingPct", label: "Staffing costs", low: -10, high: 10, format: (v) => `${v > 0 ? "+" : ""}${v}%` },
  { key: "rdPct", label: "R&D spend", low: -20, high: 20, format: (v) => `${v > 0 ? "+" : ""}${v}%` },
  { key: "otherOverheadPct", label: "Other overheads", low: -10, high: 10, format: (v) => `${v > 0 ? "+" : ""}${v}%` },
  { key: "capexPct", label: "CAPEX", low: -20, high: 20, format: (v) => `${v > 0 ? "+" : ""}${v}%` },
  { key: "dsoDelta", label: "Debtor days (DSO)", low: -15, high: 30, format: (v) => `${v > 0 ? "+" : ""}${v}d` },
];

export type SensitivityMetric = "fy29Ebitda" | "minCash";

export function metricValue(result: ProFormaResult, metric: SensitivityMetric): number {
  if (metric === "minCash") return result.kpis.minCash;
  const fy29 = result.annual.find((a) => a.fy === "FY29");
  return fy29?.ebitda ?? result.annual[2]?.ebitda ?? 0;
}

// One-at-a-time impact of each driver on the chosen metric, holding the
// current slider state for everything else.
export function tornado(
  b: ProFormaBaseline,
  current: ProFormaAdjustments,
  metric: SensitivityMetric
): { driver: TornadoDriver; lowValue: number; highValue: number; base: number }[] {
  const base = metricValue(runProForma(b, current), metric);
  return TORNADO_DRIVERS.map((driver) => {
    const lowAdj = { ...current, [driver.key]: (current[driver.key] as number) + driver.low };
    const highAdj = { ...current, [driver.key]: (current[driver.key] as number) + driver.high };
    return {
      driver,
      lowValue: metricValue(runProForma(b, lowAdj), metric),
      highValue: metricValue(runProForma(b, highAdj), metric),
      base,
    };
  }).sort((x, y) => Math.abs(y.highValue - y.lowValue) - Math.abs(x.highValue - x.lowValue));
}

// Two-driver grid (e.g. volume × price) of the chosen metric.
export function sensitivityGrid(
  b: ProFormaBaseline,
  current: ProFormaAdjustments,
  metric: SensitivityMetric,
  rows: { key: TornadoDriver["key"]; values: number[] },
  cols: { key: TornadoDriver["key"]; values: number[] }
): number[][] {
  return rows.values.map((rv) =>
    cols.values.map((cv) => {
      const adj = { ...current, [rows.key]: rv, [cols.key]: cv };
      return metricValue(runProForma(b, adj), metric);
    })
  );
}
