import bcrypt from "bcryptjs";
import * as schema from "./schema";
import { eq, inArray, like } from "drizzle-orm";
import { projectScenario, type ScenarioAssumptions } from "../lib/finance";
import { BUILTIN_TEMPLATES } from "../lib/report-template-defs";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzleLite } from "drizzle-orm/pglite";

type Db = PostgresJsDatabase<typeof schema>;

const dbUrl = process.env.DATABASE_URL;
const isPg = !!dbUrl && (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://"));

let db: Db;
let closeDb: () => Promise<void>;

async function connect() {
  if (isPg) {
    const postgres = (await import("postgres")).default;
    const client = postgres(dbUrl!, { prepare: false, max: 1 });
    db = drizzlePg(client, { schema });
    closeDb = async () => {
      await client.end();
    };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const client = new PGlite(process.env.PGLITE_DIR ?? "./data/pglite");
    db = drizzleLite(client, { schema }) as unknown as Db;
    closeDb = async () => {
      await client.close();
    };
  }
}

const {
  users, organizations, memberships, meetings, agendaItems, attendances,
  resolutions, votes, actionItems, reportTemplates, reports, financialPlans,
  financialScenarios,
  financialSnapshots, forecastSnapshots,
  risks, riskReviews, projects, projectMilestones, projectUpdates,
  teamUpdates, customers, customerUpdates, gtmUpdates,
} = schema;



async function main() {
  // Guard: refuse to run against production unless explicitly authorized.
  // The seed wipes existing demo data and recreates it — destructive on a
  // live DB. Set ALLOW_PROD_SEED=1 to override (only meaningful for the
  // first prod seeding, never on a populated production DB).
  const url = process.env.DATABASE_URL ?? "";
  const looksLikeProd =
    process.env.NODE_ENV === "production" ||
    isPg ||
    /supabase|vercel|prod/i.test(url);
  if (looksLikeProd && process.env.ALLOW_PROD_SEED !== "1") {
    console.error(
      "Refusing to run demo seed against what looks like a production database.\n" +
      `  DATABASE_URL: ${url || "(unset)"}\n` +
      "  Set ALLOW_PROD_SEED=1 to override (this WILL wipe all demo-pattern data)."
    );
    process.exit(2);
  }

  await connect();
  console.log("Seeding…");
  const passwordHash = await bcrypt.hash("password123", 10);

  // ── Wipe demo data (idempotent re-seeds) ─────────────────────────────
  // Children before parents; FKs cascade the rest.
  const wipeAll = [
    forecastSnapshots, riskReviews, risks, projectUpdates, projectMilestones, projects,
    teamUpdates, customerUpdates, customers, gtmUpdates, financialSnapshots,
    financialScenarios, financialPlans, reports, reportTemplates,
    votes, attendances, agendaItems, actionItems, schema.documents,
    resolutions, meetings, memberships,
  ];
  for (const table of wipeAll) {
    await db.delete(table);
  }
  await db.delete(users).where(like(users.email, "%.demo"));
  await db
    .delete(organizations)
    .where(inArray(organizations.slug, ["acme-robotics", "northstar-grid", "harbor-logics"]));

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

  // ── Acme: rich data (rep mtg, upcoming mtg, resolutions, action items, financial plan) ──
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
  const acmeScenarios = await db.insert(financialScenarios).values([
    { planId: acmePlan.id, name: "Base case", kind: "BASE", assumptions: JSON.stringify({ startingMRR: 333000, monthlyGrowthPct: 7, churnPct: 2, grossMarginPct: 72, monthlyOpexBase: 240000, opexGrowthPct: 1.5, headcountStart: 38, monthlyHires: 1.5, avgFullyLoadedSalary: 195000 }), notes: "Plan-of-record. 7% MoM growth, 38→74 headcount over horizon." },
    { planId: acmePlan.id, name: "Upside", kind: "UPSIDE", assumptions: JSON.stringify({ startingMRR: 333000, monthlyGrowthPct: 11, churnPct: 1.5, grossMarginPct: 75, monthlyOpexBase: 240000, opexGrowthPct: 1.2, headcountStart: 38, monthlyHires: 2.5, avgFullyLoadedSalary: 195000 }), notes: "Enterprise motion lands. Justifies accelerated GTM hiring." },
    { planId: acmePlan.id, name: "Downside", kind: "DOWNSIDE", assumptions: JSON.stringify({ startingMRR: 333000, monthlyGrowthPct: 4, churnPct: 3, grossMarginPct: 70, monthlyOpexBase: 240000, opexGrowthPct: 1, headcountStart: 38, monthlyHires: 0.3, avgFullyLoadedSalary: 195000 }), notes: "Macro slowdown + one large logo churns. Hiring freeze; runway extension to 28 months." },
  ]).returning();
  const acmeBase = acmeScenarios.find((x) => x.kind === "BASE")!;

  
  // Forecast snapshots: one per meeting so the hub shows how the forward
  // view moved. Last quarter's forecast was rosier (9% growth); the current
  // capture uses the plan-of-record base case.
  const oldAssumptions: ScenarioAssumptions = {
    startingMRR: 310000, monthlyGrowthPct: 9, churnPct: 1.5, grossMarginPct: 73,
    monthlyOpexBase: 230000, opexGrowthPct: 1.5, headcountStart: 35, monthlyHires: 2,
    avgFullyLoadedSalary: 195000,
  };
  const baseAssumptions = JSON.parse(acmeBase.assumptions) as ScenarioAssumptions;
  const oldProj = projectScenario(12600000, acmeStartMonth, 24, oldAssumptions);
  const newProj = projectScenario(12000000, acmeStartMonth, 24, baseAssumptions);
  await db.insert(forecastSnapshots).values([
    {
      organizationId: acme.id, meetingId: acmePast.id, name: "Base case",
      assumptions: JSON.stringify(oldAssumptions), startingCash: 12600000,
      startMonth: acmeStartMonth, horizonMonths: 24,
      runwayMonths: oldProj.runwayMonths, endingArr: oldProj.endingARR,
      endingCash: oldProj.endingCash, breakevenMonth: oldProj.breakevenMonth,
      createdById: rileyAcme.id, createdAt: acmePastDate,
    },
    {
      organizationId: acme.id, meetingId: acmeUpcoming.id, name: "Base case",
      sourceScenarioId: acmeBase.id,
      assumptions: acmeBase.assumptions, startingCash: 12000000,
      startMonth: acmeStartMonth, horizonMonths: 24,
      runwayMonths: newProj.runwayMonths, endingArr: newProj.endingARR,
      endingCash: newProj.endingCash, breakevenMonth: newProj.breakevenMonth,
      createdById: rileyAcme.id,
    },
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

  // Global best-practice templates (same definitions the app self-provisions
  // in production) + one org-scoped extra for the demo.
  const [tplMonthly, tplQuarterly] = await db.insert(reportTemplates).values(
    BUILTIN_TEMPLATES.map((t) => ({
      organizationId: null,
      name: t.name,
      description: t.description,
      sections: JSON.stringify(t.sections),
      isGlobal: true,
    }))
  ).returning();
  void tplMonthly;

  await db.insert(reportTemplates).values({
    organizationId: acme.id,
    name: "Fundraising Update",
    description: "Status of the current round: pipeline, terms, timeline.",
    sections: JSON.stringify([
      { id: "round", title: "Round overview", kind: "rich", prompt: "Stage, target raise, valuation, lead status." },
      { id: "investors", title: "Investor pipeline", kind: "rich", prompt: "Engaged firms with status (passed / DD / TS issued)." },
      { id: "timeline", title: "Timeline", kind: "rich", prompt: "Targeted close date and key milestones." },
      { id: "use", title: "Use of proceeds", kind: "rich", prompt: "How the next round funds the plan." },
    ]),
  });

  await db.insert(reports).values({
    organizationId: acme.id, templateId: tplQuarterly.id, meetingId: acmeUpcoming.id, authorId: rileyAcme.id,
    title: "Acme — Q2 2026 Quarterly Board Report", status: "DRAFT",
    values: JSON.stringify({
      ceo_letter: "Strong quarter: $4M ARR (+28% QoQ), our largest deal ever, and a key VP Sales hire. Two mid-market churns dropped NRR to 108% — addressable, and the root-cause work is underway. Series B prep is on track for an early Q4 launch. What I believe now that I didn't in March: the predictive-maintenance wedge is the enterprise story, not a feature.",
      metrics: "ARR: $4.0M (+28% QoQ) · Burn: $480k/mo · Runway: 18 months · NPS: 52 (+4) · Headcount: 38 (+5)",
      financials: "Revenue finished 4% above plan on the Acme Logistics expansion. Gross margin at 72% (+1pt) as hosting optimization landed. Burn crept to $480k/mo on the VP Sales hire — within the approved envelope. AR at 1.4× monthly revenue; no collection concerns.",
      forecast: "Base case now assumes 7% MoM growth (was 9% at the last meeting) after the mid-market churns; hiring plan trimmed by 2 heads in H2. Runway effect: −2 months vs prior forecast. See the forecast comparison in the board pack.",
      strategy: "1. Enterprise readiness — AT RISK (SOC 2 window slipped 3 weeks). 2. Predictive-maintenance wedge — ON TRACK (3/5 design partners live). 3. Series B — ON TRACK (narrative v1 done). 4. Mid-market NRR recovery — NEW this quarter.",
      product: "Shipped: Fleet Manager v3, SSO, audit-log API. Predictive maintenance MVP live with 3 design partners; first real save (9-day early actuator failure prediction) at Acme Logistics. Next: RBAC, partner #4–5, GA pricing.",
      gtm: "Pipeline $8.4M weighted (up from $5.1M). Closed-won 4 deals, avg $180k ACV. Two enterprise deals ($700k combined) technically won but blocked on SOC 2. Priya (VP Sales) rebuilding pipeline hygiene and win/loss discipline.",
      customers: "Acme Logistics expanded ($420k ACV, largest ever). National Parcel at-risk — new procurement lead benchmarking us; exec dinner on the 14th. Metro Transit depot #2 pilot in legal. Pacific Cold Chain pilot SLA at 97.2% vs 98% target, cure plan agreed.",
      team: "Priya Mehta started as VP Sales. Zero regretted attrition for 6 months. Open: CS Lead, FP&A Manager, Staff Perception Eng. Watch: perception team stretched until the architecture-lead promotion lands.",
      risks: "New since last quarter: mid-market churn concentration. Escalated: supplier single-sourcing (second source in qualification, buffer at 6/10 weeks). Closed: AWS cost overrun (bill −17%). Register reviewed in full in the board pack.",
      governance: "Option grants for 5 new hires attached for approval (Exhibit A). No cap-table changes. SOC 2 Type II evidence collection 60% complete. No outstanding legal matters.",
      asks: "1. Intros to Tier-1 Series B funds with logistics/fleet theses. 2. Approve the attached option grants. 3. A reference customer intro for partner #6 on the predictive-maintenance waitlist.",
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

  console.log("\nDone. Demo logins (all use password: password123):\n");
  console.log("  Primary advisor (cross-portfolio):");
  console.log("    danny@sidequest.demo   — Danny Ellis, Director on all 3 orgs\n");
  console.log("  Per-company founders (single-org logins to verify isolation):");
  console.log("    riley@acme.demo        — Acme Robotics CEO (only sees Acme)");
  console.log("    maya@northstar.demo    — Northstar Grid CEO (only sees Northstar)");
  console.log("    liam@harbor.demo       — Harbor Logics CEO (only sees Harbor)\n");
  console.log("  Other team logins (also single-org):");
  console.log("    sam@acme.demo, drew@acme.demo, owen@northstar.demo, fei@harbor.demo, etc.");

  await closeDb();
}

main().catch(async (e) => {
  console.error(e);
  await closeDb?.();
  process.exit(1);
});
