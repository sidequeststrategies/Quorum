CREATE TABLE "board"."FileBlob" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"filename" text NOT NULL,
	"mimeType" text NOT NULL,
	"sizeBytes" integer NOT NULL,
	"data" bytea NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board"."AccessLog" (
	"id" text PRIMARY KEY DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
	"organizationId" text NOT NULL,
	"userId" text,
	"action" text NOT NULL,
	"resource" text,
	"resourceId" text,
	"detail" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "board"."FileBlob" ADD CONSTRAINT "FileBlob_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board"."AccessLog" ADD CONSTRAINT "AccessLog_organizationId_Organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "board"."Organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board"."AccessLog" ADD CONSTRAINT "AccessLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "board"."User"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "FileBlob_organizationId_idx" ON "board"."FileBlob" ("organizationId");
--> statement-breakpoint
CREATE INDEX "AccessLog_organizationId_createdAt_idx" ON "board"."AccessLog" ("organizationId","createdAt");
