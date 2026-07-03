// Dev utility: dump a readable outline of a financial model workbook.
// Usage: npx tsx scripts/dump-model.ts <file.xlsx> [sheet] [maxRows] [maxCols]

import * as XLSX from "xlsx";

const [file, sheetArg, maxRArg, maxCArg] = process.argv.slice(2);
if (!file) throw new Error("pass the xlsx path");
const maxR = Number(maxRArg ?? 80);
const maxC = Number(maxCArg ?? 12);

const wb = XLSX.readFile(file);
const sheets = sheetArg ? [sheetArg] : wb.SheetNames;

for (const name of sheets) {
  const ws = wb.Sheets[name];
  if (!ws) {
    console.log(`(no sheet named "${name}")`);
    continue;
  }
  const grid = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1, raw: true, defval: null });
  console.log(`===== ${name} (${grid.length} rows) =====`);
  let printed = 0;
  for (let r = 0; r < grid.length && printed < maxR; r++) {
    const row = (grid[r] ?? []).slice(0, maxC);
    if (row.every((c) => c == null || String(c).trim() === "")) continue;
    const cells = row.map((c) => {
      if (c == null) return "";
      if (typeof c === "number") return Math.abs(c) >= 1000 ? Math.round(c).toLocaleString("en-US") : String(Math.round(c * 1000) / 1000);
      return String(c).slice(0, 26);
    });
    console.log(`${String(r).padStart(3)}: ${cells.join(" | ")}`);
    printed++;
  }
}
