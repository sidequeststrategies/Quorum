// Dump a row range of a sheet with more columns. Usage:
//   npx tsx scripts/dump-model-range.ts <file.xlsx> <sheet> <fromRow> <toRow> [maxCols]

import * as XLSX from "xlsx";

const [file, sheet, fromArg, toArg, maxCArg] = process.argv.slice(2);
const from = Number(fromArg ?? 0);
const to = Number(toArg ?? 100);
const maxC = Number(maxCArg ?? 14);

const wb = XLSX.readFile(file!);
const ws = wb.Sheets[sheet!];
if (!ws) throw new Error(`no sheet "${sheet}"`);
const grid = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, raw: true, defval: null });
for (let r = from; r <= Math.min(to, grid.length - 1); r++) {
  const row = (grid[r] ?? []).slice(0, maxC);
  if (row.every((c) => c == null || String(c).trim() === "")) continue;
  const cells = row.map((c) => {
    if (c == null) return "";
    if (typeof c === "number") return Math.abs(c) >= 1000 ? Math.round(c).toLocaleString("en-US") : String(Math.round(c * 10000) / 10000);
    return String(c).slice(0, 24);
  });
  console.log(`${String(r).padStart(3)}: ${cells.join(" | ")}`);
}
