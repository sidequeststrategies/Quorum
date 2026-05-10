import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  actionItems,
  agendaItems,
  financialPlans,
  financialScenarios,
  financialSnapshots,
  meetings,
  memberships,
  organizations,
  reports,
  resolutions,
  users,
} from "@/db/schema";
import { fmtUSD } from "@/lib/finance";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtPeriod = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
const fmtDate = (d: Date) => `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

/**
 * Builds a stable, comprehensive context string about an organization.
 * Used as a cached system prompt block — keep it deterministic so the cache
 * hit rate is high across messages in a thread.
 */
export async function buildOrgContext(organizationId: string): Promise<string> {
  const orgRows = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  const org = orgRows[0];
  if (!org) return "Organization not found.";

  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

  const [memberRows, meetingRows, resolutionRows, actionRows, snapshotRows, planRows, reportRows] = await Promise.all([
    db
      .select({ name: users.name, email: users.email, role: memberships.role, title: memberships.title, organizationLabel: memberships.organizationLabel, votingRights: memberships.votingRights })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.organizationId, organizationId))
      .orderBy(asc(memberships.role)),
    db
      .select()
      .from(meetings)
      .where(and(eq(meetings.organizationId, organizationId), gte(meetings.scheduledAt, sixMonthsAgo)))
      .orderBy(desc(meetings.scheduledAt))
      .limit(10),
    db
      .select()
      .from(resolutions)
      .where(eq(resolutions.organizationId, organizationId))
      .orderBy(desc(resolutions.createdAt))
      .limit(20),
    db
      .select({ a: actionItems, assigneeName: users.name, assigneeEmail: users.email })
      .from(actionItems)
      .leftJoin(users, eq(actionItems.assigneeId, users.id))
      .where(and(eq(actionItems.organizationId, organizationId), inArray(actionItems.status, ["OPEN", "IN_PROGRESS"])))
      .orderBy(asc(actionItems.dueDate))
      .limit(20),
    db
      .select()
      .from(financialSnapshots)
      .where(eq(financialSnapshots.organizationId, organizationId))
      .orderBy(asc(financialSnapshots.period)),
    db.select().from(financialPlans).where(eq(financialPlans.organizationId, organizationId)),
    db.select().from(reports).where(and(eq(reports.organizationId, organizationId), eq(reports.status, "PUBLISHED"))).orderBy(desc(reports.updatedAt)).limit(5),
  ]);

  const lines: string[] = [];
  lines.push(`# Company: ${org.name}`);
  if (org.legalName) lines.push(`Legal name: ${org.legalName}`);
  if (org.jurisdiction) lines.push(`Jurisdiction: ${org.jurisdiction}`);
  lines.push("");

  // Members
  lines.push("## Board & team");
  for (const m of memberRows) {
    const labels = [m.role, m.title, m.organizationLabel].filter(Boolean).join(" · ");
    lines.push(`- ${m.name ?? m.email} — ${labels}${m.votingRights ? "" : " (non-voting)"}`);
  }
  lines.push("");

  // Meetings
  if (meetingRows.length) {
    lines.push("## Recent + upcoming meetings (last 6 months / next)");
    for (const m of meetingRows) {
      const tense = m.scheduledAt > now ? "upcoming" : "past";
      lines.push(`### ${m.title} — ${fmtDate(m.scheduledAt)} (${tense}, ${m.status})`);
      if (m.location) lines.push(`Location: ${m.location}`);
      // Pull agenda
      const agenda = await db.select().from(agendaItems).where(eq(agendaItems.meetingId, m.id)).orderBy(asc(agendaItems.order));
      if (agenda.length) {
        lines.push("Agenda:");
        for (const a of agenda) lines.push(`  ${a.order}. ${a.title} (${a.durationMin} min)`);
      }
      if (m.notes) lines.push(`Pre-meeting notes: ${m.notes}`);
      if (m.minutes) lines.push(`Minutes: ${m.minutes}`);
      lines.push("");
    }
  }

  // Resolutions
  if (resolutionRows.length) {
    lines.push("## Resolutions");
    for (const r of resolutionRows) {
      lines.push(`- [${r.status}] ${r.title} (${r.kind === "WRITTEN_CONSENT" ? "written consent" : "meeting vote"})`);
      lines.push(`  ${r.body.slice(0, 400)}${r.body.length > 400 ? "…" : ""}`);
    }
    lines.push("");
  }

  // Action items
  if (actionRows.length) {
    lines.push("## Open action items");
    for (const { a, assigneeName, assigneeEmail } of actionRows) {
      const due = a.dueDate ? ` (due ${fmtDate(a.dueDate)})` : "";
      lines.push(`- [${a.status}] ${a.title} — ${assigneeName ?? assigneeEmail ?? "unassigned"}${due}`);
      if (a.description) lines.push(`  ${a.description}`);
    }
    lines.push("");
  }

  // Financial snapshots — most recent 6
  if (snapshotRows.length) {
    lines.push("## Monthly financial snapshots (most recent first)");
    const recent = snapshotRows.slice(-6).reverse();
    for (const s of recent) {
      lines.push(
        `- ${fmtPeriod(s.period)}: cash ${fmtUSD(s.cash, { compact: true })}, ARR ${fmtUSD(s.arr, { compact: true })}, MRR ${fmtUSD(s.mrr, { compact: true })}, GM ${s.grossMargin}%, burn ${fmtUSD(s.burn, { compact: true })}/mo, headcount ${s.headcount}, AR ${fmtUSD(s.accountsReceivable, { compact: true })}, AP ${fmtUSD(s.accountsPayable, { compact: true })}`
      );
      if (s.notes) lines.push(`  Notes: ${s.notes}`);
    }
    lines.push("");
  }

  // Financial plans + scenarios
  if (planRows.length) {
    lines.push("## Forward-looking financial plans");
    for (const p of planRows) {
      lines.push(`### ${p.name}`);
      lines.push(`Horizon: ${p.horizonMonths} months from ${fmtPeriod(p.startMonth)} · Starting cash: ${fmtUSD(p.startingCash, { compact: true })}`);
      if (p.description) lines.push(p.description);
      const scenarios = await db.select().from(financialScenarios).where(eq(financialScenarios.planId, p.id));
      for (const s of scenarios) {
        lines.push(`- Scenario "${s.name}" (${s.kind})`);
        if (s.notes) lines.push(`  ${s.notes}`);
      }
      lines.push("");
    }
  }

  // Published reports
  if (reportRows.length) {
    lines.push("## Recently published reports");
    for (const r of reportRows) {
      lines.push(`### ${r.title}`);
      try {
        const values = JSON.parse(r.values) as Record<string, string>;
        for (const [k, v] of Object.entries(values)) {
          if (v) lines.push(`${k}: ${String(v).slice(0, 500)}`);
        }
      } catch {
        /* noop */
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
