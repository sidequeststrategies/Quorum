"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { financialSnapshots } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { parseFinancialWorkbook } from "@/lib/xlsx-import";
import { SNAPSHOT_FIELDS, type ParsedImport } from "@/lib/snapshot-fields";
import { periodFromString } from "@/lib/utils";

const XLSX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);
const MAX_BYTES = 15 * 1024 * 1024;

export type ImportPreviewState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "parsed"; fileName: string; preview: ParsedImport };

export async function parseExcelAction(
  _prev: ImportPreviewState,
  formData: FormData
): Promise<ImportPreviewState> {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) return { status: "error", message: "Only owners/admins can import financials." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { status: "error", message: "Choose an Excel (.xlsx) or CSV file." };
  if (file.size > MAX_BYTES) return { status: "error", message: "File exceeds 15MB limit." };
  if (!XLSX_MIME.has(file.type) && !/\.(xlsx|xls|csv)$/i.test(file.name)) {
    return { status: "error", message: `Unsupported file type: ${file.type || file.name}` };
  }

  try {
    const preview = parseFinancialWorkbook(Buffer.from(await file.arrayBuffer()));
    if (preview.months.length === 0 || preview.rows.length === 0) {
      return {
        status: "error",
        message:
          preview.warnings[0] ??
          "No recognizable metrics found. Expect months across the top and metric names (Cash, Revenue, MRR, Burn…) down the first column.",
      };
    }
    return { status: "parsed", fileName: file.name, preview };
  } catch (e) {
    return { status: "error", message: `Could not read the workbook: ${(e as Error).message}` };
  }
}

// Import the (possibly hand-corrected) preview grid into monthly snapshots.
// Upsert per month; only fields with values are written, so a partial
// spreadsheet never zeroes out data entered by hand.
export async function importSnapshotsAction(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const months = String(formData.get("months") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{4}-\d{2}$/.test(s));
  if (months.length === 0) throw new Error("Nothing to import");

  let imported = 0;
  for (const month of months) {
    if (formData.get(`use__${month}`) !== "on") continue;

    const patch: Record<string, number> = {};
    for (const field of SNAPSHOT_FIELDS) {
      const raw = formData.get(`val__${month}__${field}`);
      if (raw == null || String(raw).trim() === "") continue;
      const n = Number(raw);
      if (!isFinite(n)) continue;
      patch[field] = Math.round(n);
    }
    if (Object.keys(patch).length === 0) continue;

    const period = periodFromString(month);
    const existing = await db
      .select()
      .from(financialSnapshots)
      .where(
        and(eq(financialSnapshots.organizationId, membership.organizationId), eq(financialSnapshots.period, period))
      )
      .limit(1);

    if (existing[0]) {
      await db
        .update(financialSnapshots)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(financialSnapshots.id, existing[0].id));
    } else {
      await db.insert(financialSnapshots).values({
        organizationId: membership.organizationId,
        period,
        ...patch,
        createdById: user.id,
      });
    }
    imported++;
  }

  revalidatePath("/financials");
  redirect(`/financials?imported=${imported}`);
}
