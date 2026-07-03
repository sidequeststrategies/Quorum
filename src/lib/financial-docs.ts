export const FINANCIAL_DOC_KINDS = [
  "BOARD_PACK",
  "BALANCE_SHEET",
  "P_AND_L",
  "AR",
  "AP",
  "PRO_FORMA",
  "HEADCOUNT",
  "CAP_TABLE",
  "OTHER",
] as const;

export const FINANCIAL_DOC_LABELS: Record<string, string> = {
  BOARD_PACK: "Board financial pack",
  BALANCE_SHEET: "Balance sheet",
  P_AND_L: "P&L",
  AR: "Accounts receivable",
  AP: "Accounts payable",
  PRO_FORMA: "Pro forma",
  HEADCOUNT: "Headcount",
  CAP_TABLE: "Cap table",
  OTHER: "Other",
};
