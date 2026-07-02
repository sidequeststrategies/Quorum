import type { Config } from "drizzle-kit";

// Postgres (Supabase in production, PGlite locally). Migrations live in
// drizzle/pg/; the legacy SQLite migrations in drizzle/*.sql are kept for
// history only and are no longer applied.
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle/pg",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost/quorum" },
} satisfies Config;
