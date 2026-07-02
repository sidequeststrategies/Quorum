// Snapshot metric fields shared by the Excel importer (server) and the
// preview grid (client). Kept free of xlsx imports so the client bundle
// doesn't pull in SheetJS.

export const SNAPSHOT_FIELDS = [
  "cash",
  "revenue",
  "mrr",
  "arr",
  "grossMargin",
  "burn",
  "headcount",
  "accountsReceivable",
  "accountsPayable",
] as const;
export type SnapshotField = (typeof SNAPSHOT_FIELDS)[number];

export const SNAPSHOT_FIELD_LABELS: Record<SnapshotField, string> = {
  cash: "Cash on hand",
  revenue: "Monthly revenue",
  mrr: "MRR",
  arr: "ARR",
  grossMargin: "Gross margin (%)",
  burn: "Net burn",
  headcount: "Headcount",
  accountsReceivable: "Accounts receivable",
  accountsPayable: "Accounts payable",
};

export type ParsedRow = { field: SnapshotField; sourceLabel: string; values: (number | null)[] };
export type ParsedImport = {
  sheet: string;
  months: string[]; // YYYY-MM
  rows: ParsedRow[];
  unmatchedLabels: string[];
  warnings: string[];
};
