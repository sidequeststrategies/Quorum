// Unit test for the HubSpot funnel computation (no network, no DB):
//   npx tsx scripts/test-hubspot-funnel.ts
//
// Fixture: three deals moving through AssetCool's pipeline across May–July
// 2026, evaluated at a fixed "now". Asserts point-in-time stage counts,
// in-month closed counts, home-currency values, and time-in-stage averages.

import { computeFunnelFromDeals, getStageMap, type HubSpotDeal } from "../src/lib/hubspot";

const d = (s: string) => new Date(s);
const NOW = d("2026-07-07T12:00:00Z");

function deal(partial: Partial<HubSpotDeal> & { id: string }): HubSpotDeal {
  return {
    pipeline: "default",
    dealstage: null,
    amountHome: null,
    createdAt: null,
    enteredByStage: {},
    exitedByStage: {},
    ...partial,
  };
}

const deals: HubSpotDeal[] = [
  // A: created in May as a lead, qualified mid-June (Discovery), still there.
  deal({
    id: "A",
    dealstage: "qualifiedtobuy",
    amountHome: 100000,
    createdAt: d("2026-05-10T00:00:00Z"),
    enteredByStage: {
      appointmentscheduled: d("2026-05-10T00:00:00Z"),
      qualifiedtobuy: d("2026-06-15T00:00:00Z"),
    },
    exitedByStage: { appointmentscheduled: d("2026-06-15T00:00:00Z") },
  }),
  // B: raced through to a July win.
  deal({
    id: "B",
    dealstage: "closedwon",
    amountHome: 50000,
    createdAt: d("2026-06-01T00:00:00Z"),
    enteredByStage: {
      appointmentscheduled: d("2026-06-01T00:00:00Z"),
      contractsent: d("2026-06-20T00:00:00Z"),
      closedwon: d("2026-07-03T00:00:00Z"),
    },
    exitedByStage: {
      appointmentscheduled: d("2026-06-20T00:00:00Z"),
      contractsent: d("2026-07-03T00:00:00Z"),
    },
  }),
  // C: new lead this month; also proves other pipelines are excluded via D.
  deal({
    id: "C",
    dealstage: "appointmentscheduled",
    amountHome: 200000,
    createdAt: d("2026-07-01T00:00:00Z"),
    enteredByStage: { appointmentscheduled: d("2026-07-01T00:00:00Z") },
  }),
  deal({
    id: "D",
    pipeline: "other",
    dealstage: "appointmentscheduled",
    amountHome: 999999,
    enteredByStage: { appointmentscheduled: d("2026-07-01T00:00:00Z") },
  }),
];

const { snapshots, metrics } = computeFunnelFromDeals(deals, {
  stageMap: getStageMap(),
  pipelineId: "default",
  now: NOW,
});

let failures = 0;
function expect(label: string, actual: unknown, want: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(want);
  console.log(`${ok ? "✓" : "✗"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
  if (!ok) failures++;
}

const at = (month: string, stage: string) => snapshots.find((s) => s.month === month && s.stage === stage)!;

expect("months covered", [...new Set(snapshots.map((s) => s.month))], ["2026-05", "2026-06", "2026-07"]);

// End of May: only A exists, sitting in LEAD.
expect("May LEAD count", at("2026-05", "LEAD").count, 1);
expect("May LEAD value", at("2026-05", "LEAD").value, 100000);
expect("May QUALIFIED count", at("2026-05", "QUALIFIED").count, 0);

// End of June: A in QUALIFIED (Discovery), B in NEGOTIATION (contractsent).
expect("Jun QUALIFIED count", at("2026-06", "QUALIFIED").count, 1);
expect("Jun NEGOTIATION count", at("2026-06", "NEGOTIATION").count, 1);
expect("Jun LEAD count", at("2026-06", "LEAD").count, 0);
expect("Jun CLOSED_WON count", at("2026-06", "CLOSED_WON").count, 0);

// July (in progress, evaluated at NOW): C is a LEAD, A still QUALIFIED,
// B closed won on Jul 3 → in-month win, no longer in an open stage.
expect("Jul LEAD count", at("2026-07", "LEAD").count, 1);
expect("Jul LEAD value", at("2026-07", "LEAD").value, 200000);
expect("Jul QUALIFIED count", at("2026-07", "QUALIFIED").count, 1);
expect("Jul NEGOTIATION count", at("2026-07", "NEGOTIATION").count, 0);
expect("Jul CLOSED_WON count", at("2026-07", "CLOSED_WON").count, 1);
expect("Jul CLOSED_WON value", at("2026-07", "CLOSED_WON").value, 50000);

// Other-pipeline deal D never counted anywhere.
expect(
  "pipeline filter",
  snapshots.every((s) => s.value !== 999999 || s.count === 0),
  true
);

// Time-in-stage: LEAD completed visits = A (36d) + B (19d) → avg 27.5d;
// C open in LEAD for 6.5d. QUALIFIED: A open since Jun 15 (22.5d), none completed.
const lead = metrics.find((m) => m.stage === "LEAD")!;
expect("LEAD completed visits", lead.completedCount, 2);
expect("LEAD avg days", Math.round(lead.avgDaysInStage! * 10) / 10, 27.5);
expect("LEAD open count", lead.openCount, 1);
expect("LEAD open age", Math.round(lead.avgOpenAgeDays! * 10) / 10, 6.5);
const qual = metrics.find((m) => m.stage === "QUALIFIED")!;
expect("QUALIFIED completed visits", qual.completedCount, 0);
expect("QUALIFIED avg days", qual.avgDaysInStage, null);
expect("QUALIFIED open age", Math.round(qual.avgOpenAgeDays! * 10) / 10, 22.5);

if (failures) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll assertions passed.");

// ── quarterOffset (pipeline report) ─────────────────────────────────────────
import { quarterOffset } from "../src/lib/hubspot";
const NOW_Q = d("2026-07-07T12:00:00Z"); // Q3 2026
expect("closeQuarter same quarter", quarterOffset(d("2026-08-15T00:00:00Z"), NOW_Q), 0);
expect("closeQuarter next quarter", quarterOffset(d("2026-10-01T00:00:00Z"), NOW_Q), 1);
expect("closeQuarter next year", quarterOffset(d("2027-08-31T00:00:00Z"), NOW_Q), 4);
expect("closeQuarter past clamps to 0", quarterOffset(d("2026-01-05T00:00:00Z"), NOW_Q), 0);
expect("closeQuarter missing clamps to horizon", quarterOffset(null, NOW_Q), 7);
expect("closeQuarter far future clamps to 7", quarterOffset(d("2031-01-01T00:00:00Z"), NOW_Q), 7);

if (failures) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
