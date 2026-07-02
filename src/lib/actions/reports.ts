"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, financialSnapshots, organizations, reportTemplates, reports } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { REPORT_SECTION_KINDS, REPORT_STATUSES } from "@/lib/enums";
import { fmtUSD } from "@/lib/finance";
import { getStorage } from "@/lib/storage";

const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(REPORT_SECTION_KINDS),
  prompt: z.string().optional(),
  placeholder: z.string().optional(),
});

const templateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  sections: z.array(sectionSchema).min(1),
});

export async function createTemplate(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const sectionsRaw = String(formData.get("sectionsJson") ?? "[]");
  let sections: unknown;
  try {
    sections = JSON.parse(sectionsRaw);
  } catch {
    throw new Error("Invalid sections payload");
  }

  const parsed = templateSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    sections,
  });

  const [t] = await db
    .insert(reportTemplates)
    .values({
      organizationId: membership.organizationId,
      name: parsed.name,
      description: parsed.description ?? null,
      sections: JSON.stringify(parsed.sections),
    })
    .returning();

  revalidatePath("/reports");
  redirect(`/reports/templates/${t.id}`);
}

const reportSchema = z.object({
  templateId: z.string().optional(),
  meetingId: z.string().optional(),
  title: z.string().min(2),
});

export async function createReport(formData: FormData) {
  const { user, membership } = await requireMembership();

  const parsed = reportSchema.parse({
    templateId: formData.get("templateId") || undefined,
    meetingId: formData.get("meetingId") || undefined,
    title: formData.get("title"),
  });

  const templateId = parsed.templateId && parsed.templateId !== "none" ? parsed.templateId : null;
  const meetingId = parsed.meetingId && parsed.meetingId !== "none" ? parsed.meetingId : null;

  // Pre-fill KPI / metric sections from the latest financial snapshot if one exists.
  // Saves the writer 30 seconds and ensures consistency.
  let initialValues: Record<string, string> = {};
  if (templateId) {
    const tmplRows = await db.select().from(reportTemplates).where(eq(reportTemplates.id, templateId)).limit(1);
    const tmpl = tmplRows[0];
    if (tmpl) {
      type Section = { id: string; title: string; kind: string };
      let sections: Section[] = [];
      try {
        sections = JSON.parse(tmpl.sections) as Section[];
      } catch {
        /* noop */
      }
      const metricSection = sections.find((s) => s.kind === "metric");
      if (metricSection) {
        const snapshotRows = await db
          .select()
          .from(financialSnapshots)
          .where(eq(financialSnapshots.organizationId, membership.organizationId))
          .orderBy(desc(financialSnapshots.period))
          .limit(2);
        const latest = snapshotRows[0];
        const prior = snapshotRows[1];
        if (latest) {
          const arrDelta = prior
            ? ` (${latest.arr >= prior.arr ? "+" : ""}${prior.arr === 0 ? "—" : Math.round(((latest.arr - prior.arr) / prior.arr) * 100) + "%"} vs prior)`
            : "";
          const runwayMonths = latest.burn > 0 ? Math.floor(latest.cash / latest.burn) : null;
          initialValues[metricSection.id] = [
            `ARR: ${fmtUSD(latest.arr, { compact: true })}${arrDelta}`,
            `MRR: ${fmtUSD(latest.mrr, { compact: true })}`,
            `Burn: ${fmtUSD(latest.burn, { compact: true })}/mo`,
            runwayMonths !== null ? `Runway: ${runwayMonths} months` : null,
            `Cash: ${fmtUSD(latest.cash, { compact: true })}`,
            `GM: ${latest.grossMargin}%`,
            `Headcount: ${latest.headcount}`,
          ]
            .filter(Boolean)
            .join(" · ");
        }
      }
    }
  }

  // Copy-forward: prefill every still-empty section from the most recent
  // report built on the same template, so the writer edits last period's
  // text instead of facing a blank page. Metric sections keep the fresh
  // numbers computed above.
  if (templateId) {
    const priorRows = await db
      .select()
      .from(reports)
      .where(and(eq(reports.organizationId, membership.organizationId), eq(reports.templateId, templateId)))
      .orderBy(desc(reports.createdAt))
      .limit(1);
    const prior = priorRows[0];
    if (prior) {
      try {
        const priorValues = JSON.parse(prior.values) as Record<string, string>;
        initialValues = { ...priorValues, ...initialValues };
      } catch {
        /* noop */
      }
    }
  }

  const [r] = await db
    .insert(reports)
    .values({
      organizationId: membership.organizationId,
      templateId,
      meetingId,
      authorId: user.id,
      title: parsed.title,
      status: "DRAFT",
      values: JSON.stringify(initialValues),
    })
    .returning();

  revalidatePath("/reports");
  redirect(`/reports/${r.id}`);
}

