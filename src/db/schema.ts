import { sql, relations } from "drizzle-orm";
import { sqliteTable, text, integer, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";

const cuid = () => sql`(lower(hex(randomblob(12))))`;
const now = () => sql`(unixepoch())`;

// -------- Auth --------

export const users = sqliteTable("User", {
  id: text("id").primaryKey().default(cuid()),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  passwordHash: text("passwordHash"),
  emailVerified: integer("emailVerified", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

export const accounts = sqliteTable(
  "Account",
  {
    id: text("id").primaryKey().default(cuid()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    providerUnique: uniqueIndex("Account_provider_providerAccountId_key").on(t.provider, t.providerAccountId),
  })
);

export const sessions = sqliteTable("Session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "VerificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: integer("expires", { mode: "timestamp" }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) })
);

// -------- Tenancy --------

export const organizations = sqliteTable("Organization", {
  id: text("id").primaryKey().default(cuid()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  legalName: text("legalName"),
  jurisdiction: text("jurisdiction"),
  logoUrl: text("logoUrl"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

export const memberships = sqliteTable(
  "Membership",
  {
    id: text("id").primaryKey().default(cuid()),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    organizationId: text("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("DIRECTOR"),
    title: text("title"),
    organizationLabel: text("organizationLabel"),
    votingRights: integer("votingRights", { mode: "boolean" }).notNull().default(true),
    termStart: integer("termStart", { mode: "timestamp" }),
    termEnd: integer("termEnd", { mode: "timestamp" }),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  },
  (t) => ({
    userOrgUnique: uniqueIndex("Membership_userId_organizationId_key").on(t.userId, t.organizationId),
  })
);

// -------- Meetings --------

export const meetings = sqliteTable("Meeting", {
  id: text("id").primaryKey().default(cuid()),
  organizationId: text("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("REGULAR"),
  status: text("status").notNull().default("DRAFT"),
  scheduledAt: integer("scheduledAt", { mode: "timestamp" }).notNull(),
  durationMin: integer("durationMin").notNull().default(60),
  location: text("location"),
  videoUrl: text("videoUrl"),
  notes: text("notes"),
  minutes: text("minutes"),
  quorumRequired: integer("quorumRequired").notNull().default(0),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

export const agendaItems = sqliteTable(
  "AgendaItem",
  {
    id: text("id").primaryKey().default(cuid()),
    meetingId: text("meetingId").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    durationMin: integer("durationMin").notNull().default(10),
    presenterId: text("presenterId").references(() => users.id),
  },
  (t) => ({ meetingOrder: index("AgendaItem_meetingId_order_idx").on(t.meetingId, t.order) })
);

export const attendances = sqliteTable(
  "Attendance",
  {
    id: text("id").primaryKey().default(cuid()),
    meetingId: text("meetingId").notNull().references(() => meetings.id, { onDelete: "cascade" }),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("INVITED"),
    respondedAt: integer("respondedAt", { mode: "timestamp" }),
  },
  (t) => ({
    mu: uniqueIndex("Attendance_meetingId_userId_key").on(t.meetingId, t.userId),
  })
);

// -------- Resolutions --------

export const resolutions = sqliteTable("Resolution", {
  id: text("id").primaryKey().default(cuid()),
  organizationId: text("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  meetingId: text("meetingId").references(() => meetings.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  kind: text("kind").notNull().default("MEETING_VOTE"),
  status: text("status").notNull().default("DRAFT"),
  requiresUnanimous: integer("requiresUnanimous", { mode: "boolean" }).notNull().default(false),
  openedAt: integer("openedAt", { mode: "timestamp" }),
  closedAt: integer("closedAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

export const votes = sqliteTable(
  "Vote",
  {
    id: text("id").primaryKey().default(cuid()),
    resolutionId: text("resolutionId").notNull().references(() => resolutions.id, { onDelete: "cascade" }),
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    choice: text("choice").notNull(),
    comment: text("comment"),
    castAt: integer("castAt", { mode: "timestamp" }).notNull().default(now()),
  },
  (t) => ({
    ru: uniqueIndex("Vote_resolutionId_userId_key").on(t.resolutionId, t.userId),
  })
);

// -------- Documents --------

export const documents = sqliteTable(
  "Document",
  {
    id: text("id").primaryKey().default(cuid()),
    organizationId: text("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    meetingId: text("meetingId").references(() => meetings.id, { onDelete: "set null" }),
    uploadedById: text("uploadedById").notNull().references(() => users.id),
    title: text("title").notNull(),
    description: text("description"),
    filename: text("filename").notNull(),
    mimeType: text("mimeType").notNull(),
    sizeBytes: integer("sizeBytes").notNull(),
    storagePath: text("storagePath").notNull(),
    visibility: text("visibility").notNull().default("ALL_MEMBERS"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  },
  (t) => ({ orgMeeting: index("Document_organizationId_meetingId_idx").on(t.organizationId, t.meetingId) })
);

// -------- Action items --------

export const actionItems = sqliteTable("ActionItem", {
  id: text("id").primaryKey().default(cuid()),
  organizationId: text("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  meetingId: text("meetingId").references(() => meetings.id, { onDelete: "set null" }),
  assigneeId: text("assigneeId").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: integer("dueDate", { mode: "timestamp" }),
  status: text("status").notNull().default("OPEN"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

// -------- Relations --------

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  memberships: many(memberships),
  votes: many(votes),
  uploads: many(documents),
  agendaItems: many(agendaItems),
  attendances: many(attendances),
  actionItems: many(actionItems),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  meetings: many(meetings),
  resolutions: many(resolutions),
  documents: many(documents),
  actionItems: many(actionItems),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  organization: one(organizations, { fields: [memberships.organizationId], references: [organizations.id] }),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  organization: one(organizations, { fields: [meetings.organizationId], references: [organizations.id] }),
  agenda: many(agendaItems),
  attendances: many(attendances),
  resolutions: many(resolutions),
  documents: many(documents),
  actionItems: many(actionItems),
}));

export const agendaItemsRelations = relations(agendaItems, ({ one }) => ({
  meeting: one(meetings, { fields: [agendaItems.meetingId], references: [meetings.id] }),
  presenter: one(users, { fields: [agendaItems.presenterId], references: [users.id] }),
}));

export const attendancesRelations = relations(attendances, ({ one }) => ({
  meeting: one(meetings, { fields: [attendances.meetingId], references: [meetings.id] }),
  user: one(users, { fields: [attendances.userId], references: [users.id] }),
}));

export const resolutionsRelations = relations(resolutions, ({ one, many }) => ({
  organization: one(organizations, { fields: [resolutions.organizationId], references: [organizations.id] }),
  meeting: one(meetings, { fields: [resolutions.meetingId], references: [meetings.id] }),
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  resolution: one(resolutions, { fields: [votes.resolutionId], references: [resolutions.id] }),
  user: one(users, { fields: [votes.userId], references: [users.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  organization: one(organizations, { fields: [documents.organizationId], references: [organizations.id] }),
  meeting: one(meetings, { fields: [documents.meetingId], references: [meetings.id] }),
  uploadedBy: one(users, { fields: [documents.uploadedById], references: [users.id] }),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  organization: one(organizations, { fields: [actionItems.organizationId], references: [organizations.id] }),
  meeting: one(meetings, { fields: [actionItems.meetingId], references: [meetings.id] }),
  assignee: one(users, { fields: [actionItems.assigneeId], references: [users.id] }),
}));

// -------- Board reports (templated) --------

// kind: each section type — see lib/enums REPORT_SECTION_KINDS
// sections JSON shape: Array<{ id: string; title: string; kind: string; prompt?: string; placeholder?: string }>
export const reportTemplates = sqliteTable("ReportTemplate", {
  id: text("id").primaryKey().default(cuid()),
  organizationId: text("organizationId").references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  sections: text("sections").notNull(),
  isGlobal: integer("isGlobal", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

// values JSON shape: Record<sectionId, string>
// status: DRAFT | PUBLISHED
export const reports = sqliteTable("Report", {
  id: text("id").primaryKey().default(cuid()),
  organizationId: text("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  templateId: text("templateId").references(() => reportTemplates.id, { onDelete: "set null" }),
  meetingId: text("meetingId").references(() => meetings.id, { onDelete: "set null" }),
  authorId: text("authorId").notNull().references(() => users.id),
  title: text("title").notNull(),
  values: text("values").notNull().default("{}"),
  status: text("status").notNull().default("DRAFT"),
  boardPackDocumentId: text("boardPackDocumentId"),  // set when published to board pack
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

// -------- Financial plans / scenarios --------

export const financialPlans = sqliteTable("FinancialPlan", {
  id: text("id").primaryKey().default(cuid()),
  organizationId: text("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  horizonMonths: integer("horizonMonths").notNull().default(24),
  startingCash: integer("startingCash").notNull().default(0), // in dollars (whole)
  startMonth: integer("startMonth", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

// One monthly snapshot of actuals for a company. Manually entered.
// metricsJson is a flexible bag for forward-compat (CAC, LTV, etc).
export const financialSnapshots = sqliteTable(
  "FinancialSnapshot",
  {
    id: text("id").primaryKey().default(cuid()),
    organizationId: text("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    period: integer("period", { mode: "timestamp" }).notNull(), // first day of month being reported
    cash: integer("cash").notNull().default(0),
    arr: integer("arr").notNull().default(0),
    mrr: integer("mrr").notNull().default(0),
    revenue: integer("revenue").notNull().default(0),
    grossMargin: integer("grossMargin").notNull().default(0), // percentage 0-100
    burn: integer("burn").notNull().default(0),              // monthly net burn (positive = cash burned)
    headcount: integer("headcount").notNull().default(0),
    accountsReceivable: integer("accountsReceivable").notNull().default(0),
    accountsPayable: integer("accountsPayable").notNull().default(0),
    metricsJson: text("metricsJson").notNull().default("{}"),
    notes: text("notes"),
    createdById: text("createdById").notNull().references(() => users.id),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
    updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
  },
  (t) => ({
    orgPeriod: uniqueIndex("FinancialSnapshot_organizationId_period_key").on(t.organizationId, t.period),
  })
);

// kind: BALANCE_SHEET | P_AND_L | AR | AP | PRO_FORMA | HEADCOUNT | CAP_TABLE | OTHER
// Files attached to a financial period; uses the existing Document storage.
export const financialDocuments = sqliteTable(
  "FinancialDocument",
  {
    id: text("id").primaryKey().default(cuid()),
    organizationId: text("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    snapshotId: text("snapshotId").references(() => financialSnapshots.id, { onDelete: "set null" }),
    period: integer("period", { mode: "timestamp" }).notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    filename: text("filename").notNull(),
    mimeType: text("mimeType").notNull(),
    sizeBytes: integer("sizeBytes").notNull(),
    storagePath: text("storagePath").notNull(),
    uploadedById: text("uploadedById").notNull().references(() => users.id),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  },
  (t) => ({
    orgKindPeriod: index("FinancialDocument_organizationId_kind_period_idx").on(t.organizationId, t.kind, t.period),
  })
);

// kind: BASE | UPSIDE | DOWNSIDE | CUSTOM
// assumptions JSON shape: {
//   startingMRR: number,
//   monthlyGrowthPct: number,        // e.g. 8 = 8% MoM
//   churnPct: number,                // monthly logo churn
//   grossMarginPct: number,
//   monthlyOpexBase: number,         // current monthly fixed opex (rent, tools, etc.)
//   opexGrowthPct: number,           // monthly opex creep
//   headcountStart: number,
//   monthlyHires: number,
//   avgFullyLoadedSalary: number,    // annual; converted to monthly internally
//   oneTimeRevenue: { month: number, amount: number }[],
//   oneTimeCosts: { month: number, amount: number }[],
// }
export const financialScenarios = sqliteTable("FinancialScenario", {
  id: text("id").primaryKey().default(cuid()),
  planId: text("planId").notNull().references(() => financialPlans.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("CUSTOM"),
  assumptions: text("assumptions").notNull(),
  notes: text("notes"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

// -------- AI chat (per-org assistant) --------

export const chatThreads = sqliteTable("ChatThread", {
  id: text("id").primaryKey().default(cuid()),
  organizationId: text("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New conversation"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

// role: user | assistant | system
export const chatMessages = sqliteTable(
  "ChatMessage",
  {
    id: text("id").primaryKey().default(cuid()),
    threadId: text("threadId").notNull().references(() => chatThreads.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  },
  (t) => ({ threadCreated: index("ChatMessage_threadId_createdAt_idx").on(t.threadId, t.createdAt) })
);

// -------- Coaching --------

// kind: FOUNDER | EXEC | MANAGER | TEAM
export const coachingPrograms = sqliteTable("CoachingProgram", {
  id: text("id").primaryKey().default(cuid()),
  ownerId: text("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind").notNull().default("FOUNDER"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

// exercises JSON: Array<{ title: string; prompt: string }>
export const coachingLessons = sqliteTable(
  "CoachingLesson",
  {
    id: text("id").primaryKey().default(cuid()),
    programId: text("programId").notNull().references(() => coachingPrograms.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    durationMin: integer("durationMin").notNull().default(45),
    exercises: text("exercises").notNull().default("[]"),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  },
  (t) => ({ programOrder: index("CoachingLesson_programId_order_idx").on(t.programId, t.order) })
);

// status: ACTIVE | PAUSED | COMPLETED
// Clients are external (no Quorum login required) — coach owns the relationship
export const coachingClients = sqliteTable("CoachingClient", {
  id: text("id").primaryKey().default(cuid()),
  ownerId: text("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  programId: text("programId").references(() => coachingPrograms.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email"),
  company: text("company"),
  role: text("role"), // e.g. "Founder & CEO"
  status: text("status").notNull().default("ACTIVE"),
  startDate: integer("startDate", { mode: "timestamp" }),
  notes: text("notes"),
  portalToken: text("portalToken").unique(),  // public token for /c/[token] read-only portal
  portalEnabled: integer("portalEnabled", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

// status: ASSIGNED | IN_PROGRESS | COMPLETED | SKIPPED
export const lessonAssignments = sqliteTable(
  "LessonAssignment",
  {
    id: text("id").primaryKey().default(cuid()),
    lessonId: text("lessonId").notNull().references(() => coachingLessons.id, { onDelete: "cascade" }),
    clientId: text("clientId").notNull().references(() => coachingClients.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("ASSIGNED"),
    assignedAt: integer("assignedAt", { mode: "timestamp" }).notNull().default(now()),
    completedAt: integer("completedAt", { mode: "timestamp" }),
    notes: text("notes"),
  },
  (t) => ({ lc: uniqueIndex("LessonAssignment_lessonId_clientId_key").on(t.lessonId, t.clientId) })
);

// Coach session log: 1:1 meeting notes per client
export const coachingSessions = sqliteTable("CoachingSession", {
  id: text("id").primaryKey().default(cuid()),
  clientId: text("clientId").notNull().references(() => coachingClients.id, { onDelete: "cascade" }),
  ownerId: text("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionDate: integer("sessionDate", { mode: "timestamp" }).notNull(),
  durationMin: integer("durationMin").notNull().default(60),
  topic: text("topic"),
  notes: text("notes"),
  followUps: text("followUps"),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
});

// -------- Retreats / team building --------

// kind: ICEBREAKER | TRUST | STRATEGIC | TEAM_SKILL | LEADERSHIP | REFLECTION
// isGlobal=true means it's part of the canned library available to everyone
export const retreatActivities = sqliteTable("RetreatActivity", {
  id: text("id").primaryKey().default(cuid()),
  organizationId: text("organizationId").references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind").notNull().default("TEAM_SKILL"),
  description: text("description"),
  durationMin: integer("durationMin").notNull().default(30),
  groupSizeMin: integer("groupSizeMin").notNull().default(2),
  groupSizeMax: integer("groupSizeMax").notNull().default(50),
  instructions: text("instructions").notNull().default(""),
  materials: text("materials"),
  learningObjectives: text("learningObjectives"),
  isGlobal: integer("isGlobal", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
});

// status: PLANNING | IN_PROGRESS | COMPLETED | CANCELLED
export const retreats = sqliteTable("Retreat", {
  id: text("id").primaryKey().default(cuid()),
  organizationId: text("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  organizerId: text("organizerId").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startDate: integer("startDate", { mode: "timestamp" }).notNull(),
  endDate: integer("endDate", { mode: "timestamp" }).notNull(),
  status: text("status").notNull().default("PLANNING"),
  intakeToken: text("intakeToken").unique(),  // public token for /r/[token] intake form
  intakeOpen: integer("intakeOpen", { mode: "boolean" }).notNull().default(true),
  philosophy: text("philosophy"),  // freeform "principles / day at a glance" content (markdown)
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

// A reusable "blueprint" for a full retreat (run-of-show + philosophy + intake schema)
// agenda JSON: Array<{ title, description, durationMin, activityKey?, facilitatorRole? }>
// intakeSchema JSON: Array<{ id, label, kind: 'short'|'long'|'likert'|'select'|'rank'|'multiselect'|'tracks', options?, required? }>
export const retreatTemplates = sqliteTable("RetreatTemplate", {
  id: text("id").primaryKey().default(cuid()),
  organizationId: text("organizationId").references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tagline: text("tagline"),
  philosophy: text("philosophy").notNull().default(""),
  agenda: text("agenda").notNull().default("[]"),
  intakeSchema: text("intakeSchema").notNull().default("[]"),
  isGlobal: integer("isGlobal", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull().default(now()),
});

// One submission to a retreat's intake form
// answers JSON: Record<sectionId, value>
export const retreatIntakeResponses = sqliteTable("RetreatIntakeResponse", {
  id: text("id").primaryKey().default(cuid()),
  retreatId: text("retreatId").notNull().references(() => retreats.id, { onDelete: "cascade" }),
  participantName: text("participantName").notNull(),
  participantEmail: text("participantEmail"),
  participantRole: text("participantRole"),
  answers: text("answers").notNull().default("{}"),
  submittedAt: integer("submittedAt", { mode: "timestamp" }).notNull().default(now()),
});

export const retreatAgendaItems = sqliteTable(
  "RetreatAgendaItem",
  {
    id: text("id").primaryKey().default(cuid()),
    retreatId: text("retreatId").notNull().references(() => retreats.id, { onDelete: "cascade" }),
    activityId: text("activityId").references(() => retreatActivities.id, { onDelete: "set null" }),
    order: integer("order").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    scheduledAt: integer("scheduledAt", { mode: "timestamp" }),
    durationMin: integer("durationMin").notNull().default(30),
    facilitatorName: text("facilitatorName"),
  },
  (t) => ({ retreatOrder: index("RetreatAgendaItem_retreatId_order_idx").on(t.retreatId, t.order) })
);

export const retreatTakeaways = sqliteTable("RetreatTakeaway", {
  id: text("id").primaryKey().default(cuid()),
  retreatId: text("retreatId").notNull().references(() => retreats.id, { onDelete: "cascade" }),
  authorId: text("authorId").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull().default(now()),
});

// -------- Relations for new tables --------

export const reportTemplatesRelations = relations(reportTemplates, ({ one, many }) => ({
  organization: one(organizations, { fields: [reportTemplates.organizationId], references: [organizations.id] }),
  reports: many(reports),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  organization: one(organizations, { fields: [reports.organizationId], references: [organizations.id] }),
  template: one(reportTemplates, { fields: [reports.templateId], references: [reportTemplates.id] }),
  meeting: one(meetings, { fields: [reports.meetingId], references: [meetings.id] }),
  author: one(users, { fields: [reports.authorId], references: [users.id] }),
}));

export const financialPlansRelations = relations(financialPlans, ({ one, many }) => ({
  organization: one(organizations, { fields: [financialPlans.organizationId], references: [organizations.id] }),
  scenarios: many(financialScenarios),
}));

export const financialScenariosRelations = relations(financialScenarios, ({ one }) => ({
  plan: one(financialPlans, { fields: [financialScenarios.planId], references: [financialPlans.id] }),
}));

export const coachingProgramsRelations = relations(coachingPrograms, ({ one, many }) => ({
  owner: one(users, { fields: [coachingPrograms.ownerId], references: [users.id] }),
  lessons: many(coachingLessons),
  clients: many(coachingClients),
}));

export const coachingLessonsRelations = relations(coachingLessons, ({ one, many }) => ({
  program: one(coachingPrograms, { fields: [coachingLessons.programId], references: [coachingPrograms.id] }),
  assignments: many(lessonAssignments),
}));

export const coachingClientsRelations = relations(coachingClients, ({ one, many }) => ({
  owner: one(users, { fields: [coachingClients.ownerId], references: [users.id] }),
  program: one(coachingPrograms, { fields: [coachingClients.programId], references: [coachingPrograms.id] }),
  assignments: many(lessonAssignments),
  sessions: many(coachingSessions),
}));

export const lessonAssignmentsRelations = relations(lessonAssignments, ({ one }) => ({
  lesson: one(coachingLessons, { fields: [lessonAssignments.lessonId], references: [coachingLessons.id] }),
  client: one(coachingClients, { fields: [lessonAssignments.clientId], references: [coachingClients.id] }),
}));

export const coachingSessionsRelations = relations(coachingSessions, ({ one }) => ({
  client: one(coachingClients, { fields: [coachingSessions.clientId], references: [coachingClients.id] }),
  owner: one(users, { fields: [coachingSessions.ownerId], references: [users.id] }),
}));

export const retreatsRelations = relations(retreats, ({ one, many }) => ({
  organization: one(organizations, { fields: [retreats.organizationId], references: [organizations.id] }),
  organizer: one(users, { fields: [retreats.organizerId], references: [users.id] }),
  agenda: many(retreatAgendaItems),
  takeaways: many(retreatTakeaways),
}));

export const retreatActivitiesRelations = relations(retreatActivities, ({ one, many }) => ({
  organization: one(organizations, { fields: [retreatActivities.organizationId], references: [organizations.id] }),
  agendaItems: many(retreatAgendaItems),
}));

export const retreatAgendaItemsRelations = relations(retreatAgendaItems, ({ one }) => ({
  retreat: one(retreats, { fields: [retreatAgendaItems.retreatId], references: [retreats.id] }),
  activity: one(retreatActivities, { fields: [retreatAgendaItems.activityId], references: [retreatActivities.id] }),
}));

export const retreatTakeawaysRelations = relations(retreatTakeaways, ({ one }) => ({
  retreat: one(retreats, { fields: [retreatTakeaways.retreatId], references: [retreats.id] }),
  author: one(users, { fields: [retreatTakeaways.authorId], references: [users.id] }),
}));

export const retreatTemplatesRelations = relations(retreatTemplates, ({ one }) => ({
  organization: one(organizations, { fields: [retreatTemplates.organizationId], references: [organizations.id] }),
}));

export const retreatIntakeResponsesRelations = relations(retreatIntakeResponses, ({ one }) => ({
  retreat: one(retreats, { fields: [retreatIntakeResponses.retreatId], references: [retreats.id] }),
}));

// Inferred types for convenience
export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type AgendaItem = typeof agendaItems.$inferSelect;
export type Attendance = typeof attendances.$inferSelect;
export type Resolution = typeof resolutions.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type ActionItem = typeof actionItems.$inferSelect;
export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type FinancialPlan = typeof financialPlans.$inferSelect;
export type FinancialScenario = typeof financialScenarios.$inferSelect;
export type FinancialSnapshot = typeof financialSnapshots.$inferSelect;
export type FinancialDocument = typeof financialDocuments.$inferSelect;
export type CoachingProgram = typeof coachingPrograms.$inferSelect;
export type CoachingLesson = typeof coachingLessons.$inferSelect;
export type CoachingClient = typeof coachingClients.$inferSelect;
export type LessonAssignment = typeof lessonAssignments.$inferSelect;
export type CoachingSession = typeof coachingSessions.$inferSelect;
export type Retreat = typeof retreats.$inferSelect;
export type RetreatActivity = typeof retreatActivities.$inferSelect;
export type RetreatAgendaItem = typeof retreatAgendaItems.$inferSelect;
export type RetreatTakeaway = typeof retreatTakeaways.$inferSelect;
export type RetreatTemplate = typeof retreatTemplates.$inferSelect;
export type RetreatIntakeResponse = typeof retreatIntakeResponses.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
