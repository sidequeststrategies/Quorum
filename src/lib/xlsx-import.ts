// Excel → monthly financial snapshot parser.
//
// Accepts the messy reality of founder spreadsheets: any sheet, months across
// columns OR down rows, Excel serial dates or text like "Jan 2026" / "2026-01",
// "$1,234", "(500)" negatives, and margins as 0.72 or 72.
//
// Strategy: for each sheet, find the axis with ≥2 recognizable month cells,
// then match the other axis's labels against metric synonyms. The sheet with
// the most matched metrics wins. Nothing is written here — the caller shows a
// preview and imports explicitly.

import * as XLSX from "xlsx";
import type { ParsedImport, ParsedRow, SnapshotField } from "@/lib/snapshot-fields";

export type { ParsedImport, ParsedRow, SnapshotField } from "@/lib/snapshot-fields";
export { SNAPSHOT_FIELDS, SNAPSHOT_FIELD_LABELS } from "@/lib/snapshot-fields";

// Order matters: more specific patterns first (ARR before AR).
const FIELD_MATCHERS: { field: SnapshotField; re: RegExp; negate?: boolean }[] = [
  { field: "arr", re: /\barr\b|annual(ised|ized)? (recurring )?revenue|annual run.?rate/i },
  { field: "mrr", re: /\bmrr\b|monthly recurring revenue/i },
  { field: "grossMargin", re: /gross\s*margin|gm\s*%|margin\s*%/i },
  { field: "accountsReceivable", re: /receivable|\ba\/?r\b(?!r)|debtors/i },
  { field: "accountsPayable", re: /payable|\ba\/?p\b|creditors/i },
  { field: "cash", re: /cash (on hand|balance|position|at bank)|ending cash|closing cash|\bcash\b|bank balance/i },
  { field: "burn", re: /net burn|monthly burn|\bburn\b(?! ?down)/i },
  // "Net cash flow" is the negative of burn.
  { field: "burn", re: /net cash ?flow|net operating cash/i, negate: true },
  { field: "headcount", re: /head ?count|\bfte\b|employees|team size|staff/i },
  { field: "revenue", re: /total revenue|monthly revenue|net revenue|\brevenue\b|\bsales\b(?! pipeline)|turnover/i },
];

type Cell = string | number | boolean | Date | null | undefined;

const MONTH_NAMES: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

function excelSerialToDate(n: number): Date {
  // Excel epoch (1900 system, with the leap-year bug baked in).
  return new Date(Math.round((n - 25569) * 86400 * 1000));
}

