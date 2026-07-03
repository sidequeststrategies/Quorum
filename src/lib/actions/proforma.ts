"use server";
// Actions for the pro forma modeling section: parse an uploaded financial
// model workbook into a quarterly baseline, then store it as the org's
// current model vintage. The workbook itself is kept (private storage) so
// the numbers are always traceable to a source file.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { financialDocuments, proFormaModels } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { getStorage } from "@/lib/storage";
import { parseProFormaWorkbook } from "@/lib/proforma-import";
import { runProForma, NEUTRAL_ADJUSTMENTS, type ProFormaBaseline } from "@/lib/proforma";
import { logAccess } from "@/lib/audit";
import { periodFromString } from "@/lib/utils";

const XLSX_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);
const MAX_BYTES = 25 * 1024 * 1024;

export type ProFormaParseState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "parsed";
      stored: { url: string; filename: string; mimeType: string; sizeBytes: number };
      baseline: ProFormaBaseline;
      // Headline validation shown in the preview
      summary: {
        quarters: number;
        fiscalYears: string[];
        lines: string[];
        firstFyRevenue: number;
        finalFyRevenue: number;
        breakeven: string | null;
        minCash: number;
        matchesWorkbook: boolean | null;
      };
    };

export async function parseProFormaAction(_prev: ProFormaParseState, formData: FormData): Promise<ProFormaParseState> {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) return { status: "error", message: "Only owners/admins can upload models." };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { status: "error", message: "Choose the model workbook (.xlsx)." };
  if (file.size > MAX_BYTES) return { status: "error", message: "File exceeds 25MB limit." };
  if (!XLSX_MIME.has(file.type) && !/\.(xlsx|xls)$/i.test(file.name)) {
    return { status: "error", message: `Unsupported file type: ${file.type || file.name}` };
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const baseline = parseProFormaWorkbook(buf);
    const result = runProForma(baseline, NEUTRAL_ADJUSTMENTS);

    // Validation: with neutral sliders the engine must reproduce the
    // workbook's own EBITDA. If it can't, say so up front.
    let matchesWorkbook: boolean | null = null;
    if (baseline.reportedEbitda) {
      const maxDiff = Math.max(...baseline.reportedEbitda.map((e, q) => Math.abs(e - result.quarterly.ebitda[q])));
      matchesWorkbook = maxDiff < 1000;
    }

    const stored = await getStorage().put({
      keyHint: `${membership.organizationId}/financials/${Date.now()}-MODEL-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80)}`,
      data: buf,
      mimeType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      organizationId: membership.organizationId,
      filename: file.name,
    });
    await logAccess({
      organizationId: membership.organizationId,
      userId: membership.userId,
      action: "FILE_UPLOAD",
      resource: "proforma-model",
      detail: file.name,
    });

    return {
      status: "parsed",
      stored: { url: stored.url, filename: file.name, mimeType: stored.mimeType, sizeBytes: stored.size },
      baseline,
      summary: {
        quarters: baseline.quarters.length,
        fiscalYears: baseline.fiscalYears,
        lines: baseline.lines.map((l) => l.name),
        firstFyRevenue: result.annual[0]?.revenue ?? 0,
        finalFyRevenue: result.annual[result.annual.length - 1]?.revenue ?? 0,
        breakeven: result.kpis.ebitdaBreakevenQuarter,
        minCash: result.kpis.minCash,
        matchesWorkbook,
      },
    };
  } catch (e) {
    return { status: "error", message: `Could not parse the model: ${(e as Error).message}` };
  }
}

export async function createProFormaModelAction(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const orgId = membership.organizationId;

  const name = String(formData.get("name") ?? "").trim() || "Financial model";
  const vintageStr = String(formData.get("vintage") ?? "");
  if (!/^\d{4}-\d{2}$/.test(vintageStr)) throw new Error("Pick the model vintage month");
  const baselineJson = String(formData.get("baselineJson") ?? "");
  if (!baselineJson) throw new Error("Missing parsed baseline — re-upload the workbook");
  // Validate it round-trips as a baseline the engine accepts.
  runProForma(JSON.parse(baselineJson) as ProFormaBaseline, NEUTRAL_ADJUSTMENTS);

  const storedUrl = String(formData.get("storedUrl") ?? "");
  const storedFilename = String(formData.get("storedFilename") ?? "model.xlsx");
  const storedMime = String(formData.get("storedMime") ?? "application/octet-stream");
  const storedSize = Number(formData.get("storedSize") ?? 0);
  const vintage = periodFromString(vintageStr);

  let sourceDocumentId: string | null = null;
  if (storedUrl) {
    const [doc] = await db
      .insert(financialDocuments)
      .values({
        organizationId: orgId,
        period: vintage,
        kind: "PRO_FORMA",
        title: `${name} — ${vintageStr}`,
        filename: storedFilename,
        mimeType: storedMime,
        sizeBytes: Math.round(storedSize),
        storagePath: storedUrl,
        uploadedById: user.id,
      })
      .returning({ id: financialDocuments.id });
    sourceDocumentId = doc?.id ?? null;
  }

  await db.insert(proFormaModels).values({
    organizationId: orgId,
    name,
    vintage,
    sourceDocumentId,
    baselineJson,
    createdById: user.id,
  });

  await logAccess({
    organizationId: orgId,
    userId: user.id,
    action: "REPORT_CREATE",
    resource: "proforma-model",
    detail: `${name} (${vintageStr})`,
  });

  revalidatePath("/financials/proforma");
  revalidatePath("/financials");
  redirect("/financials/proforma");
}

export async function deleteProFormaModelAction(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(proFormaModels)
    .where(and(eq(proFormaModels.id, id), eq(proFormaModels.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.delete(proFormaModels).where(eq(proFormaModels.id, id));
  await logAccess({
    organizationId: membership.organizationId,
    action: "REPORT_DELETE",
    resource: "proforma-model",
    resourceId: id,
    detail: rows[0].name,
  });
  revalidatePath("/financials/proforma");
  redirect("/financials/proforma");
}
