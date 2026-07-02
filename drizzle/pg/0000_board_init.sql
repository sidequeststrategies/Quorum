CREATE SCHEMA "board";
--> statement-breakpoint
CREATE TABLE "board"."Account" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "board"."ActionItem" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"meetingId" text,
	"assigneeId" text,
	"title" text NOT NULL,
	"description" text,
	"dueDate" timestamp with time zone,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."AgendaItem" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"meetingId" text NOT NULL,
	"order" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"durationMin" integer DEFAULT 10 NOT NULL,
	"presenterId" text
);
--> statement-breakpoint
CREATE TABLE "board"."Attendance" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"meetingId" text NOT NULL,
	"userId" text NOT NULL,
	"status" text DEFAULT 'INVITED' NOT NULL,
	"respondedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "board"."ChatMessage" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"threadId" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."ChatThread" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."CoachingClient" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"ownerId" text NOT NULL,
	"programId" text,
	"name" text NOT NULL,
	"email" text,
	"company" text,
	"role" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"startDate" timestamp with time zone,
	"notes" text,
	"portalToken" text,
	"portalEnabled" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CoachingClient_portalToken_unique" UNIQUE("portalToken")
);
--> statement-breakpoint
CREATE TABLE "board"."CoachingLesson" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"programId" text NOT NULL,
	"order" integer NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"durationMin" integer DEFAULT 45 NOT NULL,
	"exercises" text DEFAULT '[]' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."CoachingProgram" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"ownerId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" text DEFAULT 'FOUNDER' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."CoachingSession" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"clientId" text NOT NULL,
	"ownerId" text NOT NULL,
	"sessionDate" timestamp with time zone NOT NULL,
	"durationMin" integer DEFAULT 60 NOT NULL,
	"topic" text,
	"notes" text,
	"followUps" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."CustomerUpdate" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"customerId" text NOT NULL,
	"period" timestamp with time zone NOT NULL,
	"health" text DEFAULT 'GREEN' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"authorId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."Customer" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"segment" text,
	"region" text,
	"arr" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"ownerId" text,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."Document" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"meetingId" text,
	"uploadedById" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"filename" text NOT NULL,
	"mimeType" text NOT NULL,
	"sizeBytes" integer NOT NULL,
	"storagePath" text NOT NULL,
	"visibility" text DEFAULT 'ALL_MEMBERS' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."FinancialDocument" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"snapshotId" text,
	"period" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"filename" text NOT NULL,
	"mimeType" text NOT NULL,
	"sizeBytes" integer NOT NULL,
	"storagePath" text NOT NULL,
	"uploadedById" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."FinancialPlan" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"horizonMonths" integer DEFAULT 24 NOT NULL,
	"startingCash" integer DEFAULT 0 NOT NULL,
	"startMonth" timestamp with time zone NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."FinancialScenario" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"planId" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'CUSTOM' NOT NULL,
	"assumptions" text NOT NULL,
	"notes" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."FinancialSnapshot" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"period" timestamp with time zone NOT NULL,
	"cash" integer DEFAULT 0 NOT NULL,
	"arr" integer DEFAULT 0 NOT NULL,
	"mrr" integer DEFAULT 0 NOT NULL,
	"revenue" integer DEFAULT 0 NOT NULL,
	"grossMargin" integer DEFAULT 0 NOT NULL,
	"burn" integer DEFAULT 0 NOT NULL,
	"headcount" integer DEFAULT 0 NOT NULL,
	"accountsReceivable" integer DEFAULT 0 NOT NULL,
	"accountsPayable" integer DEFAULT 0 NOT NULL,
	"metricsJson" text DEFAULT '{}' NOT NULL,
	"notes" text,
	"createdById" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."GtmUpdate" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"period" timestamp with time zone NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"pipelineValue" integer DEFAULT 0 NOT NULL,
	"qualifiedLeads" integer DEFAULT 0 NOT NULL,
	"newWins" integer DEFAULT 0 NOT NULL,
	"lostDeals" integer DEFAULT 0 NOT NULL,
	"newArr" integer DEFAULT 0 NOT NULL,
	"metricsJson" text DEFAULT '{}' NOT NULL,
	"authorId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."LessonAssignment" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"lessonId" text NOT NULL,
	"clientId" text NOT NULL,
	"status" text DEFAULT 'ASSIGNED' NOT NULL,
	"assignedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"completedAt" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "board"."Meeting" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'REGULAR' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"scheduledAt" timestamp with time zone NOT NULL,
	"durationMin" integer DEFAULT 60 NOT NULL,
	"location" text,
	"videoUrl" text,
	"notes" text,
	"minutes" text,
	"quorumRequired" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."Membership" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"userId" text NOT NULL,
	"organizationId" text NOT NULL,
	"role" text DEFAULT 'DIRECTOR' NOT NULL,
	"title" text,
	"organizationLabel" text,
	"votingRights" boolean DEFAULT true NOT NULL,
	"termStart" timestamp with time zone,
	"termEnd" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."Organization" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"legalName" text,
	"jurisdiction" text,
	"logoUrl" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "board"."ProjectMilestone" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"projectId" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"title" text NOT NULL,
	"dueDate" timestamp with time zone,
	"status" text DEFAULT 'PLANNED' NOT NULL,
	"completedAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "board"."ProjectUpdate" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"projectId" text NOT NULL,
	"period" timestamp with time zone NOT NULL,
	"headline" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'ON_TRACK' NOT NULL,
	"authorId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."Project" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"summary" text,
	"status" text DEFAULT 'ON_TRACK' NOT NULL,
	"ownerId" text,
	"startDate" timestamp with time zone,
	"targetDate" timestamp with time zone,
	"completedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."ReportTemplate" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text,
	"name" text NOT NULL,
	"description" text,
	"sections" text NOT NULL,
	"isGlobal" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."Report" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"templateId" text,
	"meetingId" text,
	"authorId" text NOT NULL,
	"title" text NOT NULL,
	"values" text DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"boardPackDocumentId" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."Resolution" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"meetingId" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"kind" text DEFAULT 'MEETING_VOTE' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"requiresUnanimous" boolean DEFAULT false NOT NULL,
	"openedAt" timestamp with time zone,
	"closedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."RetreatActivity" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text,
	"title" text NOT NULL,
	"kind" text DEFAULT 'TEAM_SKILL' NOT NULL,
	"description" text,
	"durationMin" integer DEFAULT 30 NOT NULL,
	"groupSizeMin" integer DEFAULT 2 NOT NULL,
	"groupSizeMax" integer DEFAULT 50 NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"materials" text,
	"learningObjectives" text,
	"isGlobal" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."RetreatAgendaItem" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"retreatId" text NOT NULL,
	"activityId" text,
	"order" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"scheduledAt" timestamp with time zone,
	"durationMin" integer DEFAULT 30 NOT NULL,
	"facilitatorName" text
);
--> statement-breakpoint
CREATE TABLE "board"."RetreatIntakeResponse" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"retreatId" text NOT NULL,
	"participantName" text NOT NULL,
	"participantEmail" text,
	"participantRole" text,
	"answers" text DEFAULT '{}' NOT NULL,
	"submittedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."RetreatTakeaway" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"retreatId" text NOT NULL,
	"authorId" text NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."RetreatTemplate" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text,
	"name" text NOT NULL,
	"tagline" text,
	"philosophy" text DEFAULT '' NOT NULL,
	"agenda" text DEFAULT '[]' NOT NULL,
	"intakeSchema" text DEFAULT '[]' NOT NULL,
	"isGlobal" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."Retreat" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"organizerId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"startDate" timestamp with time zone NOT NULL,
	"endDate" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'PLANNING' NOT NULL,
	"intakeToken" text,
	"intakeOpen" boolean DEFAULT true NOT NULL,
	"philosophy" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Retreat_intakeToken_unique" UNIQUE("intakeToken")
);
--> statement-breakpoint
CREATE TABLE "board"."RiskReview" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"riskId" text NOT NULL,
	"meetingId" text,
	"likelihood" integer NOT NULL,
	"impact" integer NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"reviewedById" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."Risk" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text DEFAULT 'OPERATIONAL' NOT NULL,
	"likelihood" integer DEFAULT 3 NOT NULL,
	"impact" integer DEFAULT 3 NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"ownerId" text,
	"mitigation" text,
	"closedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."Session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."TeamUpdate" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"period" timestamp with time zone NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"hires" text,
	"departures" text,
	"openRoles" text,
	"headcount" integer,
	"authorId" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."User" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"passwordHash" text,
	"emailVerified" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "board"."VerificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "VerificationToken_identifier_token_pk" PRIMARY KEY("identifier","token"),
	CONSTRAINT "VerificationToken_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "board"."Vote" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"resolutionId" text NOT NULL,
	"userId" text NOT NULL,
	"choice" text NOT NULL,
	"comment" text,
	"castAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board"."Account" ADD CONSTRAINT "Account_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "board"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."ActionItem" ADD CONSTRAINT "ActionItem_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."ActionItem" ADD CONSTRAINT "ActionItem_meetingId_Meeting_id_fk" FOREIGN KEY ("meetingId") REFERENCES "board"."Meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."ActionItem" ADD CONSTRAINT "ActionItem_assigneeId_User_id_fk" FOREIGN KEY ("assigneeId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."AgendaItem" ADD CONSTRAINT "AgendaItem_meetingId_Meeting_id_fk" FOREIGN KEY ("meetingId") REFERENCES "board"."Meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."AgendaItem" ADD CONSTRAINT "AgendaItem_presenterId_User_id_fk" FOREIGN KEY ("presenterId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Attendance" ADD CONSTRAINT "Attendance_meetingId_Meeting_id_fk" FOREIGN KEY ("meetingId") REFERENCES "board"."Meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Attendance" ADD CONSTRAINT "Attendance_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "board"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_ChatThread_id_fk" FOREIGN KEY ("threadId") REFERENCES "board"."ChatThread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."ChatThread" ADD CONSTRAINT "ChatThread_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."ChatThread" ADD CONSTRAINT "ChatThread_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "board"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."CoachingClient" ADD CONSTRAINT "CoachingClient_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "board"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."CoachingClient" ADD CONSTRAINT "CoachingClient_programId_CoachingProgram_id_fk" FOREIGN KEY ("programId") REFERENCES "board"."CoachingProgram"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."CoachingLesson" ADD CONSTRAINT "CoachingLesson_programId_CoachingProgram_id_fk" FOREIGN KEY ("programId") REFERENCES "board"."CoachingProgram"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."CoachingProgram" ADD CONSTRAINT "CoachingProgram_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "board"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."CoachingSession" ADD CONSTRAINT "CoachingSession_clientId_CoachingClient_id_fk" FOREIGN KEY ("clientId") REFERENCES "board"."CoachingClient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."CoachingSession" ADD CONSTRAINT "CoachingSession_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "board"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."CustomerUpdate" ADD CONSTRAINT "CustomerUpdate_customerId_Customer_id_fk" FOREIGN KEY ("customerId") REFERENCES "board"."Customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."CustomerUpdate" ADD CONSTRAINT "CustomerUpdate_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Customer" ADD CONSTRAINT "Customer_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Customer" ADD CONSTRAINT "Customer_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Document" ADD CONSTRAINT "Document_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Document" ADD CONSTRAINT "Document_meetingId_Meeting_id_fk" FOREIGN KEY ("meetingId") REFERENCES "board"."Meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Document" ADD CONSTRAINT "Document_uploadedById_User_id_fk" FOREIGN KEY ("uploadedById") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."FinancialDocument" ADD CONSTRAINT "FinancialDocument_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."FinancialDocument" ADD CONSTRAINT "FinancialDocument_snapshotId_FinancialSnapshot_id_fk" FOREIGN KEY ("snapshotId") REFERENCES "board"."FinancialSnapshot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."FinancialDocument" ADD CONSTRAINT "FinancialDocument_uploadedById_User_id_fk" FOREIGN KEY ("uploadedById") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."FinancialPlan" ADD CONSTRAINT "FinancialPlan_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."FinancialScenario" ADD CONSTRAINT "FinancialScenario_planId_FinancialPlan_id_fk" FOREIGN KEY ("planId") REFERENCES "board"."FinancialPlan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."FinancialSnapshot" ADD CONSTRAINT "FinancialSnapshot_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."FinancialSnapshot" ADD CONSTRAINT "FinancialSnapshot_createdById_User_id_fk" FOREIGN KEY ("createdById") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."GtmUpdate" ADD CONSTRAINT "GtmUpdate_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."GtmUpdate" ADD CONSTRAINT "GtmUpdate_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."LessonAssignment" ADD CONSTRAINT "LessonAssignment_lessonId_CoachingLesson_id_fk" FOREIGN KEY ("lessonId") REFERENCES "board"."CoachingLesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."LessonAssignment" ADD CONSTRAINT "LessonAssignment_clientId_CoachingClient_id_fk" FOREIGN KEY ("clientId") REFERENCES "board"."CoachingClient"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Meeting" ADD CONSTRAINT "Meeting_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Membership" ADD CONSTRAINT "Membership_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "board"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Membership" ADD CONSTRAINT "Membership_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "board"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_projectId_Project_id_fk" FOREIGN KEY ("projectId") REFERENCES "board"."Project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Project" ADD CONSTRAINT "Project_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Project" ADD CONSTRAINT "Project_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."ReportTemplate" ADD CONSTRAINT "ReportTemplate_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Report" ADD CONSTRAINT "Report_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Report" ADD CONSTRAINT "Report_templateId_ReportTemplate_id_fk" FOREIGN KEY ("templateId") REFERENCES "board"."ReportTemplate"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Report" ADD CONSTRAINT "Report_meetingId_Meeting_id_fk" FOREIGN KEY ("meetingId") REFERENCES "board"."Meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Report" ADD CONSTRAINT "Report_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Resolution" ADD CONSTRAINT "Resolution_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Resolution" ADD CONSTRAINT "Resolution_meetingId_Meeting_id_fk" FOREIGN KEY ("meetingId") REFERENCES "board"."Meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."RetreatActivity" ADD CONSTRAINT "RetreatActivity_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."RetreatAgendaItem" ADD CONSTRAINT "RetreatAgendaItem_retreatId_Retreat_id_fk" FOREIGN KEY ("retreatId") REFERENCES "board"."Retreat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."RetreatAgendaItem" ADD CONSTRAINT "RetreatAgendaItem_activityId_RetreatActivity_id_fk" FOREIGN KEY ("activityId") REFERENCES "board"."RetreatActivity"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."RetreatIntakeResponse" ADD CONSTRAINT "RetreatIntakeResponse_retreatId_Retreat_id_fk" FOREIGN KEY ("retreatId") REFERENCES "board"."Retreat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."RetreatTakeaway" ADD CONSTRAINT "RetreatTakeaway_retreatId_Retreat_id_fk" FOREIGN KEY ("retreatId") REFERENCES "board"."Retreat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."RetreatTakeaway" ADD CONSTRAINT "RetreatTakeaway_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."RetreatTemplate" ADD CONSTRAINT "RetreatTemplate_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Retreat" ADD CONSTRAINT "Retreat_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Retreat" ADD CONSTRAINT "Retreat_organizerId_User_id_fk" FOREIGN KEY ("organizerId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."RiskReview" ADD CONSTRAINT "RiskReview_riskId_Risk_id_fk" FOREIGN KEY ("riskId") REFERENCES "board"."Risk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."RiskReview" ADD CONSTRAINT "RiskReview_meetingId_Meeting_id_fk" FOREIGN KEY ("meetingId") REFERENCES "board"."Meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."RiskReview" ADD CONSTRAINT "RiskReview_reviewedById_User_id_fk" FOREIGN KEY ("reviewedById") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Risk" ADD CONSTRAINT "Risk_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Risk" ADD CONSTRAINT "Risk_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Session" ADD CONSTRAINT "Session_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "board"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."TeamUpdate" ADD CONSTRAINT "TeamUpdate_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."TeamUpdate" ADD CONSTRAINT "TeamUpdate_authorId_User_id_fk" FOREIGN KEY ("authorId") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Vote" ADD CONSTRAINT "Vote_resolutionId_Resolution_id_fk" FOREIGN KEY ("resolutionId") REFERENCES "board"."Resolution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "board"."Vote" ADD CONSTRAINT "Vote_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "board"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "board"."Account" USING btree ("provider","providerAccountId");--> statement-breakpoint
CREATE INDEX "AgendaItem_meetingId_order_idx" ON "board"."AgendaItem" USING btree ("meetingId","order");--> statement-breakpoint
CREATE UNIQUE INDEX "Attendance_meetingId_userId_key" ON "board"."Attendance" USING btree ("meetingId","userId");--> statement-breakpoint
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "board"."ChatMessage" USING btree ("threadId","createdAt");--> statement-breakpoint
CREATE INDEX "CoachingLesson_programId_order_idx" ON "board"."CoachingLesson" USING btree ("programId","order");--> statement-breakpoint
CREATE UNIQUE INDEX "CustomerUpdate_customerId_period_key" ON "board"."CustomerUpdate" USING btree ("customerId","period");--> statement-breakpoint
CREATE INDEX "Customer_organizationId_status_idx" ON "board"."Customer" USING btree ("organizationId","status");--> statement-breakpoint
CREATE INDEX "Document_organizationId_meetingId_idx" ON "board"."Document" USING btree ("organizationId","meetingId");--> statement-breakpoint
CREATE INDEX "FinancialDocument_organizationId_kind_period_idx" ON "board"."FinancialDocument" USING btree ("organizationId","kind","period");--> statement-breakpoint
CREATE UNIQUE INDEX "FinancialSnapshot_organizationId_period_key" ON "board"."FinancialSnapshot" USING btree ("organizationId","period");--> statement-breakpoint
CREATE UNIQUE INDEX "GtmUpdate_organizationId_period_key" ON "board"."GtmUpdate" USING btree ("organizationId","period");--> statement-breakpoint
CREATE UNIQUE INDEX "LessonAssignment_lessonId_clientId_key" ON "board"."LessonAssignment" USING btree ("lessonId","clientId");--> statement-breakpoint
CREATE UNIQUE INDEX "Membership_userId_organizationId_key" ON "board"."Membership" USING btree ("userId","organizationId");--> statement-breakpoint
CREATE INDEX "ProjectMilestone_projectId_order_idx" ON "board"."ProjectMilestone" USING btree ("projectId","order");--> statement-breakpoint
CREATE UNIQUE INDEX "ProjectUpdate_projectId_period_key" ON "board"."ProjectUpdate" USING btree ("projectId","period");--> statement-breakpoint
CREATE INDEX "Project_organizationId_status_idx" ON "board"."Project" USING btree ("organizationId","status");--> statement-breakpoint
CREATE INDEX "RetreatAgendaItem_retreatId_order_idx" ON "board"."RetreatAgendaItem" USING btree ("retreatId","order");--> statement-breakpoint
CREATE INDEX "RiskReview_riskId_createdAt_idx" ON "board"."RiskReview" USING btree ("riskId","createdAt");--> statement-breakpoint
CREATE INDEX "Risk_organizationId_status_idx" ON "board"."Risk" USING btree ("organizationId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "TeamUpdate_organizationId_period_key" ON "board"."TeamUpdate" USING btree ("organizationId","period");--> statement-breakpoint
CREATE UNIQUE INDEX "Vote_resolutionId_userId_key" ON "board"."Vote" USING btree ("resolutionId","userId");