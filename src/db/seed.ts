import { drizzle } from "drizzle-orm/sqlite-proxy";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import bcrypt from "bcryptjs";
import * as schema from "./schema";
import { eq } from "drizzle-orm";

const url = (process.env.DATABASE_URL ?? "file:./data/quorum.db").replace(/^file:/, "");
const sqlite = new DatabaseSync(url);
sqlite.exec("PRAGMA foreign_keys = ON;");

// Same SQL-rewrite trick as src/lib/db.ts so seed-time joins behave correctly.
function aliasOuterSelect(sql: string): string {
  const head = sql.match(/^\s*select\s+(distinct\s+)?/i);
  if (!head) return sql;
  const headLen = head[0].length;
  const rest = sql.slice(headLen);
  const fromIdx = findTopLevelFrom(rest);
  if (fromIdx === -1) return sql;
  const items = splitTopLevel(rest.slice(0, fromIdx), ",");
  let aliased = false;
  const newItems = items.map((raw, i) => {
    const item = raw.trim();
    if (/\bas\b/i.test(item)) return raw;
    if (item === "*" || item.endsWith(".*")) return raw;
    aliased = true;
    return `${raw} as "c_${i}"`;
  });
  if (!aliased) return sql;
  return sql.slice(0, headLen) + newItems.join(",") + rest.slice(fromIdx);
}
function findTopLevelFrom(s: string): number {
  let depth = 0, sg = false, db_ = false, bt = false, br = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (sg) { if (ch === "'" && s[i-1] !== "\\") sg = false; continue; }
    if (db_) { if (ch === '"' && s[i-1] !== "\\") db_ = false; continue; }
    if (bt) { if (ch === "`") bt = false; continue; }
    if (br) { if (ch === "]") br = false; continue; }
    if (ch === "'") { sg = true; continue; }
    if (ch === '"') { db_ = true; continue; }
    if (ch === "`") { bt = true; continue; }
    if (ch === "[") { br = true; continue; }
    if (ch === "(") { depth++; continue; }
    if (ch === ")") { depth--; continue; }
    if (depth === 0 && (ch === "f" || ch === "F") && /^from\b/i.test(s.slice(i)) && /\s/.test(s[i-1] ?? " ")) return i;
  }
  return -1;
}
function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, sg = false, db_ = false, bt = false, br = false, start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (sg) { if (ch === "'" && s[i-1] !== "\\") sg = false; continue; }
    if (db_) { if (ch === '"' && s[i-1] !== "\\") db_ = false; continue; }
    if (bt) { if (ch === "`") bt = false; continue; }
    if (br) { if (ch === "]") br = false; continue; }
    if (ch === "'") { sg = true; continue; }
    if (ch === '"') { db_ = true; continue; }
    if (ch === "`") { bt = true; continue; }
    if (ch === "[") { br = true; continue; }
    if (ch === "(") { depth++; continue; }
    if (ch === ")") { depth--; continue; }
    if (depth === 0 && ch === sep) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out;
}
function rowToValues(stmt: StatementSync, row: Record<string, unknown>): unknown[] {
  const cols = stmt.columns?.();
  if (cols && cols.length === Object.keys(row).length) return cols.map((c) => row[c.name]);
  return Object.values(row);
}

const db = drizzle(
  async (sql, params, method) => {
    const rewritten = aliasOuterSelect(sql);
    const stmt = sqlite.prepare(rewritten);
    if (method === "run") { stmt.run(...(params as never[])); return { rows: [] }; }
    if (method === "get") {
      const r = stmt.get(...(params as never[]));
      if (!r) return { rows: [] };
      return { rows: rowToValues(stmt, r as Record<string, unknown>) };
    }
    const rs = stmt.all(...(params as never[])) as Array<Record<string, unknown>>;
    return { rows: rs.map((r) => rowToValues(stmt, r)) };
  },
  async (queries) => {
    sqlite.exec("BEGIN");
    try {
      const results = queries.map(({ sql, params, method }) => {
        const rewritten = aliasOuterSelect(sql);
        const stmt = sqlite.prepare(rewritten);
        if (method === "run") { stmt.run(...(params as never[])); return { rows: [] }; }
        if (method === "get") {
          const r = stmt.get(...(params as never[]));
          if (!r) return { rows: [] };
          return { rows: rowToValues(stmt, r as Record<string, unknown>) };
        }
        const rs = stmt.all(...(params as never[])) as Array<Record<string, unknown>>;
        return { rows: rs.map((r) => rowToValues(stmt, r)) };
      });
      sqlite.exec("COMMIT");
      return results;
    } catch (e) { sqlite.exec("ROLLBACK"); throw e; }
  },
  { schema }
);

const {
  users, organizations, memberships, meetings, agendaItems, attendances,
  resolutions, votes, actionItems, reportTemplates, reports, financialPlans,
  financialScenarios, coachingPrograms, coachingLessons, coachingClients,
  lessonAssignments, coachingSessions, retreatActivities, retreats,
  retreatAgendaItems, retreatTemplates, financialSnapshots,
  risks, riskReviews, projects, projectMilestones, projectUpdates,
  teamUpdates, customers, customerUpdates, gtmUpdates,
} = schema;

import { LEADERSHIP_DAY_AGENDA, LEADERSHIP_DAY_INTAKE, LEADERSHIP_DAY_PHILOSOPHY } from "./seed-content";

function genToken(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
}

