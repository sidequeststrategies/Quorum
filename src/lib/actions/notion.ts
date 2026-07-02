"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reportTemplates, reports } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { notionConfigured, pullReportFromNotion, pushReportToNotion } from "@/lib/notion-sync";
import type { TemplateSection } from "@/lib/report-template-defs";

async function loadReportWithSections(id: string, organizationId: string) {
  const rows = await db
    .select({ r: reports, tmpSections: reportTemplates.sections })
    .from(reports)
    .leftJoin(reportTemplates, eq(reports.templateId, reportTemplates.id))
    .where(and(eq(reports.id, id), eq(reports.organizationId, organizationId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Not found");
  let sections: TemplateSection[] = [];
  try {
    sections = JSON.parse(row.tmpSections ?? "[]") as TemplateSection[];
  } catch {
    /* noop */
  }
  if (sections.length === 0) throw new Error("This report has no template sections to sync");
  return { report: row.r, sections };
}

export async function syncReportToNotion(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  if (!notionConfigured) throw new Error("Notion is not configured (NOTION_TOKEN / NOTION_REPORTS_PAGE_ID)");

  const id = String(formData.get("id"));
  const { report, sections } = await loadReportWithSections(id, membership.organizationId);
  let values: Record<string, string> = {};
  try {
    values = JSON.parse(report.values) as Record<string, string>;
  } catch {
    /* noop */
  }

  const pageId = await pushReportToNotion(report, sections, values);
  await db
    .update(reports)
    .set({ notionPageId: pageId, notionSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(reports.id, id));

  revalidatePath(`/reports/${id}`);
}

export async function pullReportFromNotionAction(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  if (!notionConfigured) throw new Error("Notion is not configured (NOTION_TOKEN / NOTION_REPORTS_PAGE_ID)");

  const id = String(formData.get("id"));
  const { report, sections } = await loadReportWithSections(id, membership.organizationId);
  if (!report.notionPageId) throw new Error("This report has not been pushed to Notion yet");

  const pulled = await pullReportFromNotion(report.notionPageId, sections);
  let existing: Record<string, string> = {};
  try {
    existing = JSON.parse(report.values) as Record<string, string>;
  } catch {
    /* noop */
  }

  await db
    .update(reports)
    .set({
      values: JSON.stringify({ ...existing, ...pulled }),
      notionSyncedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(reports.id, id));

  revalidatePath(`/reports/${id}`);
}
