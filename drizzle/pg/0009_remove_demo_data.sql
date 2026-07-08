-- Remove seeded demo data from any environment this runs against, and keep
-- it out: migrations run on every production deploy, so demo-pattern rows
-- can never survive in prod even if a seed is run by mistake.
--
-- Targets are exact seed identifiers (src/db/seed.ts): the three fictional
-- companies by slug, and users on the seed-only *.demo email domains.
-- Organization deletes cascade to all org-scoped rows; demo users only
-- reference demo-org rows, so deleting orgs first satisfies the NO ACTION
-- user FKs (createdById, uploadedById, ...).
DELETE FROM "board"."Organization" WHERE "slug" IN ('acme-robotics', 'northstar-grid', 'harbor-logics');
--> statement-breakpoint
DELETE FROM "board"."User" WHERE "email" LIKE '%@sidequest.demo' OR "email" LIKE '%@acme.demo' OR "email" LIKE '%@northstar.demo' OR "email" LIKE '%@harbor.demo';
