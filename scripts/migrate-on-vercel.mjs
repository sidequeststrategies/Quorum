// Run DB migrations automatically during Vercel production builds.
//
// The build environment holds DATABASE_URL (even though it's a Sensitive
// var no human can read back), so schema changes ship with the deploy that
// needs them — no manual migration step. Idempotent (migrate.ts tolerates
// "already exists"), and a failed migration fails the build, so a deploy
// can never go live against a schema it doesn't match.
//
// Skipped outside Vercel production (local builds, preview deploys) — those
// environments either use PGlite or must not touch the production schema.

import { spawnSync } from "node:child_process";

const isVercelProd = process.env.VERCEL_ENV === "production";
const url = process.env.DATABASE_URL ?? "";
const isPg = url.startsWith("postgres://") || url.startsWith("postgresql://");

if (!isVercelProd || !isPg) {
  console.log(`[migrate-on-vercel] skipped (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}, postgres=${isPg})`);
  process.exit(0);
}

console.log("[migrate-on-vercel] applying migrations to production…");
const r = spawnSync("npx", ["tsx", "src/db/migrate.ts"], { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
