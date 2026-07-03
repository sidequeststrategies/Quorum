// Validation: parse the real model workbook, run the engine with neutral
// sliders, and check it reproduces the workbook's own EBITDA and cash.
// Usage: npx tsx scripts/test-proforma.ts <model.xlsx>

import fs from "node:fs";
import { parseProFormaWorkbook } from "../src/lib/proforma-import";
import { runProForma, NEUTRAL_ADJUSTMENTS } from "../src/lib/proforma";

const buf = fs.readFileSync(process.argv[2]!);
const b = parseProFormaWorkbook(buf);

console.log(`Quarters: ${b.quarters.length} (${b.quarters[0]} … ${b.quarters[b.quarters.length - 1]})`);
console.log(`FYs: ${b.fiscalYears.join(", ")}`);
console.log(`Lines: ${b.lines.map((l) => l.name).join(" | ")}`);
console.log(`Overheads: ${b.overheads.map((o) => o.name).join(" | ")}`);
console.log(`Opening cash: ${b.openingCash.toLocaleString()} · DSO ${b.dso} · DPO ${b.dpo} · Inv ${b.inventoryDays}`);
console.log(`Headcount: ${b.headcount[0]} → ${b.headcount[b.headcount.length - 1]}`);

const r = runProForma(b, NEUTRAL_ADJUSTMENTS);

console.log("\nAnnual (engine, neutral sliders):");
for (const a of r.annual) {
  console.log(
    `  ${a.fy}: rev ${(a.revenue / 1e6).toFixed(2)}M · GM ${a.grossMarginPct?.toFixed(1)}% · OH ${(a.overheads / 1e6).toFixed(2)}M · EBITDA ${(a.ebitda / 1e6).toFixed(2)}M · cash ${(a.closingCash / 1e6).toFixed(2)}M`
  );
}

// Validate EBITDA against the workbook's own quarterly EBITDA row.
if (b.reportedEbitda) {
  let maxDiff = 0;
  b.reportedEbitda.forEach((e, q) => {
    maxDiff = Math.max(maxDiff, Math.abs(e - r.quarterly.ebitda[q]));
  });
  console.log(`\nEBITDA vs workbook: max quarterly diff ${Math.round(maxDiff).toLocaleString()} ${maxDiff < 1000 ? "✓" : "✗ INVESTIGATE"}`);
}
if (b.reportedClosingCash) {
  let maxDiff = 0;
  b.reportedClosingCash.forEach((c, q) => {
    maxDiff = Math.max(maxDiff, Math.abs(c - r.quarterly.closingCash[q]));
  });
  const last = b.reportedClosingCash.length - 1;
  console.log(
    `Closing cash vs workbook: max diff ${Math.round(maxDiff).toLocaleString()} (final: engine ${Math.round(r.quarterly.closingCash[last] / 1e6)}M vs workbook ${Math.round(b.reportedClosingCash[last] / 1e6)}M) ${maxDiff < 100000 ? "✓" : "✗ INVESTIGATE"}`
  );
}

console.log(`\nKPIs: breakeven ${r.kpis.ebitdaBreakevenQuarter} · min cash ${(r.kpis.minCash / 1e6).toFixed(2)}M @ ${r.kpis.minCashQuarter} · FY28 rev ${(r.kpis.fy28Revenue / 1e6).toFixed(1)}M`);

// Sanity: a slider move behaves directionally.
const up = runProForma(b, { ...NEUTRAL_ADJUSTMENTS, pricePct: 10 });
console.log(`Price +10% → FY28 rev ${(up.kpis.fy28Revenue / 1e6).toFixed(1)}M (expect ~+10%)`);
