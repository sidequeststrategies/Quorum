CREATE TABLE "board"."FinancialReport" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"period" timestamp with time zone NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"sourceDocumentId" text,
	"notes" text,
	"createdById" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."FinancialForecastValue" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"reportId" text NOT NULL,
	"organizationId" text NOT NULL,
	"field" text NOT NULL,
	"targetPeriod" timestamp with time zone NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."FunnelSnapshot" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"reportId" text,
	"period" timestamp with time zone NOT NULL,
	"stage" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board"."FinancialReport" ADD CONSTRAINT "FinancialReport_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board"."FinancialReport" ADD CONSTRAINT "FinancialReport_sourceDocumentId_FinancialDocument_id_fk" FOREIGN KEY ("sourceDocumentId") REFERENCES "board"."FinancialDocument"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board"."FinancialReport" ADD CONSTRAINT "FinancialReport_createdById_User_id_fk" FOREIGN KEY ("createdById") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board"."FinancialForecastValue" ADD CONSTRAINT "FinancialForecastValue_reportId_FinancialReport_id_fk" FOREIGN KEY ("reportId") REFERENCES "board"."FinancialReport"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board"."FinancialForecastValue" ADD CONSTRAINT "FinancialForecastValue_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board"."FunnelSnapshot" ADD CONSTRAINT "FunnelSnapshot_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board"."FunnelSnapshot" ADD CONSTRAINT "FunnelSnapshot_reportId_FinancialReport_id_fk" FOREIGN KEY ("reportId") REFERENCES "board"."FinancialReport"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "FinancialReport_organizationId_period_key" ON "board"."FinancialReport" ("organizationId","period");
--> statement-breakpoint
CREATE UNIQUE INDEX "FinancialForecastValue_reportId_field_targetPeriod_key" ON "board"."FinancialForecastValue" ("reportId","field","targetPeriod");
--> statement-breakpoint
CREATE INDEX "FinancialForecastValue_organizationId_field_idx" ON "board"."FinancialForecastValue" ("organizationId","field");
--> statement-breakpoint
CREATE UNIQUE INDEX "FunnelSnapshot_organizationId_period_stage_key" ON "board"."FunnelSnapshot" ("organizationId","period","stage");
