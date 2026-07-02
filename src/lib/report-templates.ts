// Provisions the built-in report templates as global rows if they don't
// exist yet. Called from the reports pages; idempotent and cheap.

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { reportTemplates } from "@/db/schema";
import { BUILTIN_TEMPLATES } from "@/lib/report-template-defs";

export { BUILTIN_TEMPLATES, MONTHLY_BOARD_REPORT, QUARTERLY_BOARD_REPORT } from "@/lib/report-template-defs";
export type { TemplateSection } from "@/lib/report-template-defs";

export async function ensureGlobalTemplates() {
  const existing = await db
    .select({ name: reportTemplates.name })
    .from(reportTemplates)
    .where(eq(reportTemplates.isGlobal, true));
  const have = new Set(existing.map((t) => t.name));
  const missing = BUILTIN_TEMPLATES.filter((t) => !have.has(t.name));
  if (missing.length === 0) return;
  await db.insert(reportTemplates).values(
    missing.map((t) => ({
      organizationId: null,
      name: t.name,
      description: t.description,
      sections: JSON.stringify(t.sections),
      isGlobal: true,
    }))
  );
}
