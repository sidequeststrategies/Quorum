ALTER TABLE "board"."Report" ADD COLUMN IF NOT EXISTS "notionPageId" text;
--> statement-breakpoint
ALTER TABLE "board"."Report" ADD COLUMN IF NOT EXISTS "notionSyncedAt" timestamp with time zone;
