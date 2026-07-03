// Sales-funnel stages shared by the Excel importer (server), the report
// upload preview (client), and the funnel charts. Kept free of xlsx imports
// so the client bundle doesn't pull in SheetJS.

export const FUNNEL_STAGES = [
  "LEAD",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "CLOSED_WON",
  "CLOSED_LOST",
] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const FUNNEL_STAGE_LABELS: Record<FunnelStage, string> = {
  LEAD: "Leads",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed won",
  CLOSED_LOST: "Closed lost",
};

// The through-the-funnel path used for velocity math (lost is terminal, not
// a step on the path).
export const FUNNEL_PATH: FunnelStage[] = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "CLOSED_WON"];

export type ParsedFunnelRow = { stage: FunnelStage; sourceLabel: string; values: (number | null)[] };
export type ParsedFunnel = {
  sheet: string;
  months: string[]; // YYYY-MM
  rows: ParsedFunnelRow[];
};

// Month-over-month velocity: for each step on the funnel path, the implied
// conversion into the next stage — count(next stage, month m) as a share of
// count(stage, month m-1). Crude but computable from monthly stage totals
// alone, and consistent across reports so the trend is meaningful.
export type FunnelVelocityStep = {
  from: FunnelStage;
  to: FunnelStage;
  // One rate per month starting from the second month; null when the
  // denominator is missing or zero.
  rates: (number | null)[];
};

export function computeFunnelVelocity(
  months: string[],
  countsByStage: Map<FunnelStage, (number | null)[]>
): FunnelVelocityStep[] {
  const steps: FunnelVelocityStep[] = [];
  for (let i = 0; i < FUNNEL_PATH.length - 1; i++) {
    const from = FUNNEL_PATH[i];
    const to = FUNNEL_PATH[i + 1];
    const fromCounts = countsByStage.get(from);
    const toCounts = countsByStage.get(to);
    const rates: (number | null)[] = [];
    for (let m = 1; m < months.length; m++) {
      const denom = fromCounts?.[m - 1];
      const num = toCounts?.[m];
      rates.push(denom != null && denom > 0 && num != null ? Math.round((num / denom) * 100) : null);
    }
    steps.push({ from, to, rates });
  }
  return steps;
}
