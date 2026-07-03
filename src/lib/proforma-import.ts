// Financial-model workbook → ProFormaBaseline parser.
//
// Reads the model the way a person does: finds the quarterly P&L sheet (the
// one with "Q1 FY27"-style column headers and REVENUE / COST OF SALES /
// OVERHEADS sections), the quarterly cash-flow sheet (capex, financing,
// opening cash, the working-capital day-count block), and the headcount plan.
// Everything is matched by label, not cell address, so the model can move
// rows around between vintages without breaking the import.

import * as XLSX from "xlsx";
import type { ProFormaBaseline, ProFormaLine, ProFormaOverhead } from "@/lib/proforma";

type Cell = string | number | boolean | Date | null;
type Grid = Cell[][];

const norm = (s: Cell) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9&%]+/g, " ")
    .trim();

const num = (c: Cell): number => (typeof c === "number" && isFinite(c) ? c : 0);

function sheetGrid(wb: XLSX.WorkBook, name: string): Grid {
  return XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, raw: true, defval: null }) as Grid;
}

const QUARTER_RE = /^Q[1-4]\s*FY\s*\d{2,4}$/i;

function findQuarterHeader(grid: Grid): { row: number; cols: number[]; labels: string[] } | null {
  for (let r = 0; r < Math.min(grid.length, 20); r++) {
    const row = grid[r] ?? [];
    const cols: number[] = [];
    const labels: string[] = [];
    for (let c = 0; c < row.length; c++) {
      const v = String(row[c] ?? "").trim();
      if (QUARTER_RE.test(v)) {
        cols.push(c);
        labels.push(v.replace(/\s+/g, " "));
      }
    }
    if (cols.length >= 4) return { row: r, cols, labels };
  }
  return null;
}

