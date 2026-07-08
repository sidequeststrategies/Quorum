ALTER TABLE "board"."FunnelSnapshot" ADD COLUMN "source" text DEFAULT 'excel' NOT NULL;
--> statement-breakpoint
CREATE TABLE "board"."FunnelStageMetric" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"stage" text NOT NULL,
	"avgDaysInStage" real,
	"avgOpenAgeDays" real,
	"completedCount" integer DEFAULT 0 NOT NULL,
	"openCount" integer DEFAULT 0 NOT NULL,
	"syncedAt" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board"."FunnelStageMetric" ADD CONSTRAINT "FunnelStageMetric_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "FunnelStageMetric_organizationId_stage_key" ON "board"."FunnelStageMetric" ("organizationId","stage");
