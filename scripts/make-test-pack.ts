// Dev utility: generate a plausible AssetCool-style board financial pack and
// run the importer over it, printing what was detected. Usage:
//   npx tsx scripts/make-test-pack.ts [out.xlsx]

import * as XLSX from "xlsx";
import { parseFinancialWorkbook, parseFunnelWorkbook } from "../src/lib/xlsx-import";

const out = process.argv[2] ?? "test-pack.xlsx";

const months = ["Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026", "Jul 2026", "Aug 2026", "Sep 2026"];
// Jun 2026 = report month; Jul–Sep are forecast columns.

const financials = [
  ["AssetCool Ltd — Monthly financials", "", "", "", "", "", "", "", "", ""],
  ["Metric", ...months],
  ["Cash at bank", 4200000, 4050000, 3900000, 3760000, 3650000, 3560000, 3450000, 3350000, 3260000],
  ["Total revenue", 310000, 322000, 335000, 351000, 362000, 390000, 405000, 425000, 450000],
  ["MRR", 195000, 201000, 208000, 216000, 223000, 235000, 245000, 256000, 268000],
  ["ARR", 2340000, 2412000, 2496000, 2592000, 2676000, 2820000, 2940000, 3072000, 3216000],
  ["Gross margin %", 0.58, 0.59, 0.6, 0.61, 0.61, 0.63, 0.63, 0.64, 0.64],
  ["Net burn", 160000, 150000, 150000, 140000, 110000, 90000, 110000, 100000, 90000],
  ["Headcount (FTE)", 42, 43, 44, 46, 47, 49, 51, 53, 54],
  ["Accounts receivable", 280000, 295000, 310000, 305000, 330000, 355000, "", "", ""],
  ["Accounts payable", 120000, 125000, 118000, 130000, 128000, 135000, "", "", ""],
];

const funnel = [
  ["Sales funnel", "", "", "", "", "", ""],
  ["Stage", "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026"],
  ["Leads (MQL)", 120, 135, 128, 150, 162, 175],
  ["Qualified opportunities", 34, 38, 36, 44, 47, 52],
  ["Proposal / pilot", 12, 14, 15, 16, 19, 21],
  ["Negotiation", 5, 6, 7, 7, 9, 10],
  ["Closed won", 2, 3, 3, 4, 4, 6],
  ["Closed lost", 3, 2, 4, 3, 5, 4],
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(financials), "Financials");
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(funnel), "Funnel");
XLSX.writeFile(wb, out);
console.log(`Wrote ${out}`);

const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
const metrics = parseFinancialWorkbook(buf);
console.log("\nMetrics sheet:", metrics.sheet, "| months:", metrics.months.join(", "));
for (const r of metrics.rows) console.log(`  ${r.field.padEnd(20)} ← "${r.sourceLabel}"  [${r.values.join(", ")}]`);
if (metrics.unmatchedLabels.length) console.log("  unmatched:", metrics.unmatchedLabels.join(" · "));

const f = parseFunnelWorkbook(buf);
if (!f) {
  console.log("\nFunnel: NOT DETECTED");
} else {
  console.log("\nFunnel sheet:", f.sheet, "| months:", f.months.join(", "));
  for (const r of f.rows) console.log(`  ${r.stage.padEnd(12)} ← "${r.sourceLabel}"  [${r.values.join(", ")}]`);
}
