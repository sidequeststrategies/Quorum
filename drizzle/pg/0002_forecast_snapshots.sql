CREATE TABLE "board"."ForecastSnapshot" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"meetingId" text NOT NULL,
	"name" text DEFAULT 'Base case' NOT NULL,
	"sourceScenarioId" text,
	"assumptions" text NOT NULL,
	"startingCash" integer DEFAULT 0 NOT NULL,
	"startMonth" timestamp with time zone NOT NULL,
	"horizonMonths" integer DEFAULT 24 NOT NULL,
	"runwayMonths" integer,
	"endingArr" integer DEFAULT 0 NOT NULL,
	"endingCash" integer DEFAULT 0 NOT NULL,
	"breakevenMonth" integer,
	"createdById" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ForecastSnapshot_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "ForecastSnapshot_meetingId_Meeting_id_fk" FOREIGN KEY ("meetingId") REFERENCES "board"."Meeting"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "ForecastSnapshot_sourceScenarioId_FinancialScenario_id_fk" FOREIGN KEY ("sourceScenarioId") REFERENCES "board"."FinancialScenario"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "ForecastSnapshot_createdById_User_id_fk" FOREIGN KEY ("createdById") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ForecastSnapshot_meetingId_name_key" ON "board"."ForecastSnapshot" ("meetingId","name");
