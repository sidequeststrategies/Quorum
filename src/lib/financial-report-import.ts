// Core write logic for creating a monthly financial report from a confirmed
// preview grid. Plain module (NOT a server action) so it never becomes a
// client-invokable endpoint — auth lives in the calling action. Also callable
// from scripts/tests with a Map-backed `get`.

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  financialDocuments,
  financialForecastValues,
  financialReports,
  financialSnapshots,
  funnelSnapshots,
} from "@/db/schema";
import { SNAPSHOT_FIELDS } from "@/lib/snapshot-fields";
import { FUNNEL_STAGES, type FunnelStage } from "@/lib/funnel";
import { periodFromString } from "@/lib/utils";

// `get` reads a form field by name; returns the report month written.
export async function applyMonthlyReportImport({
  orgId,
  userId,
  get,
}: {
  orgId: string;
  userId: string;
  get: (name: string) => string | null;
}): Promise<string> {
  const reportMonth = String(get("reportMonth") ?? "");
  if (!/^\d{4}-\d{2}$/.test(reportMonth)) throw new Error("Pick the calendar month this report covers");
  const reportPeriod = periodFromString(reportMonth);

  const months = String(get("months") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{4}-\d{2}$/.test(s));
  if (months.length === 0) throw new Error("Nothing to import");

  const funnelMonths = String(get("funnelMonths") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d{4}-\d{2}$/.test(s));

  // ── Source document ──
  const storedUrl = String(get("storedUrl") ?? "");
  const storedFilename = String(get("storedFilename") ?? "board-pack.xlsx");
  const storedMime = String(get("storedMime") ?? "application/octet-stream");
  const storedSize = Number(get("storedSize") ?? 0);

  let sourceDocumentId: string | null = null;
  if (storedUrl) {
    const [doc] = await db
      .insert(financialDocuments)
      .values({
        organizationId: orgId,
        period: reportPeriod,
        kind: "BOARD_PACK",
        title: `Board financial pack — ${reportMonth}`,
        filename: storedFilename,
        mimeType: storedMime,
        sizeBytes: Math.round(storedSize),
        storagePath: storedUrl,
        uploadedById: userId,
      })
      .returning({ id: financialDocuments.id });
    sourceDocumentId = doc?.id ?? null;
  }

  // ── Report row (one per org+month; re-upload replaces) ──
  const existingReport = await db
    .select()
    .from(financialReports)
    .where(and(eq(financialReports.organizationId, orgId), eq(financialReports.period, reportPeriod)))
    .limit(1);

  let reportId: string;
  const title = `Financial report — ${reportMonth}`;
  if (existingReport[0]) {
    reportId = existingReport[0].id;
    await db
      .update(financialReports)
      .set({ sourceDocumentId: sourceDocumentId ?? existingReport[0].sourceDocumentId, updatedAt: new Date() })
      .where(eq(financialReports.id, reportId));
    // Replace this report's forecast rows wholesale.
    await db.delete(financialForecastValues).where(eq(financialForecastValues.reportId, reportId));
  } else {
    const [row] = await db
      .insert(financialReports)
      .values({ organizationId: orgId, period: reportPeriod, title, sourceDocumentId, createdById: userId })
      .returning({ id: financialReports.id });
    reportId = row.id;
  }

  // ── Metrics: actuals vs forecast split on the report month ──
  for (const month of months) {
    if (get(`use__${month}`) !== "on") continue;

    const patch: Record<string, number> = {};
    for (const field of SNAPSHOT_FIELDS) {
      const raw = get(`val__${month}__${field}`);
      if (raw == null || String(raw).trim() === "") continue;
      const n = Number(raw);
      if (!isFinite(n)) continue;
      patch[field] = Math.round(n);
    }
    if (Object.keys(patch).length === 0) continue;

    const period = periodFromString(month);
    if (month <= reportMonth) {
      const existing = await db
        .select()
        .from(financialSnapshots)
        .where(and(eq(financialSnapshots.organizationId, orgId), eq(financialSnapshots.period, period)))
        .limit(1);
      if (existing[0]) {
        await db
          .update(financialSnapshots)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(financialSnapshots.id, existing[0].id));
      } else {
        await db.insert(financialSnapshots).values({ organizationId: orgId, period, ...patch, createdById: userId });
      }
    } else {
      for (const [field, value] of Object.entries(patch)) {
        await db.insert(financialForecastValues).values({
          reportId,
          organizationId: orgId,
          field,
          targetPeriod: period,
          value,
        });
      }
    }
  }

  // ── Funnel: stage counts/values up to the report month ──
  for (const month of funnelMonths) {
    if (month > reportMonth) continue;
    const period = periodFromString(month);
    for (const stage of FUNNEL_STAGES) {
      const rawCount = get(`fcount__${month}__${stage}`);
      const rawValue = get(`fvalue__${month}__${stage}`);
      const hasCount = rawCount != null && String(rawCount).trim() !== "";
      const hasValue = rawValue != null && String(rawValue).trim() !== "";
      if (!hasCount && !hasValue) continue;
      const count = hasCount && isFinite(Number(rawCount)) ? Math.round(Number(rawCount)) : 0;
      const value = hasValue && isFinite(Number(rawValue)) ? Math.round(Number(rawValue)) : 0;

      const existing = await db
        .select()
        .from(funnelSnapshots)
        .where(
          and(
            eq(funnelSnapshots.organizationId, orgId),
            eq(funnelSnapshots.period, period),
            eq(funnelSnapshots.stage, stage as FunnelStage)
          )
        )
        .limit(1);
      if (existing[0]) {
        await db.update(funnelSnapshots).set({ count, value, reportId }).where(eq(funnelSnapshots.id, existing[0].id));
      } else {
        await db.insert(funnelSnapshots).values({ organizationId: orgId, reportId, period, stage, count, value });
      }
    }
  }

  return reportMonth;
}
