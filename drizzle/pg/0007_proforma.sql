CREATE TABLE "board"."ProFormaModel" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"name" text NOT NULL,
	"vintage" timestamp with time zone NOT NULL,
	"sourceDocumentId" text,
	"baselineJson" text NOT NULL,
	"createdById" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board"."ProFormaModel" ADD CONSTRAINT "ProFormaModel_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board"."ProFormaModel" ADD CONSTRAINT "ProFormaModel_sourceDocumentId_FinancialDocument_id_fk" FOREIGN KEY ("sourceDocumentId") REFERENCES "board"."FinancialDocument"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board"."ProFormaModel" ADD CONSTRAINT "ProFormaModel_createdById_User_id_fk" FOREIGN KEY ("createdById") REFERENCES "board"."User"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "ProFormaModel_organizationId_createdAt_idx" ON "board"."ProFormaModel" ("organizationId","createdAt");
