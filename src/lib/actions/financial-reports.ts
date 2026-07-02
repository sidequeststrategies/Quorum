"use server";
// Actions for the monthly financial report flow: parse an uploaded board
// financial pack (Excel), then create the calendar-month report from the
// (possibly hand-corrected) preview.
//
// The workbook is stored to blob storage during the parse step, so the create
// step only carries the stored URL — the browser never re-uploads the file.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { financialReports } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { parseFinancialWorkbook, parseFunnelWorkbook } from "@/lib/xlsx-import";
import { type ParsedImport } from "@/lib/snapshot-fields";
import { type ParsedFunnel } from "@/lib/funnel";
import { applyMonthlyReportImport } from "@/lib/financial-report-import";
import { currentPeriodString } from "@/lib/utils";

const XLSX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);
const MAX_BYTES = 25 * 1024 * 1024;

export type StoredPack = { url: string; filename: string; mimeType: string; sizeBytes: number };

export type ReportPackPreviewState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "parsed";
      stored: StoredPack;
      metrics: ParsedImport;
      funnel: ParsedFunnel | null;
      suggestedMonth: string; // YYYY-MM
    };

export async function parseReportPackAction(
  _prev: ReportPackPreviewState,
  formData: FormData
): Promise<ReportPackPreviewState> {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) return { status: "error", message: "Only owners/admins can create financial reports." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { status: "error", message: "Choose an Excel (.xlsx) or CSV file." };
  if (file.size > MAX_BYTES) return { status: "error", message: "File exceeds 25MB limit." };
  if (!XLSX_MIME.has(file.type) && !/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return { status: "error", message: `Unsupported file type: ${file.type || file.name}` };
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const metrics = parseFinancialWorkbook(buf);
    if (metrics.months.length === 0 || metrics.rows.length === 0) {
      return {
        status: "error",
        message:
          metrics.warnings[0] ??
          "No recognizable metrics found. Expect months across the top and metric names (Cash, Revenue, MRR, Burn…) down the first column.",
      };
    }
    const funnel = parseFunnelWorkbook(buf);

    // Store the workbook now so the create step doesn't need the file again.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const keyHint = `${membership.organizationId}/financials/${Date.now()}-BOARD_PACK-${safeName}`;
    const stored = await getStorage().put({
      keyHint,
      data: buf,
      mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    // Suggest the latest parsed month that isn't in the future — that's
    // almost always the month being reported; later columns are forecast.
    const now = currentPeriodString();
    const pastMonths = metrics.months.filter((m) => m <= now);
    const suggestedMonth = pastMonths[pastMonths.length - 1] ?? metrics.months[0];

    return {
      status: "parsed",
      stored: { url: stored.url, filename: file.name, mimeType: stored.mimeType, sizeBytes: stored.size },
      metrics,
      funnel,
      suggestedMonth,
    };
  } catch (e) {
    return { status: "error", message: `Could not read the workbook: ${(e as Error).message}` };
  }
}

// Create (or refresh) the monthly report from the confirmed preview grid.
// Months up to and including the report month become snapshot actuals;
// months after it become this report's forecast rows; funnel columns up to
// the report month become funnel snapshots.
export async function createMonthlyReportAction(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const reportMonth = await applyMonthlyReportImport({
    orgId: membership.organizationId,
    userId: user.id,
    get: (name) => {
      const v = formData.get(name);
      return v == null ? null : String(v);
    },
  });

  revalidatePath("/financials");
  revalidatePath(`/financials/reports/${reportMonth}`);
  redirect(`/financials/reports/${reportMonth}`);
}

export async function deleteMonthlyReportAction(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(financialReports)
    .where(and(eq(financialReports.id, id), eq(financialReports.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  // Forecast rows cascade; snapshots and funnel data stay (they're the
  // org's actuals, not the report's).
  await db.delete(financialReports).where(eq(financialReports.id, id));
  revalidatePath("/financials");
  redirect("/financials");
}