export async function saveReport(formData: FormData) {
  const { membership } = await requireMembership();
  const id = String(formData.get("id"));
  const valuesRaw = String(formData.get("valuesJson") ?? "{}");
  let valuesObj: Record<string, string> = {};
  try {
    valuesObj = JSON.parse(valuesRaw);
  } catch {
    throw new Error("Invalid values payload");
  }
  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db
    .update(reports)
    .set({ values: JSON.stringify(valuesObj) })
    .where(eq(reports.id, id));
  revalidatePath(`/reports/${id}`);
}

export async function updateReportStatus(formData: FormData) {
  const { membership } = await requireMembership();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!REPORT_STATUSES.includes(status as never)) throw new Error("Bad status");
  const rows = await db
    .select()
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.update(reports).set({ status }).where(eq(reports.id, id));
  revalidatePath(`/reports/${id}`);
}

function htmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Render a section's content as polished HTML.
// Detects bullet lists (lines starting with - or • or numbered) and emits real lists.
function renderSectionContent(value: string, kind: string): string {
  const escaped = htmlEscape(value).trim();
  if (!escaped) return '<p class="empty">—</p>';

  if (kind === "metric") {
    // Split on " · " or " | " or commas — render as a metric strip
    const parts = value.split(/[·|]|(?<=\)),(?=\s)/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return `<div class="metrics">${parts.map((p) => `<span class="metric">${htmlEscape(p)}</span>`).join("")}</div>`;
    }
    return `<p class="metric-line">${escaped}</p>`;
  }

  // Detect bullet/numbered lists
  const lines = escaped.split(/\r?\n/);
  const isBulleted = lines.every((l) => l.trim() === "" || /^\s*[-•*]\s+/.test(l) || /^\s*\d+[\.\)]\s+/.test(l));
  if (isBulleted && lines.some((l) => l.trim() !== "")) {
    const items = lines
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.replace(/^\s*[-•*]\s+/, "").replace(/^\s*\d+[\.\)]\s+/, ""));
    return `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
  }

  // Otherwise treat blank lines as paragraph breaks
  const paragraphs = escaped.split(/\n{2,}/).map((p) => p.replace(/\n/g, "<br>"));
  return paragraphs.map((p) => `<p>${p}</p>`).join("");
}

export async function publishToBoardPack(formData: FormData) {
  const { user, membership } = await requireMembership();
  const id = String(formData.get("id"));

  const rows = await db
    .select({ r: reports, tmpName: reportTemplates.name, tmpSections: reportTemplates.sections })
    .from(reports)
    .leftJoin(reportTemplates, eq(reports.templateId, reportTemplates.id))
    .where(and(eq(reports.id, id), eq(reports.organizationId, membership.organizationId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Not found");
  if (!row.r.meetingId) throw new Error("Report must be tied to a meeting before publishing to the board pack.");

  type Section = { id: string; title: string; kind: string };
  let sections: Section[] = [];
  try {
    sections = row.tmpSections ? (JSON.parse(row.tmpSections) as Section[]) : [];
  } catch {
    /* noop */
  }

  let values: Record<string, string> = {};
  try {
    values = JSON.parse(row.r.values) as Record<string, string>;
  } catch {
    /* noop */
  }

  const sectionsHtml = sections.length
    ? sections
        .map((s) => {
          const v = values[s.id] ?? "";
          return `<section><h2>${htmlEscape(s.title)}</h2>${renderSectionContent(v, s.kind)}</section>`;
        })
        .join("\n")
    : `<section>${renderSectionContent(values._body ?? "", "rich")}</section>`;

  // Look up org name for the header
  const orgRows = await db.select().from(organizations).where(eq(organizations.id, membership.organizationId)).limit(1);
  const orgName = orgRows[0]?.name ?? "";

  const publishedAt = new Date();
  const publishedStr = publishedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${htmlEscape(row.r.title)}</title>
<style>
  :root {
    --ink: #0f172a;
    --muted: #64748b;
    --rule: #e2e8f0;
    --soft: #f8fafc;
    --accent: #1e3a8a;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ui-serif, "Source Serif Pro", "Iowan Old Style", Georgia, serif;
    color: var(--ink);
    line-height: 1.65;
    background: white;
    -webkit-font-smoothing: antialiased;
  }
  .page {
    max-width: 760px;
    margin: 0 auto;
    padding: 56px 48px 80px;
  }
  .header {
    margin-bottom: 40px;
    padding-bottom: 24px;
    border-bottom: 2px solid var(--ink);
  }
  .org {
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 8px;
  }
  h1 {
    margin: 0;
    font-size: 36px;
    line-height: 1.15;
    letter-spacing: -0.015em;
    font-weight: 700;
  }
  .meta {
    margin-top: 12px;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 13px;
    color: var(--muted);
  }
  .meta strong { color: var(--ink); font-weight: 600; }
  section { margin: 36px 0; page-break-inside: avoid; }
  h2 {
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 14px 0;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--rule);
  }
  p { margin: 0 0 14px 0; font-size: 16px; }
  p.empty { color: var(--muted); font-style: italic; }
  ul {
    margin: 0 0 14px 0;
    padding-left: 22px;
  }
  li { margin: 6px 0; font-size: 16px; }
  li::marker { color: var(--accent); }
  .metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 8px 0 14px;
    font-family: ui-sans-serif, system-ui, sans-serif;
  }
  .metric {
    background: var(--soft);
    border: 1px solid var(--rule);
    border-left: 3px solid var(--accent);
    padding: 10px 14px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
  }
  .metric-line {
    font-family: ui-sans-serif, system-ui, sans-serif;
    background: var(--soft);
    border-left: 3px solid var(--accent);
    padding: 10px 14px;
    margin: 0 0 14px 0;
    font-weight: 600;
  }
  .footer {
    margin-top: 56px;
    padding-top: 16px;
    border-top: 1px solid var(--rule);
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 11px;
    color: var(--muted);
    text-align: center;
    letter-spacing: 0.5px;
  }
  @media print {
    body { background: white; }
    .page { padding: 24px; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    ${orgName ? `<div class="org">${htmlEscape(orgName)}</div>` : ""}
    <h1>${htmlEscape(row.r.title)}</h1>
    <div class="meta">
      ${row.tmpName ? `<strong>${htmlEscape(row.tmpName)}</strong> · ` : ""}Published ${publishedStr}
    </div>
  </div>
  ${sectionsHtml}
  <div class="footer">Quorum · Confidential</div>
</div>
</body>
</html>`;

  const keyHint = `${membership.organizationId}/${Date.now()}-report-${row.r.id}.html`;
  const stored = await getStorage().put({
    keyHint,
    data: Buffer.from(html, "utf8"),
    mimeType: "text/html",
  });

  // Create or replace the linked Document
  if (row.r.boardPackDocumentId) {
    const oldRows = await db.select().from(documents).where(eq(documents.id, row.r.boardPackDocumentId)).limit(1);
    if (oldRows[0]) {
      await getStorage().delete(oldRows[0].storagePath).catch(() => {});
    }
    await db.delete(documents).where(eq(documents.id, row.r.boardPackDocumentId));
  }

  const [doc] = await db
    .insert(documents)
    .values({
      organizationId: membership.organizationId,
      meetingId: row.r.meetingId,
      uploadedById: user.id,
      title: row.r.title,
      description: row.tmpName ? `Auto-published from report (${row.tmpName})` : "Auto-published from report",
      filename: `${row.r.title}.html`,
      mimeType: "text/html",
      sizeBytes: stored.size,
      storagePath: stored.url,
      visibility: "ALL_MEMBERS",
    })
    .returning();

  await db
    .update(reports)
    .set({ status: "PUBLISHED", boardPackDocumentId: doc.id })
    .where(eq(reports.id, id));

  revalidatePath(`/reports/${id}`);
  revalidatePath(`/meetings/${row.r.meetingId}`);
  redirect(`/documents/${doc.id}`);
}