// Try to read a cell as a month; returns "YYYY-MM" or null.
export function cellToMonth(c: Cell): string | null {
  if (c == null || c === "") return null;
  if (c instanceof Date && !isNaN(c.getTime())) {
    return `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, "0")}`;
  }
  if (typeof c === "number") {
    // Excel date serials for 2000–2100 live roughly in 36500–73000.
    if (c > 36000 && c < 80000) {
      const d = excelSerialToDate(c);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    return null;
  }
  if (typeof c !== "string") return null;
  const s = c.trim();

  // "2026-01", "2026/01", "01/2026"
  let m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return `${m[2]}-${String(Number(m[1])).padStart(2, "0")}`;

  // "Jan 2026", "January 2026", "Jan-26", "Jan '26"
  m = s.match(/^([A-Za-z]{3,9})[\s\-'.]*(\d{2,4})$/);
  if (m) {
    const mo = MONTH_NAMES[m[1].slice(0, 4).toLowerCase()] ?? MONTH_NAMES[m[1].slice(0, 3).toLowerCase()];
    if (mo !== undefined) {
      let year = Number(m[2]);
      if (year < 100) year += year < 70 ? 2000 : 1900;
      return `${year}-${String(mo + 1).padStart(2, "0")}`;
    }
  }
  // "2026 Jan"
  m = s.match(/^(\d{4})[\s\-'.]*([A-Za-z]{3,9})$/);
  if (m) {
    const mo = MONTH_NAMES[m[2].slice(0, 3).toLowerCase()];
    if (mo !== undefined) return `${m[1]}-${String(mo + 1).padStart(2, "0")}`;
  }
  return null;
}

export function cellToNumber(c: Cell): number | null {
  if (c == null || c === "") return null;
  if (typeof c === "number") return isFinite(c) ? c : null;
  if (typeof c === "boolean") return null;
  if (c instanceof Date) return null;
  let s = String(c).trim();
  if (!s || /^-+$/.test(s) || /^n\/?a$/i.test(s)) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$£€,\s]/g, "");
  let pct = false;
  if (s.endsWith("%")) {
    pct = true;
    s = s.slice(0, -1);
  }
  const n = Number(s);
  if (!isFinite(n)) return null;
  const val = negative ? -n : n;
  return pct ? val : val;
}

function matchField(label: string): { field: SnapshotField; negate: boolean } | null {
  for (const { field, re, negate } of FIELD_MATCHERS) {
    if (re.test(label)) return { field, negate: !!negate };
  }
  return null;
}

function parseGrid(grid: Cell[][], sheet: string): ParsedImport | null {
  // Find the best header row (months across columns).
  let best: { rowIdx: number; cols: { col: number; month: string }[] } | null = null;
  for (let r = 0; r < Math.min(grid.length, 30); r++) {
    const row = grid[r] ?? [];
    const cols: { col: number; month: string }[] = [];
    for (let c = 0; c < row.length; c++) {
      const month = cellToMonth(row[c]);
      if (month) cols.push({ col: c, month });
    }
    if (cols.length >= 2 && (!best || cols.length > best.cols.length)) best = { rowIdx: r, cols };
  }

  if (best) {
    const rows: ParsedRow[] = [];
    const unmatched: string[] = [];
    const seen = new Set<SnapshotField>();
    for (let r = best.rowIdx + 1; r < grid.length; r++) {
      const row = grid[r] ?? [];
      // Label = first non-empty cell before the first month column.
      let label = "";
      for (let c = 0; c < best.cols[0].col; c++) {
        const v = row[c];
        if (v != null && String(v).trim() !== "") {
          label = String(v).trim();
          break;
        }
      }
      if (!label) continue;
      const hit = matchField(label);
      if (!hit || seen.has(hit.field)) {
        const hasNumbers = best.cols.some(({ col }) => cellToNumber(row[col]) != null);
        if (hasNumbers) unmatched.push(label);
        continue;
      }
      const values = best.cols.map(({ col }) => {
        let v = cellToNumber(row[col]);
        if (v == null) return null;
        if (hit.negate) v = -v;
        if (hit.field === "grossMargin" && Math.abs(v) <= 1.5) v = v * 100; // 0.72 → 72
        return Math.round(v * 100) / 100;
      });
      if (values.every((v) => v == null)) continue;
      seen.add(hit.field);
      rows.push({ field: hit.field, sourceLabel: label, values });
    }
    if (rows.length > 0) {
      return {
        sheet,
        months: best.cols.map((c) => c.month),
        rows,
        unmatchedLabels: unmatched.slice(0, 20),
        warnings: [],
      };
    }
  }
  return null;
}

function transpose(grid: Cell[][]): Cell[][] {
  const w = Math.max(...grid.map((r) => r.length), 0);
  const out: Cell[][] = [];
  for (let c = 0; c < w; c++) out.push(grid.map((r) => r[c]));
  return out;
}

export function parseFinancialWorkbook(buf: Buffer | ArrayBuffer): ParsedImport {
  const wb = XLSX.read(buf, { type: buf instanceof ArrayBuffer ? "array" : "buffer", cellDates: true });
  const candidates: ParsedImport[] = [];

  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const grid = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null }) as Cell[][];
    if (!grid.length) continue;
    const direct = parseGrid(grid, name);
    if (direct) candidates.push(direct);
    // Months down rows → transpose and retry.
    const flipped = parseGrid(transpose(grid), name);
    if (flipped && (!direct || flipped.rows.length > direct.rows.length)) candidates.push(flipped);
  }

  if (candidates.length === 0) {
    return {
      sheet: "",
      months: [],
      rows: [],
      unmatchedLabels: [],
      warnings: [
        "Could not find a month axis. Expect a sheet with months across the top (e.g. Jan 2026, Feb 2026…) and metric names down the first column.",
      ],
    };
  }

  candidates.sort((a, b) => b.rows.length * b.months.length - a.rows.length * a.months.length);
  const winner = candidates[0];
  if (candidates.length > 1) {
    winner.warnings.push(
      `Multiple sheets looked like financials; imported "${winner.sheet}". Re-upload a single sheet if that's wrong.`
    );
  }
  return winner;
}