async function main() {
  // Guard: refuse to run against production unless explicitly authorized.
  // The seed wipes existing demo data and recreates it — destructive on a
  // live DB. Set ALLOW_PROD_SEED=1 to override (only meaningful for the
  // first prod seeding, never on a populated production DB).
  const url = process.env.DATABASE_URL ?? "";
  const looksLikeProd =
    process.env.NODE_ENV === "production" ||
    url.startsWith("libsql://") ||
    url.startsWith("https://") ||
    /turso|vercel|prod/i.test(url);
  if (looksLikeProd && process.env.ALLOW_PROD_SEED !== "1") {
    console.error(
      "Refusing to run demo seed against what looks like a production database.\n" +
      `  DATABASE_URL: ${url || "(unset)"}\n` +
      "  Set ALLOW_PROD_SEED=1 to override (this WILL wipe all demo-pattern data)."
    );
    process.exit(2);
  }

  console.log("Seeding…");
  const passwordHash = await bcrypt.hash("password123", 10);

  // ── Wipe demo data (idempotent re-seeds) ─────────────────────────────
  sqlite.exec(`
    DELETE FROM RiskReview;
    DELETE FROM Risk;
    DELETE FROM ProjectUpdate;
    DELETE FROM ProjectMilestone;
    DELETE FROM Project;
    DELETE FROM TeamUpdate;
    DELETE FROM CustomerUpdate;
    DELETE FROM Customer;
    DELETE FROM GtmUpdate;
    DELETE FROM FinancialSnapshot;
    DELETE FROM RetreatIntakeResponse;
    DELETE FROM RetreatTemplate;
    DELETE FROM RetreatTakeaway;
    DELETE FROM RetreatAgendaItem;
    DELETE FROM Retreat;
    DELETE FROM RetreatActivity;
    DELETE FROM CoachingSession;
    DELETE FROM LessonAssignment;
    DELETE FROM CoachingClient;
    DELETE FROM CoachingLesson;
    DELETE FROM CoachingProgram;
    DELETE FROM FinancialScenario;
    DELETE FROM FinancialPlan;
    DELETE FROM Report;
    DELETE FROM ReportTemplate;
    DELETE FROM Vote;
    DELETE FROM Attendance;
    DELETE FROM AgendaItem;
    DELETE FROM ActionItem;
    DELETE FROM Document;
    DELETE FROM Resolution;
    DELETE FROM Meeting;
    DELETE FROM Membership;
    DELETE FROM "User" WHERE email LIKE '%.demo';
    DELETE FROM Organization WHERE slug IN ('acme-robotics', 'northstar-grid', 'harbor-logics');
  `);

  // ── Users ─────────────────────────────────────────────────────────────
  // The advisor (your primary login) — has memberships across all 3 orgs
  const [danny] = await db
    .insert(users)
    .values({ email: "danny@sidequest.demo", name: "Danny Ellis", passwordHash })
    .returning();

  // Per-org founders + small boards. Each org has its own people.
  // ── Acme Robotics
  const [rileyAcme] = await db.insert(users).values({ email: "riley@acme.demo", name: "Riley Chen", passwordHash }).returning();
  const acmePeople = await db.insert(users).values([
    { email: "sam@acme.demo", name: "Sam Patel", passwordHash },
    { email: "morgan@acme.demo", name: "Morgan Reyes", passwordHash },
    { email: "avery@acme.demo", name: "Avery Walsh", passwordHash },
    { email: "drew@acme.demo", name: "Drew Park", passwordHash },
  ]).returning();
  const [samAcme, morganAcme, averyAcme, drewAcme] = acmePeople;

  // ── Northstar Grid
  const [mayaNorthstar] = await db.insert(users).values({ email: "maya@northstar.demo", name: "Maya Okonkwo", passwordHash }).returning();
  const northstarPeople = await db.insert(users).values([
    { email: "owen@northstar.demo", name: "Owen Tran", passwordHash },
    { email: "priya@northstar.demo", name: "Priya Iyer", passwordHash },
  ]).returning();
  const [owenNorthstar, priyaNorthstar] = northstarPeople;

  // ── Harbor Logics
  const [liamHarbor] = await db.insert(users).values({ email: "liam@harbor.demo", name: "Liam Ó Briain", passwordHash }).returning();
  const harborPeople = await db.insert(users).values([
    { email: "fei@harbor.demo", name: "Fei Wang", passwordHash },
    { email: "noor@harbor.demo", name: "Noor Hassan", passwordHash },
    { email: "rita@harbor.demo", name: "Rita Schmidt", passwordHash },
  ]).returning();
  const [feiHarbor, noorHarbor, ritaHarbor] = harborPeople;

  // ── Organizations ────────────────────────────────────────────────────
  const [acme] = await db.insert(organizations).values({
    name: "Acme Robotics", slug: "acme-robotics",
    legalName: "Acme Robotics, Inc.", jurisdiction: "Delaware, USA",
  }).returning();
  const [northstar] = await db.insert(organizations).values({
    name: "Northstar Grid", slug: "northstar-grid",
    legalName: "Northstar Grid, Inc.", jurisdiction: "Delaware, USA",
  }).returning();
  const [harbor] = await db.insert(organizations).values({
    name: "Harbor Logics", slug: "harbor-logics",
    legalName: "Harbor Logics, Inc.", jurisdiction: "Delaware, USA",
  }).returning();

  // ── Memberships ──────────────────────────────────────────────────────
  // Acme: Riley owns, full board including Danny as Independent Director
  await db.insert(memberships).values([
    { userId: rileyAcme.id, organizationId: acme.id, role: "OWNER", title: "Founder & CEO", votingRights: true },
    { userId: samAcme.id, organizationId: acme.id, role: "DIRECTOR", title: "Co-founder & CTO", votingRights: true },
    { userId: morganAcme.id, organizationId: acme.id, role: "DIRECTOR", title: "Series A Director", organizationLabel: "Lighthouse Capital", votingRights: true },
    { userId: averyAcme.id, organizationId: acme.id, role: "OBSERVER", title: "Board Observer", organizationLabel: "Lighthouse Capital", votingRights: false },
    { userId: drewAcme.id, organizationId: acme.id, role: "ADMIN", title: "Corporate Secretary", votingRights: false },
    { userId: danny.id, organizationId: acme.id, role: "DIRECTOR", title: "Independent Director", organizationLabel: "Side Quest Strategies", votingRights: true },
  ]);

  // Northstar: Maya owns, Danny is Independent Chair
  await db.insert(memberships).values([
    { userId: mayaNorthstar.id, organizationId: northstar.id, role: "OWNER", title: "Founder & CEO", votingRights: true },
    { userId: owenNorthstar.id, organizationId: northstar.id, role: "DIRECTOR", title: "Co-founder & CTO", votingRights: true },
    { userId: priyaNorthstar.id, organizationId: northstar.id, role: "DIRECTOR", title: "Seed Director", organizationLabel: "Northstar Ventures", votingRights: true },
    { userId: danny.id, organizationId: northstar.id, role: "DIRECTOR", title: "Independent Board Chair", organizationLabel: "Side Quest Strategies", votingRights: true },
  ]);

  // Harbor: Liam owns, Danny is Independent Director (advisory)
  await db.insert(memberships).values([
    { userId: liamHarbor.id, organizationId: harbor.id, role: "OWNER", title: "Founder & CEO", votingRights: true },
    { userId: feiHarbor.id, organizationId: harbor.id, role: "DIRECTOR", title: "Co-founder & COO", votingRights: true },
    { userId: noorHarbor.id, organizationId: harbor.id, role: "DIRECTOR", title: "Series A Director", organizationLabel: "Quayside Partners", votingRights: true },
    { userId: ritaHarbor.id, organizationId: harbor.id, role: "ADMIN", title: "VP of Finance", votingRights: false },
    { userId: danny.id, organizationId: harbor.id, role: "DIRECTOR", title: "Independent Director", organizationLabel: "Side Quest Strategies", votingRights: true },
  ]);

  // ── Acme: rich data (rep mtg, upcoming mtg, resolutions, action items, financial plan, retreat) ──
  const acmePastDate = new Date(); acmePastDate.setDate(acmePastDate.getDate() - 30); acmePastDate.setHours(10, 0, 0, 0);
  const acmeUpcomingDate = new Date(); acmeUpcomingDate.setDate(acmeUpcomingDate.getDate() + 21); acmeUpcomingDate.setHours(10, 0, 0, 0);

  const [acmePast] = await db.insert(meetings).values({
    organizationId: acme.id, title: "Acme Q1 2026 Board Meeting", type: "REGULAR", status: "COMPLETED",
    scheduledAt: acmePastDate, durationMin: 90,
    location: "Acme HQ — Conference Room A",
    minutes: "The Board reviewed Q1 results, approved the updated 2026 operating budget, and authorized the Series A bridge facility. CEO Riley Chen presented the product roadmap; CTO Sam Patel walked through hiring plans. Independent Director Danny Ellis raised governance questions which were addressed by the Corporate Secretary.",
    quorumRequired: 0,
  }).returning();
  const [acmeUpcoming] = await db.insert(meetings).values({
    organizationId: acme.id, title: "Acme Q2 2026 Board Meeting", type: "REGULAR", status: "SCHEDULED",
    scheduledAt: acmeUpcomingDate, durationMin: 90,
    location: "Acme HQ — Conference Room A",
    notes: "Please review Q2 financials and the Series B prep memo before the meeting.",
    quorumRequired: 3,
  }).returning();

  await db.insert(agendaItems).values([
    { meetingId: acmeUpcoming.id, order: 1, title: "Approve Q1 minutes", durationMin: 5, presenterId: drewAcme.id },
    { meetingId: acmeUpcoming.id, order: 2, title: "CEO update", description: "KPIs, hiring, runway", durationMin: 20, presenterId: rileyAcme.id },
    { meetingId: acmeUpcoming.id, order: 3, title: "Product & engineering review", durationMin: 25, presenterId: samAcme.id },
    { meetingId: acmeUpcoming.id, order: 4, title: "Q2 financials", durationMin: 15, presenterId: rileyAcme.id },
    { meetingId: acmeUpcoming.id, order: 5, title: "Series B fundraising plan", durationMin: 20, presenterId: rileyAcme.id },
    { meetingId: acmeUpcoming.id, order: 6, title: "Executive session (directors only)", durationMin: 15 },
  ]);
  await db.insert(agendaItems).values([
    { meetingId: acmePast.id, order: 1, title: "CEO update", durationMin: 20, presenterId: rileyAcme.id },
    { meetingId: acmePast.id, order: 2, title: "Q1 financials", durationMin: 15, presenterId: rileyAcme.id },
    { meetingId: acmePast.id, order: 3, title: "Approve 2026 operating budget", durationMin: 20, presenterId: rileyAcme.id },
    { meetingId: acmePast.id, order: 4, title: "Authorize Series A bridge facility", durationMin: 25, presenterId: morganAcme.id },
  ]);

  const acmeAttendees = [rileyAcme, samAcme, morganAcme, averyAcme, drewAcme, danny];
  await db.insert(attendances).values(
    acmeAttendees.map((u) => ({ meetingId: acmePast.id, userId: u.id, status: "ATTENDED", respondedAt: acmePastDate }))
  );
  await db.insert(attendances).values(
    acmeAttendees.map((u) => ({ meetingId: acmeUpcoming.id, userId: u.id, status: u.id === averyAcme.id ? "TENTATIVE" : "ACCEPTED", respondedAt: new Date() }))
  );

  const [acmeBudgetRes] = await db.insert(resolutions).values({
    organizationId: acme.id, meetingId: acmePast.id,
    title: "Approval of 2026 operating budget",
    body: "RESOLVED, that the Board hereby approves the 2026 operating budget as presented at this meeting, with total operating expenses not to exceed $14.2M, and the CEO is authorized to make line-item adjustments of up to 10% per category without further Board approval.",
    kind: "MEETING_VOTE", status: "PASSED", openedAt: acmePastDate, closedAt: acmePastDate,
  }).returning();
  await db.insert(votes).values(
    [rileyAcme, samAcme, morganAcme, danny].map((u) => ({ resolutionId: acmeBudgetRes.id, userId: u.id, choice: "FOR" as const }))
  );
  const [acmeOptionRes] = await db.insert(resolutions).values({
    organizationId: acme.id,
    title: "Approval of stock option grants — May 2026",
    body: "RESOLVED, that the Board hereby approves the grant of stock options under the Company's 2024 Equity Incentive Plan to the individuals and in the amounts set forth in the schedule attached as Exhibit A.",
    kind: "WRITTEN_CONSENT", status: "OPEN", requiresUnanimous: true, openedAt: new Date(),
  }).returning();
  await db.insert(votes).values([
    { resolutionId: acmeOptionRes.id, userId: rileyAcme.id, choice: "FOR" },
    { resolutionId: acmeOptionRes.id, userId: samAcme.id, choice: "FOR" },
  ]);
  await db.insert(resolutions).values({
    organizationId: acme.id, meetingId: acmeUpcoming.id,
    title: "Authorize Series B preparation work",
    body: "RESOLVED, that the Board hereby authorizes management to engage Latham & Watkins LLP as legal counsel and Goldman Sachs & Co. as financial advisor in connection with a proposed Series B preferred stock financing.",
    kind: "MEETING_VOTE", status: "DRAFT",
  });

  await db.insert(actionItems).values([
    { organizationId: acme.id, meetingId: acmePast.id, assigneeId: rileyAcme.id, title: "Send updated cap table to all directors", description: "Reflect the latest options grants and any secondary transactions.", dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), status: "IN_PROGRESS" },
    { organizationId: acme.id, meetingId: acmePast.id, assigneeId: samAcme.id, title: "Prepare technical due diligence memo for Series B", dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), status: "OPEN" },
    { organizationId: acme.id, meetingId: acmePast.id, assigneeId: drewAcme.id, title: "Draft revised Audit Committee charter", dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), status: "OPEN" },
    { organizationId: acme.id, meetingId: acmePast.id, assigneeId: rileyAcme.id, title: "Distribute Q1 minutes to directors for approval", status: "DONE" },
  ]);

  // Acme financial plan
  const acmeStartMonth = new Date(); acmeStartMonth.setDate(1); acmeStartMonth.setHours(0, 0, 0, 0);
  const [acmePlan] = await db.insert(financialPlans).values({
    organizationId: acme.id, name: "FY2026 Operating Plan",
    description: "Three-scenario model for the Q2 board meeting strategy discussion.",
    horizonMonths: 24, startingCash: 12000000, startMonth: acmeStartMonth,
  }).returning();
  await db.insert(financialScenarios).values([
    { planId: acmePlan.id, name: "Base case", kind: "BASE", assumptions: JSON.stringify({ startingMRR: 333000, monthlyGrowthPct: 7, churnPct: 2, grossMarginPct: 72, monthlyOpexBase: 240000, opexGrowthPct: 1.5, headcountStart: 38, monthlyHires: 1.5, avgFullyLoadedSalary: 195000 }), notes: "Plan-of-record. 7% MoM growth, 38→74 headcount over horizon." },
    { planId: acmePlan.id, name: "Upside", kind: "UPSIDE", assumptions: JSON.stringify({ startingMRR: 333000, monthlyGrowthPct: 11, churnPct: 1.5, grossMarginPct: 75, monthlyOpexBase: 240000, opexGrowthPct: 1.2, headcountStart: 38, monthlyHires: 2.5, avgFullyLoadedSalary: 195000 }), notes: "Enterprise motion lands. Justifies accelerated GTM hiring." },
    { planId: acmePlan.id, name: "Downside", kind: "DOWNSIDE", assumptions: JSON.stringify({ startingMRR: 333000, monthlyGrowthPct: 4, churnPct: 3, grossMarginPct: 70, monthlyOpexBase: 240000, opexGrowthPct: 1, headcountStart: 38, monthlyHires: 0.3, avgFullyLoadedSalary: 195000 }), notes: "Macro slowdown + one large logo churns. Hiring freeze; runway extension to 28 months." },
  ]);

  // ── Acme: board-reporting demo data (snapshots, risks, projects, team, customers, GTM) ──

  // 12 months of financial snapshots ending in the current month.
  const monthsBack = (n: number) => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - n, 1);
  };
  let mrr = 210000;
  let cash = 17400000;
  let headcount = 28;
  const snapshotValues = [];
  for (let i = 11; i >= 0; i--) {
    const growth = 1 + 0.055 + (((11 - i) % 3) * 0.012); // 5.5–7.9% MoM, varied
    if (i < 11) mrr = Math.round(mrr * growth);
    const revenue = mrr;
    const grossMargin = 70 + Math.min(3, Math.floor((11 - i) / 4));
    const burn = Math.round(430000 + (11 - i) * 9000 - revenue * 0.18);
    cash -= burn;
    if (i < 11 && (11 - i) % 2 === 0) headcount += 1;
    snapshotValues.push({
      organizationId: acme.id,
      period: monthsBack(i),
      cash: Math.round(cash),
      mrr,
      arr: mrr * 12,
      revenue,
      grossMargin,
      burn,
      headcount,
      accountsReceivable: Math.round(revenue * 1.4),
      accountsPayable: Math.round(revenue * 0.5),
      createdById: rileyAcme.id,
      notes: i === 0 ? "Closed Acme Logistics ($420k ACV) mid-month; cash includes their first annual prepay." : null,
    });
  }
  await db.insert(financialSnapshots).values(snapshotValues);

  // Risk register — persistent, carries over each meeting.
  const [riskSupply, riskChurn, riskKeyPerson, riskCompliance] = await db.insert(risks).values([
    { organizationId: acme.id, title: "Single-source supplier for drive actuators", description: "80% of actuator supply comes from one vendor. A disruption stops production within 6 weeks.", category: "OPERATIONAL", likelihood: 3, impact: 5, status: "MITIGATING", ownerId: samAcme.id, mitigation: "Qualifying a second supplier (target: Q3). Building 10-week buffer stock in the interim." },
    { organizationId: acme.id, title: "Mid-market churn concentration", description: "Two churns last quarter were both mid-market logistics accounts citing price. NRR dipped to 108%.", category: "MARKET", likelihood: 3, impact: 4, status: "OPEN", ownerId: rileyAcme.id, mitigation: "CS root-cause review this month; pricing/packaging review with the new VP Sales." },
    { organizationId: acme.id, title: "Key-person risk: CTO", description: "Sam holds critical context on the perception stack with no clear second.", category: "PEOPLE", likelihood: 2, impact: 5, status: "MITIGATING", ownerId: rileyAcme.id, mitigation: "Promoting a staff engineer to architecture lead; documentation sprint scheduled." },
    { organizationId: acme.id, title: "SOC 2 Type II timeline", description: "Two enterprise prospects require SOC 2 Type II before contract. Audit window slips push deals to next FY.", category: "LEGAL", likelihood: 2, impact: 3, status: "OPEN", ownerId: drewAcme.id, mitigation: "Audit firm engaged; evidence collection 60% complete." },
  ]).returning();
  await db.insert(risks).values({
    organizationId: acme.id, title: "AWS cost overrun", description: "Infra bill grew 22% MoM in Q1.", category: "FINANCIAL", likelihood: 2, impact: 2, status: "CLOSED", ownerId: samAcme.id, mitigation: "FinOps initiative landed reserved-instance plan; bill down 17%.", closedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
  });
  await db.insert(riskReviews).values([
    { riskId: riskSupply.id, meetingId: acmePast.id, likelihood: 4, impact: 5, status: "OPEN", note: "Board asked for a second-source plan by next meeting.", reviewedById: danny.id, createdAt: acmePastDate },
    { riskId: riskSupply.id, likelihood: 3, impact: 5, status: "MITIGATING", note: "Second supplier in qualification; buffer stock at 6 of 10 weeks.", reviewedById: rileyAcme.id },
    { riskId: riskChurn.id, meetingId: acmePast.id, likelihood: 3, impact: 4, status: "OPEN", note: "New risk raised at Q1 meeting after two churns.", reviewedById: danny.id, createdAt: acmePastDate },
    { riskId: riskKeyPerson.id, meetingId: acmePast.id, likelihood: 3, impact: 5, status: "OPEN", note: "Flagged by independent director.", reviewedById: danny.id, createdAt: acmePastDate },
  ]);
  void riskCompliance;

  // Key projects / initiatives with milestones and monthly write-ups.
  const thisPeriod = monthsBack(0);
  const lastPeriod = monthsBack(1);
  const [projFleet, projEnterprise, projSeriesB] = await db.insert(projects).values([
    { organizationId: acme.id, name: "Predictive maintenance MVP", summary: "Ship the predictive-maintenance product to 5 design partners; the wedge for enterprise expansion.", status: "ON_TRACK", ownerId: samAcme.id, startDate: monthsBack(4), targetDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000) },
    { organizationId: acme.id, name: "Enterprise readiness (SSO + SOC 2)", summary: "Unblock the enterprise segment: SSO, RBAC, audit logging, SOC 2 Type II.", status: "AT_RISK", ownerId: drewAcme.id, startDate: monthsBack(5), targetDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000) },
    { organizationId: acme.id, name: "Series B fundraise", summary: "Raise $30–40M Series B in early Q4 to fund the enterprise motion.", status: "ON_TRACK", ownerId: rileyAcme.id, startDate: monthsBack(2), targetDate: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000) },
  ]).returning();
  await db.insert(projectMilestones).values([
    { projectId: projFleet.id, order: 0, title: "Data pipeline for sensor telemetry", status: "DONE", completedAt: monthsBack(2) },
    { projectId: projFleet.id, order: 1, title: "Model v0 — failure prediction on 2 component classes", status: "DONE", completedAt: monthsBack(1) },
    { projectId: projFleet.id, order: 2, title: "5 design partners live", status: "IN_PROGRESS", dueDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000) },
    { projectId: projFleet.id, order: 3, title: "GA pricing & packaging", status: "PLANNED", dueDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000) },
    { projectId: projEnterprise.id, order: 0, title: "Enterprise SSO (SAML/OIDC)", status: "DONE", completedAt: monthsBack(1) },
    { projectId: projEnterprise.id, order: 1, title: "Role-based access control", status: "IN_PROGRESS", dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    { projectId: projEnterprise.id, order: 2, title: "SOC 2 Type II audit complete", status: "SLIPPED", dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
    { projectId: projSeriesB.id, order: 0, title: "Narrative + data room v1", status: "IN_PROGRESS", dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    { projectId: projSeriesB.id, order: 1, title: "Target list finalized (20 firms)", status: "PLANNED", dueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) },
  ]);
  await db.insert(projectUpdates).values([
    { projectId: projFleet.id, period: lastPeriod, headline: "Model v0 beat baseline on both component classes", body: "Precision/recall now good enough for a design-partner pilot. Two partners signed LOIs; three more in legal.", status: "ON_TRACK", authorId: samAcme.id },
    { projectId: projFleet.id, period: thisPeriod, headline: "3 of 5 design partners live and streaming data", body: "First real-world save: predicted actuator failure at Acme Logistics 9 days early. Case study in draft.\n\nAsk: intro to any fleet operator willing to be partner #6 (waitlist).", status: "ON_TRACK", authorId: samAcme.id },
    { projectId: projEnterprise.id, period: thisPeriod, headline: "SSO shipped; SOC 2 audit window slipped 3 weeks", body: "SSO is live for two enterprise pilots. The SOC 2 Type II observation window slipped due to evidence-collection gaps in HR tooling — new completion estimate is end of next quarter. This is the main enterprise-deal blocker.", status: "AT_RISK", authorId: drewAcme.id },
    { projectId: projSeriesB.id, period: thisPeriod, headline: "Narrative v1 drafted; data room 70% assembled", body: "Story: vertical robotics platform with a predictive-maintenance wedge. Practice pitch with the board scheduled for the next meeting.", status: "ON_TRACK", authorId: rileyAcme.id },
  ]);

  // Team updates (last two months).
  await db.insert(teamUpdates).values([
    { organizationId: acme.id, period: lastPeriod, headline: "VP Sales signed; eng hiring on plan", body: "Priya Mehta (ex-CloudOps) signed as VP Sales, starting next month. Engineering made two senior offers, one accepted.", hires: "1× Sr Backend Eng (accepted)", departures: "None", openRoles: "Sr Backend Eng ×1, CS Lead, FP&A Manager", headcount: 37, authorId: rileyAcme.id },
    { organizationId: acme.id, period: thisPeriod, headline: "Priya (VP Sales) started; zero regretted attrition for 6 months", body: "Priya started Monday and is already rebuilding pipeline hygiene. Team morale strong post-offsite announcement. Watch item: perception team is stretched until the architecture-lead promotion lands.", hires: "Priya Mehta — VP Sales", departures: "None", openRoles: "CS Lead, FP&A Manager, Staff Perception Eng", headcount: 38, authorId: rileyAcme.id },
  ]);

  // Key customers + monthly health checks.
  const [custLogistics, custNational, custMetro, custPacific] = await db.insert(customers).values([
    { organizationId: acme.id, name: "Acme Logistics Group", segment: "Enterprise fleet", region: "North America", arr: 420000, status: "ACTIVE", ownerId: rileyAcme.id, notes: "Largest customer; predictive-maintenance design partner." },
    { organizationId: acme.id, name: "National Parcel Co.", segment: "Mid-market fleet", region: "North America", arr: 180000, status: "AT_RISK", ownerId: rileyAcme.id, notes: "Renewal in 4 months; new procurement lead pushing on price." },
    { organizationId: acme.id, name: "Metro Transit Authority", segment: "Public transit", region: "North America", arr: 240000, status: "ACTIVE", ownerId: samAcme.id, notes: "Expansion candidate — depot #2 pilot under discussion." },
    { organizationId: acme.id, name: "Pacific Cold Chain", segment: "Mid-market fleet", region: "APAC", arr: 95000, status: "PILOT", ownerId: rileyAcme.id, notes: "90-day paid pilot; converts to $190k ACV if SLA met." },
  ]).returning();
  await db.insert(customerUpdates).values([
    { customerId: custLogistics.id, period: thisPeriod, health: "GREEN", note: "Design-partner save (9-day early failure prediction) landed exec sponsorship. Case study approved.", authorId: rileyAcme.id },
    { customerId: custNational.id, period: thisPeriod, health: "AMBER", note: "New procurement lead benchmarking us against the incumbent. Exec dinner set for the 14th; renewal plan in motion.", authorId: rileyAcme.id },
    { customerId: custMetro.id, period: thisPeriod, health: "GREEN", note: "Depot #2 pilot scoped; legal review started.", authorId: samAcme.id },
    { customerId: custPacific.id, period: thisPeriod, health: "AMBER", note: "Pilot SLA at 97.2% vs 98% target — remediation plan agreed, two weeks to cure.", authorId: rileyAcme.id },
    { customerId: custLogistics.id, period: lastPeriod, health: "GREEN", note: "Onboarding complete across all 3 depots.", authorId: rileyAcme.id },
    { customerId: custNational.id, period: lastPeriod, health: "GREEN", note: "Usage steady; no signals.", authorId: rileyAcme.id },
  ]);

  // Sales & GTM updates.
  await db.insert(gtmUpdates).values([
    { organizationId: acme.id, period: lastPeriod, headline: "Pipeline rebuilt post-churn; named-account motion showing signal", body: "Weighted pipeline back to $6.8M. The named-account mid-market motion produced 9 qualified opps in its first full month.", pipelineValue: 6800000, qualifiedLeads: 21, newWins: 2, lostDeals: 1, newArr: 310000, authorId: rileyAcme.id },
    { organizationId: acme.id, period: thisPeriod, headline: "Largest-ever deal closed; enterprise pipeline forming behind SOC 2", body: "Closed Acme Logistics expansion ($420k ACV). Two enterprise deals ($700k combined) are technically won but blocked on SOC 2 Type II — see risk register. Priya's first-30-days focus: pipeline hygiene and win/loss discipline.", pipelineValue: 8400000, qualifiedLeads: 26, newWins: 4, lostDeals: 2, newArr: 720000, authorId: rileyAcme.id },
  ]);

  // Acme retreat
  const acmeRetreatStart = new Date(); acmeRetreatStart.setDate(acmeRetreatStart.getDate() + 35); acmeRetreatStart.setHours(9, 0, 0, 0);
  const acmeRetreatEnd = new Date(acmeRetreatStart); acmeRetreatEnd.setDate(acmeRetreatEnd.getDate() + 1); acmeRetreatEnd.setHours(17, 0, 0, 0);
  const [acmeRetreat] = await db.insert(retreats).values({
    organizationId: acme.id, organizerId: rileyAcme.id,
    title: "Acme Robotics Leadership Offsite — Summer 2026",
    description: "Two-day offsite for the exec team. Focus: align on the FY2026 plan, surface risks, and reset team operating norms ahead of Series B.",
    location: "Cavallo Point, Sausalito CA",
    startDate: acmeRetreatStart, endDate: acmeRetreatEnd,
    status: "PLANNING",
    intakeToken: genToken("rt_"), intakeOpen: true,
    philosophy: LEADERSHIP_DAY_PHILOSOPHY,
  }).returning();
  await db.insert(retreatAgendaItems).values([
    { retreatId: acmeRetreat.id, order: 1, title: "Welcome + retreat objectives", durationMin: 20, facilitatorName: "Riley" },
    { retreatId: acmeRetreat.id, order: 2, title: "Two truths and a stretch (icebreaker)", durationMin: 20 },
    { retreatId: acmeRetreat.id, order: 3, title: "Trust check-in (personal histories)", durationMin: 60 },
    { retreatId: acmeRetreat.id, order: 4, title: "FY2026 plan walkthrough", durationMin: 90, facilitatorName: "Riley" },
    { retreatId: acmeRetreat.id, order: 5, title: "Pre-mortem on the plan", durationMin: 75 },
    { retreatId: acmeRetreat.id, order: 6, title: "Hot-seat coaching round 1", durationMin: 90 },
    { retreatId: acmeRetreat.id, order: 7, title: "Team agreements drafting", durationMin: 60 },
    { retreatId: acmeRetreat.id, order: 8, title: "Stop / start / continue close", durationMin: 45 },
  ]);

  // Quarterly board update template (rich, structured)
  const quarterlyUpdateSections = [
    { id: "tldr", title: "TL;DR", kind: "rich", prompt: "3-4 sentences. What's the headline of this period? What do you want the board to walk away thinking?" },
    { id: "highlights", title: "Highlights", kind: "rich", prompt: "What went well this period? 3-5 specific wins with metrics where possible." },
    { id: "lowlights", title: "Lowlights & risks", kind: "rich", prompt: "What didn't go well, and what are we doing about it? Be specific — vague concerns help no one." },
    { id: "kpis", title: "Key metrics", kind: "metric", prompt: "ARR, growth rate, burn, runway, NPS, headcount. Include period-over-period comparison." },
    { id: "product", title: "Product & engineering", kind: "rich", prompt: "What shipped. What's next. Customer adoption and feedback themes." },
    { id: "gtm", title: "Go-to-market", kind: "rich", prompt: "Pipeline, key wins, key losses, motion changes." },
    { id: "hiring", title: "Hiring & people", kind: "rich", prompt: "Roles open, key hires made, attrition, leadership development." },
    { id: "asks", title: "Asks of the board", kind: "rich", prompt: "Specific introductions, advice, or decisions needed. Make these actionable." },
  ];
  const [tplCEO] = await db.insert(reportTemplates).values({
    organizationId: acme.id,
    name: "Quarterly Board Update",
    description: "Comprehensive CEO update for the formal quarterly board meeting.",
    sections: JSON.stringify(quarterlyUpdateSections),
  }).returning();

  // Monthly investor / board update — tighter
  const monthlyUpdateSections = [
    { id: "headline", title: "Headline", kind: "rich", prompt: "1-2 sentences. What's the most important thing about this month?" },
    { id: "metrics", title: "Key metrics this month", kind: "metric", prompt: "ARR/MRR · MoM growth · burn · runway · headcount" },
    { id: "wins", title: "Wins", kind: "rich", prompt: "3-5 bullets with names, numbers, or links." },
    { id: "challenges", title: "Challenges", kind: "rich", prompt: "What's hard right now? What are you doing about it?" },
    { id: "asks", title: "Asks", kind: "rich", prompt: "Specific intros or advice. Bullet form." },
  ];
  await db.insert(reportTemplates).values({
    organizationId: acme.id,
    name: "Monthly Investor Update",
    description: "Tight monthly update — for emails to the broader investor list, not the formal board meeting.",
    sections: JSON.stringify(monthlyUpdateSections),
  });

  // Fundraising update
  const fundraisingSections = [
    { id: "round", title: "Round overview", kind: "rich", prompt: "Stage, target raise, valuation, lead status." },
    { id: "investors", title: "Investor pipeline", kind: "rich", prompt: "Engaged firms with status (passed / DD / TS issued)." },
    { id: "timeline", title: "Timeline", kind: "rich", prompt: "Targeted close date and key milestones." },
    { id: "use", title: "Use of proceeds", kind: "rich", prompt: "How the next round funds the plan." },
  ];
  await db.insert(reportTemplates).values({
    organizationId: acme.id,
    name: "Fundraising Update",
    description: "Status of the current round: pipeline, terms, timeline.",
    sections: JSON.stringify(fundraisingSections),
  });

  await db.insert(reports).values({
    organizationId: acme.id, templateId: tplCEO.id, meetingId: acmeUpcoming.id, authorId: rileyAcme.id,
    title: "Acme — Q2 2026 Board Update", status: "DRAFT",
    values: JSON.stringify({
      tldr: "Strong quarter: $4M ARR (+28% QoQ), our largest deal ever, and a key VP Sales hire. Two mid-market churns dropped NRR to 108% — addressable. Series B prep is on track for an early Q4 launch.",
      highlights: "• Crossed $4M ARR (up from $3.1M last quarter)\n• Closed Acme Logistics ($420k ACV) — largest deal to date\n• Shipped v3 of the Fleet Manager UI\n• Hired VP Sales (Priya from CloudOps)",
      lowlights: "• Net retention dipped to 108% (from 115%) — two churned customers in mid-market. Root-causing this month with the CS team.\n• AWS bill grew 22% MoM; FinOps initiative kicking off in May with goal of 15% reduction by Q4.",
      kpis: "ARR: $4.0M (+28% QoQ) · Burn: $480k/mo · Runway: 18 months · NPS: 52 (+4) · Headcount: 38 (+5)",
      product: "Shipped: Fleet Manager v3 UI, multi-tenant scoping, audit log API. Next quarter: enterprise SSO, role-based permissions, and the predictive maintenance MVP. NPS feedback themes: speed (+), mobile gaps (-), reporting flexibility (+).",
      gtm: "Pipeline: $8.4M weighted (up from $5.1M). Closed-won: 4 deals avg $180k ACV. Closed-lost: 2 to incumbent (price), 1 to internal build. Expanded mid-market motion with named-account model — early signal positive.",
      hiring: "Open: Sr. Backend Eng, Customer Success Lead, FP&A Manager. Started: Priya Mehta (VP Sales). Attrition: 0. Leadership development: rolling out Lencioni-style team trust workshops in Q3.",
      asks: "1. Intros at Series B funds focused on vertical SaaS — particularly Tier 1 firms with logistics or fleet experience\n2. Help reviewing the FY2027 hiring plan ahead of next board\n3. Recommendation for an interim Head of Marketing while we run a search",
    }),
  });

  // ── Northstar Grid: lighter dataset (climate-tech seed-stage) ───────
  const nsPastDate = new Date(); nsPastDate.setDate(nsPastDate.getDate() - 14); nsPastDate.setHours(15, 0, 0, 0);
  const nsUpcomingDate = new Date(); nsUpcomingDate.setDate(nsUpcomingDate.getDate() + 28); nsUpcomingDate.setHours(15, 0, 0, 0);

  const [nsPast] = await db.insert(meetings).values({
    organizationId: northstar.id, title: "Northstar — Seed Round Close Discussion", type: "SPECIAL", status: "COMPLETED",
    scheduledAt: nsPastDate, durationMin: 60,
    location: "Zoom",
    minutes: "Board reviewed terms with the lead investor. Approved the $4M seed at $20M post. Maya to finalize SAFE conversions and circulate the cap table by EOW. Independent Chair Danny Ellis flagged the importance of locking down the option pool refresh before close.",
  }).returning();
  const [nsUpcoming] = await db.insert(meetings).values({
    organizationId: northstar.id, title: "Northstar — Q2 Board Meeting", type: "REGULAR", status: "SCHEDULED",
    scheduledAt: nsUpcomingDate, durationMin: 75,
    location: "Northstar HQ, Brooklyn",
    notes: "Pre-read: customer interview synthesis (12 utilities) and grid-software competitive landscape.",
  }).returning();
  await db.insert(agendaItems).values([
    { meetingId: nsUpcoming.id, order: 1, title: "Welcome + minutes approval", durationMin: 5, presenterId: danny.id },
    { meetingId: nsUpcoming.id, order: 2, title: "CEO update — customer pipeline", durationMin: 25, presenterId: mayaNorthstar.id },
    { meetingId: nsUpcoming.id, order: 3, title: "Engineering roadmap to v1", durationMin: 20, presenterId: owenNorthstar.id },
    { meetingId: nsUpcoming.id, order: 4, title: "First-hire planning + option grants", durationMin: 15, presenterId: priyaNorthstar.id },
    { meetingId: nsUpcoming.id, order: 5, title: "Executive session", durationMin: 10 },
  ]);
  const nsAttendees = [mayaNorthstar, owenNorthstar, priyaNorthstar, danny];
  await db.insert(attendances).values(nsAttendees.map((u) => ({ meetingId: nsPast.id, userId: u.id, status: "ATTENDED", respondedAt: nsPastDate })));
  await db.insert(attendances).values(nsAttendees.map((u) => ({ meetingId: nsUpcoming.id, userId: u.id, status: "ACCEPTED", respondedAt: new Date() })));

  await db.insert(resolutions).values({
    organizationId: northstar.id, meetingId: nsPast.id,
    title: "Approval of seed financing — $4M at $20M post-money",
    body: "RESOLVED, that the Company is hereby authorized to issue and sell up to $4,000,000 of Series Seed Preferred Stock at a $20,000,000 post-money valuation, on the terms set forth in the term sheet circulated to the Board.",
    kind: "MEETING_VOTE", status: "PASSED", openedAt: nsPastDate, closedAt: nsPastDate,
  });
  await db.insert(actionItems).values([
    { organizationId: northstar.id, meetingId: nsPast.id, assigneeId: mayaNorthstar.id, title: "Finalize SAFE conversions + cap table", dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), status: "IN_PROGRESS" },
    { organizationId: northstar.id, meetingId: nsPast.id, assigneeId: priyaNorthstar.id, title: "Refresh option pool — board memo", dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), status: "OPEN" },
    { organizationId: northstar.id, assigneeId: owenNorthstar.id, title: "Wire frame the dispatcher console", status: "OPEN" },
  ]);

  const nsStartMonth = new Date(); nsStartMonth.setDate(1); nsStartMonth.setHours(0, 0, 0, 0);
  const [nsPlan] = await db.insert(financialPlans).values({
    organizationId: northstar.id, name: "Seed-to-Series-A Plan",
    description: "Path to $1M ARR and Series A in 18 months.",
    horizonMonths: 18, startingCash: 4000000, startMonth: nsStartMonth,
  }).returning();
  await db.insert(financialScenarios).values([
    { planId: nsPlan.id, name: "Base case", kind: "BASE", assumptions: JSON.stringify({ startingMRR: 8000, monthlyGrowthPct: 14, churnPct: 1, grossMarginPct: 78, monthlyOpexBase: 180000, opexGrowthPct: 2, headcountStart: 7, monthlyHires: 0.6, avgFullyLoadedSalary: 175000 }), notes: "Hit $1M ARR in 12 months; raise A in 15-18." },
    { planId: nsPlan.id, name: "Aggressive hiring", kind: "UPSIDE", assumptions: JSON.stringify({ startingMRR: 8000, monthlyGrowthPct: 18, churnPct: 1, grossMarginPct: 78, monthlyOpexBase: 180000, opexGrowthPct: 2, headcountStart: 7, monthlyHires: 1.2, avgFullyLoadedSalary: 175000 }), notes: "Spend the round faster to hit a $1.5M ARR Series A." },
  ]);

  // ── Harbor Logics: Series A logistics SaaS, mid-stage ───────────────
  const hbPastDate = new Date(); hbPastDate.setDate(hbPastDate.getDate() - 7); hbPastDate.setHours(11, 0, 0, 0);
  const hbUpcomingDate = new Date(); hbUpcomingDate.setDate(hbUpcomingDate.getDate() + 14); hbUpcomingDate.setHours(11, 0, 0, 0);

  const [hbPast] = await db.insert(meetings).values({
    organizationId: harbor.id, title: "Harbor Logics — Q1 2026 Board Meeting", type: "REGULAR", status: "COMPLETED",
    scheduledAt: hbPastDate, durationMin: 90, location: "Harbor HQ, Rotterdam",
    minutes: "Reviewed Q1 results: $4.1M ARR, 31% QoQ growth. Mid-market motion driving strong unit economics. Approved expansion into the German market in Q3. Independent Director Danny Ellis pushed for a clearer hiring sequencing plan ahead of the Q3 expansion.",
  }).returning();
  const [hbUpcoming] = await db.insert(meetings).values({
    organizationId: harbor.id, title: "Harbor — Series B Prep Working Session", type: "SPECIAL", status: "SCHEDULED",
    scheduledAt: hbUpcomingDate, durationMin: 120, location: "Quayside Partners Office, Amsterdam",
    notes: "Working session — bring Series B narrative draft v1.",
  }).returning();
  await db.insert(agendaItems).values([
    { meetingId: hbUpcoming.id, order: 1, title: "Series B narrative walkthrough", durationMin: 30, presenterId: liamHarbor.id },
    { meetingId: hbUpcoming.id, order: 2, title: "Financial model deep-dive", durationMin: 30, presenterId: ritaHarbor.id },
    { meetingId: hbUpcoming.id, order: 3, title: "Investor target list review", durationMin: 30, presenterId: noorHarbor.id },
    { meetingId: hbUpcoming.id, order: 4, title: "Roadshow timeline + readiness", durationMin: 30, presenterId: liamHarbor.id },
  ]);
  const hbAttendees = [liamHarbor, feiHarbor, noorHarbor, ritaHarbor, danny];
  await db.insert(attendances).values(hbAttendees.map((u) => ({ meetingId: hbPast.id, userId: u.id, status: "ATTENDED", respondedAt: hbPastDate })));
  await db.insert(attendances).values(hbAttendees.map((u) => ({ meetingId: hbUpcoming.id, userId: u.id, status: "ACCEPTED", respondedAt: new Date() })));

  await db.insert(resolutions).values({
    organizationId: harbor.id, meetingId: hbPast.id,
    title: "Approval of German market expansion (Q3 2026)",
    body: "RESOLVED, that the Board hereby authorizes management to expand operations into the Federal Republic of Germany in Q3 2026, with associated incremental headcount and operating expenditure not to exceed $1.8M in aggregate through year-end 2026.",
    kind: "MEETING_VOTE", status: "PASSED", openedAt: hbPastDate, closedAt: hbPastDate,
  });

  await db.insert(actionItems).values([
    { organizationId: harbor.id, meetingId: hbPast.id, assigneeId: noorHarbor.id, title: "Finalize Series B target list with rationale", dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), status: "IN_PROGRESS" },
    { organizationId: harbor.id, meetingId: hbPast.id, assigneeId: ritaHarbor.id, title: "Three-statement model with Germany scenario", dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), status: "IN_PROGRESS" },
    { organizationId: harbor.id, meetingId: hbPast.id, assigneeId: liamHarbor.id, title: "Series B narrative — first full draft", dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), status: "OPEN" },
  ]);

  const hbStartMonth = new Date(); hbStartMonth.setDate(1); hbStartMonth.setHours(0, 0, 0, 0);
  const [hbPlan] = await db.insert(financialPlans).values({
    organizationId: harbor.id, name: "FY2026 Plan + Germany Expansion",
    description: "Base / Aggressive / Conservative with Germany cost overlay.",
    horizonMonths: 18, startingCash: 9500000, startMonth: hbStartMonth,
  }).returning();
  await db.insert(financialScenarios).values([
    { planId: hbPlan.id, name: "Base case (Germany Q3)", kind: "BASE", assumptions: JSON.stringify({ startingMRR: 342000, monthlyGrowthPct: 9, churnPct: 1.5, grossMarginPct: 74, monthlyOpexBase: 280000, opexGrowthPct: 2, headcountStart: 41, monthlyHires: 1.5, avgFullyLoadedSalary: 168000 }), notes: "Plan-of-record. Germany hires start in M4." },
    { planId: hbPlan.id, name: "Aggressive Series B raise", kind: "UPSIDE", assumptions: JSON.stringify({ startingMRR: 342000, monthlyGrowthPct: 13, churnPct: 1.2, grossMarginPct: 76, monthlyOpexBase: 280000, opexGrowthPct: 2, headcountStart: 41, monthlyHires: 2.5, avgFullyLoadedSalary: 168000 }), notes: "Raise B at $80M ARR run-rate. Pull hiring forward." },
    { planId: hbPlan.id, name: "Conservative", kind: "DOWNSIDE", assumptions: JSON.stringify({ startingMRR: 342000, monthlyGrowthPct: 5, churnPct: 2.5, grossMarginPct: 72, monthlyOpexBase: 280000, opexGrowthPct: 1.5, headcountStart: 41, monthlyHires: 0.5, avgFullyLoadedSalary: 168000 }), notes: "Defer Germany. Extend runway to 30 months." },
  ]);

  // ── Coaching (lives under Danny's user, NOT under any single org) ──
  const [foundersProgram, execProgram] = await db.insert(coachingPrograms).values([
    { ownerId: danny.id, title: "First-Time Founder Fundamentals", description: "Eight-week program for first-time founders building their first board and exec team.", kind: "FOUNDER" },
    { ownerId: danny.id, title: "Series A → Series B Operator", description: "For CEOs scaling from product-market fit to repeatable GTM.", kind: "EXEC" },
  ]).returning();

  await db.insert(coachingLessons).values([
    { programId: foundersProgram.id, order: 1, title: "Defining your operating cadence", durationMin: 60, body: "Establish the rhythm that lets a startup compound. Daily, weekly, monthly, quarterly — what runs at each layer? We'll design your first 90 days of meetings, decision logs, and metrics rituals.", exercises: JSON.stringify([{ title: "Cadence inventory", prompt: "List every meeting on your calendar this week. Tag each: ship, decide, align, info. Cut anything that's pure 'info.'" }]) },
    { programId: foundersProgram.id, order: 2, title: "Hiring your first ten — without bottlenecking yourself", durationMin: 75, body: "Founders hire from their network too long. We'll build a hiring pipeline and an interviewing process that scales past the first ten.", exercises: JSON.stringify([{ title: "Role scorecard", prompt: "Write a one-page scorecard for the next role you'll hire. Outcomes, competencies, must-haves vs nice-to-haves." }]) },
    { programId: foundersProgram.id, order: 3, title: "Running a board meeting that's actually useful", durationMin: 90, body: "The default board meeting is performative. We'll redesign yours.", exercises: JSON.stringify([{ title: "Pre-read audit", prompt: "Take last quarter's board pack. Highlight every section that was duplicated in the live meeting." }]) },
    { programId: execProgram.id, order: 1, title: "The CEO's job changes at $5M ARR", durationMin: 60, body: "At PMF you sold and built. At Series A → B you build the team that builds the company.", exercises: JSON.stringify([{ title: "Time audit", prompt: "Categorize last week's calendar into: building, selling, hiring, managing, fundraising, customer-facing, internal." }]) },
    { programId: execProgram.id, order: 2, title: "Building your first executive team", durationMin: 75, body: "When to hire a VP, when an interim, when to promote." },
  ]);

  // Coaching clients — Maya and Liam are also founder users in their own orgs
  const [client1, client2, client3] = await db.insert(coachingClients).values([
    { ownerId: danny.id, programId: foundersProgram.id, name: "Maya Okonkwo", email: "maya@northstar.demo", company: "Northstar Grid", role: "Founder & CEO", status: "ACTIVE", startDate: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), notes: "Series Seed climate tech. Strong product instincts, learning to run an exec team." },
    { ownerId: danny.id, programId: execProgram.id, name: "Liam Ó Briain", email: "liam@harbor.demo", company: "Harbor Logics", role: "CEO", status: "ACTIVE", startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), notes: "Series A logistics SaaS. Working on Series B prep and the GTM motion split between SMB and mid-market." },
    { ownerId: danny.id, name: "Alia Rasheed", email: "alia@verdant.demo", company: "Verdant Inc.", role: "Co-founder & CTO", status: "PAUSED", notes: "Interest in upgrading from CTO to two-in-a-box co-CEO model. Paused while she fundraises." },
  ]).returning();

  const foundersLessons = await db.select().from(coachingLessons).where(eq(coachingLessons.programId, foundersProgram.id));
  const execLessons = await db.select().from(coachingLessons).where(eq(coachingLessons.programId, execProgram.id));
  if (foundersLessons.length) {
    await db.insert(lessonAssignments).values([
      { lessonId: foundersLessons[0].id, clientId: client1.id, status: "COMPLETED", completedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      { lessonId: foundersLessons[1].id, clientId: client1.id, status: "IN_PROGRESS" },
      { lessonId: foundersLessons[2].id, clientId: client1.id, status: "ASSIGNED" },
    ]);
  }
  if (execLessons.length) {
    await db.insert(lessonAssignments).values([
      { lessonId: execLessons[0].id, clientId: client2.id, status: "COMPLETED", completedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      { lessonId: execLessons[1].id, clientId: client2.id, status: "IN_PROGRESS" },
    ]);
  }
  await db.insert(coachingSessions).values([
    { clientId: client1.id, ownerId: danny.id, sessionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), durationMin: 60, topic: "Hiring her first VP Eng", notes: "Maya is interviewing two finalists. Worked through a scorecard.", followUps: "Send the scorecard template. Intro to two references." },
    { clientId: client2.id, ownerId: danny.id, sessionDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), durationMin: 75, topic: "Series B narrative", notes: "Liam workshopped his fundraising story. Strong on the wedge but the moat slide is weak.", followUps: "Liam to revise the moat slide and send by Friday." },
  ]);
  void client3;

  // ── Retreat library (global, available to all orgs) ─────────────────
  await db.insert(retreatActivities).values([
    { title: "Two truths and a stretch", kind: "ICEBREAKER", durationMin: 20, groupSizeMin: 4, groupSizeMax: 30, description: "A spin on Two Truths and a Lie — instead of a lie, the third statement is something the person is stretching to do this year.", instructions: "Each person shares two true things and one stretch goal. The group guesses which is the stretch.", learningObjectives: "Lower social barrier; surface ambitions; create empathy.", isGlobal: true },
    { title: "Pre-mortem", kind: "STRATEGIC", durationMin: 75, groupSizeMin: 4, groupSizeMax: 20, description: "Imagine it's 12 months from now and the strategy failed. Work backward to identify the most likely failure modes.", instructions: "1. Set the scene (5m).\n2. Silent writing — top 3 reasons we failed (10m).\n3. Group affinity-mapping (20m).\n4. Vote on top 3 (10m).\n5. Each top risk gets a mitigation owner and check-in cadence (30m).", materials: "Sticky notes, sharpies, dot-vote stickers, large wall surface.", learningObjectives: "De-risk the plan; force psychological safety around dissent.", isGlobal: true },
    { title: "Trust check-in (Lencioni style)", kind: "TRUST", durationMin: 60, groupSizeMin: 5, groupSizeMax: 12, description: "Personal histories exercise to deepen vulnerability-based trust on a leadership team.", instructions: "Each person shares: where they grew up, number of siblings, biggest challenge as a kid. Facilitator goes first to model openness.", learningObjectives: "Build vulnerability-based trust; humanize leadership team members.", isGlobal: true },
    { title: "Hot seat coaching", kind: "LEADERSHIP", durationMin: 90, groupSizeMin: 4, groupSizeMax: 8, description: "Each leader gets 15 minutes of group coaching on a real challenge.", instructions: "Person on the hot seat states their challenge in 90s. Group asks clarifying questions only for 5m. Group offers observations and reframes (not advice) for 8m. Hot seat reflects.", materials: "Timer; quiet space.", learningObjectives: "Practice peer coaching; build leadership skill of receiving feedback.", isGlobal: true },
    { title: "Team agreements drafting", kind: "TEAM_SKILL", durationMin: 60, groupSizeMin: 3, groupSizeMax: 15, description: "Co-create a one-page team operating agreement.", instructions: "1. 'In our best moments, what does our team do?' (10m)\n2. 'In our worst moments, what trips us up?' (10m)\n3. Draft 5-7 agreements (25m)\n4. Test willingness to call each other out (15m)", learningObjectives: "Make implicit norms explicit; create permission for accountability.", isGlobal: true },
    { title: "Stop / start / continue", kind: "REFLECTION", durationMin: 45, groupSizeMin: 3, groupSizeMax: 20, description: "Quick close-out reflection on team behaviors heading into the next quarter.", instructions: "Each person silently writes 1-3 items per category. Round-robin share. Group commits to 1 stop, 1 start, 1 continue.", learningObjectives: "Crisp commitments; shared accountability for behaviors.", isGlobal: true },
  ]);

  // ── Retreat templates (global) ──
  await db.insert(retreatTemplates).values({
    name: "Leadership Working Day",
    tagline: "One day. Five working sessions. Designed to surface real challenges, practice candor, and ship working AI prototypes by 3 PM.",
    philosophy: LEADERSHIP_DAY_PHILOSOPHY,
    agenda: JSON.stringify(LEADERSHIP_DAY_AGENDA),
    intakeSchema: JSON.stringify(LEADERSHIP_DAY_INTAKE),
    isGlobal: true,
  });

  console.log("\nDone. Demo logins (all use password: password123):\n");
  console.log("  Primary advisor (cross-portfolio):");
  console.log("    danny@sidequest.demo   — Danny Ellis, Director on all 3 orgs + coaching workspace\n");
  console.log("  Per-company founders (single-org logins to verify isolation):");
  console.log("    riley@acme.demo        — Acme Robotics CEO (only sees Acme)");
  console.log("    maya@northstar.demo    — Northstar Grid CEO (only sees Northstar)");
  console.log("    liam@harbor.demo       — Harbor Logics CEO (only sees Harbor)\n");
  console.log("  Other team logins (also single-org):");
  console.log("    sam@acme.demo, drew@acme.demo, owen@northstar.demo, fei@harbor.demo, etc.");

  sqlite.close();
}

main().catch((e) => {
  console.error(e);
  sqlite.close();
  process.exit(1);
});