// First column left of the quarter columns that holds row labels.
function rowLabel(row: Cell[], firstQuarterCol: number): string {
  for (let c = 0; c < firstQuarterCol; c++) {
    const v = row?.[c];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function values(row: Cell[], cols: number[]): number[] {
  return cols.map((c) => num(row?.[c]));
}

function findRow(grid: Grid, hdrRow: number, firstCol: number, match: (label: string) => boolean): Cell[] | null {
  for (let r = hdrRow + 1; r < grid.length; r++) {
    const label = norm(rowLabel(grid[r] ?? [], firstCol));
    if (label && match(label)) return grid[r];
  }
  return null;
}

function pickSheet(wb: XLSX.WorkBook, patterns: RegExp[], required: (grid: Grid) => boolean): { name: string; grid: Grid } | null {
  // Prefer name matches, then fall back to content scan.
  const ordered = [
    ...wb.SheetNames.filter((n) => patterns.some((p) => p.test(n))),
    ...wb.SheetNames.filter((n) => !patterns.some((p) => p.test(n))),
  ];
  for (const name of ordered) {
    const grid = sheetGrid(wb, name);
    if (grid.length && findQuarterHeader(grid) && required(grid)) return { name, grid };
  }
  return null;
}

const hasLabel = (grid: Grid, re: RegExp) =>
  grid.some((row) => row?.some((c) => typeof c === "string" && re.test(c)));

export function parseProFormaWorkbook(buf: Buffer | ArrayBuffer): ProFormaBaseline {
  const wb = XLSX.read(buf, { type: buf instanceof ArrayBuffer ? "array" : "buffer", cellDates: true });

  // ── Quarterly P&L ──
  const pnl = pickSheet(
    wb,
    [/profit\s*&?\s*loss.*q/i, /q.*profit\s*&?\s*loss/i, /p\s*&\s*l.*q/i],
    (g) => hasLabel(g, /^\s*REVENUE\s*$/i) && hasLabel(g, /^\s*OVERHEADS\s*$/i)
  );
  if (!pnl) throw new Error("Could not find a quarterly P&L sheet (needs Q1 FY.. columns plus REVENUE and OVERHEADS sections).");
  const qh = findQuarterHeader(pnl.grid)!;
  const quarters = qh.labels;
  const firstCol = qh.cols[0];

  // Walk the P&L sections.
  const lines: ProFormaLine[] = [];
  const overheads: ProFormaOverhead[] = [];
  let grants: number[] | null = null;
  let reportedEbitda: number[] | null = null;
  const cogsByName = new Map<string, number[]>();
  const cogsInOrder: number[][] = [];

  let section: "none" | "revenue" | "cos" | "overheads" = "none";
  for (let r = qh.row + 1; r < pnl.grid.length; r++) {
    const row = pnl.grid[r] ?? [];
    const label = rowLabel(row, firstCol);
    if (!label) continue;
    const nl = norm(label);

    if (/^revenue$/.test(nl)) {
      section = "revenue";
      continue;
    }
    if (/^cost of sales$|^cost of goods sold$/.test(nl)) {
      section = "cos";
      continue;
    }
    if (/^overheads$/.test(nl)) {
      section = "overheads";
      continue;
    }
    if (/^total revenue/.test(nl) || /^total cost of sales/.test(nl) || /^total overheads/.test(nl)) {
      section = "none";
      continue;
    }
    if (/^ebitda$/.test(nl)) {
      reportedEbitda = values(row, qh.cols);
      continue;
    }
    if (/^grants$/.test(nl)) {
      grants = values(row, qh.cols);
      continue;
    }
    if (/overhead flex/.test(nl)) break; // config block below the statement

    if (section === "revenue") {
      lines.push({ name: label, revenue: values(row, qh.cols), cogs: [] });
    } else if (section === "cos") {
      const v = values(row, qh.cols).map((x) => Math.abs(x));
      cogsByName.set(nl, v);
      cogsInOrder.push(v);
    } else if (section === "overheads") {
      overheads.push({ name: label, values: values(row, qh.cols).map((x) => Math.abs(x)) });
    }
  }
  if (lines.length === 0) throw new Error("No revenue lines found in the quarterly P&L.");
  // Attach cost of sales to revenue lines by name, falling back to order.
  lines.forEach((line, i) => {
    line.cogs = cogsByName.get(norm(line.name)) ?? cogsInOrder[i] ?? quarters.map(() => 0);
  });

  // ── Quarterly cash flow ──
  const cf = pickSheet(wb, [/cash\s*flow/i], (g) => hasLabel(g, /opening cash/i));
  if (!cf) throw new Error("Could not find a quarterly cash-flow sheet (needs an 'Opening cash' row).");
  const cq = findQuarterHeader(cf.grid)!;
  const n = Math.min(quarters.length, cq.labels.length);
  const cfRow = (re: RegExp) => findRow(cf.grid, cq.row, cq.cols[0], (l) => re.test(l));

  const capexRow = cfRow(/^capital expenditure/);
  const taxRow = cfRow(/^taxation/);
  const interestRow = cfRow(/^interest income/);
  const loanRow = cfRow(/^movement in loan/);
  const equityRow = cfRow(/^proceeds from issue/);
  const openingCashRow = cfRow(/^opening cash/);
  const closingCashRow = cfRow(/^closing cash/);
  const dsoRow = cfRow(/^debtor days/);
  const dpoRow = cfRow(/^creditor days/);
  const invRow = cfRow(/^inventory days/);
  const nwcRow = cfRow(/^net working capital/);
  const nwcOpenRow = cfRow(/^opening net working/);
  if (!openingCashRow) throw new Error("Cash-flow sheet is missing an 'Opening cash' row.");

  const capex = capexRow ? values(capexRow, cq.cols).map((x) => Math.abs(x)) : quarters.map(() => 0);
  const tax = taxRow ? values(taxRow, cq.cols) : quarters.map(() => 0);
  const financingParts = [interestRow, loanRow, equityRow].filter(Boolean) as Cell[][];
  const financing = quarters.map((_, q) => financingParts.reduce((s, row) => s + values(row, cq.cols)[q], 0));
  const openingCash = values(openingCashRow, cq.cols)[0];
  const reportedClosingCash = closingCashRow ? values(closingCashRow, cq.cols) : undefined;
  const dso = dsoRow ? values(dsoRow, cq.cols)[0] : 60;
  const dpo = dpoRow ? values(dpoRow, cq.cols)[0] : 30;
  const inventoryDays = invRow ? values(invRow, cq.cols)[0] : 0;
  const nwcActual = nwcRow ? values(nwcRow, cq.cols) : quarters.map(() => 0);
  const nwcOpening = nwcOpenRow ? values(nwcOpenRow, cq.cols)[0] : nwcActual[0] ?? 0;

  // ── Headcount ──
  let headcount: number[] = quarters.map(() => 0);
  const hc = pickSheet(wb, [/headcount(?!.*yoy)/i], (g) => hasLabel(g, /total headcount/i));
  if (hc) {
    const hq = findQuarterHeader(hc.grid)!;
    const hcRow = findRow(hc.grid, hq.row, hq.cols[0], (l) => /^total headcount/.test(l));
    if (hcRow) headcount = values(hcRow, hq.cols);
  }

  // ── Assemble (trim all series to the common quarter count) ──
  const trim = (arr: number[]) => arr.slice(0, n);
  const fiscalYears: string[] = [];
  for (const q of quarters.slice(0, n)) {
    const fy = q.replace(/^Q[1-4]\s*/i, "").replace(/\s+/g, "");
    if (fiscalYears[fiscalYears.length - 1] !== fy) fiscalYears.push(fy);
  }

  const staffing = overheads.find((o) => /staff|payroll|people/i.test(o.name));

  return {
    currency: "£",
    quarters: quarters.slice(0, n),
    fiscalYears,
    lines: lines.map((l) => ({ name: l.name, revenue: trim(l.revenue), cogs: trim(l.cogs) })),
    overheads: overheads.map((o) => ({ name: o.name, values: trim(o.values) })),
    grants: trim(grants ?? quarters.map(() => 0)),
    capex: trim(capex),
    tax: trim(tax),
    financing: trim(financing),
    openingCash,
    dso,
    dpo,
    inventoryDays,
    nwcActual: trim(nwcActual),
    nwcOpening,
    headcount: trim(headcount),
    staffingOverheadName: staffing?.name ?? "Staffing costs",
    reportedEbitda: reportedEbitda ? trim(reportedEbitda) : undefined,
    reportedClosingCash: reportedClosingCash ? trim(reportedClosingCash) : undefined,
  };
}
