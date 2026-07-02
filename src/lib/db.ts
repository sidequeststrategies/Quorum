/**
 * Postgres adapter for Quorum.
 *
 * Picks the backend at startup based on DATABASE_URL:
 *   - "postgres://..." / "postgresql://..." → postgres-js (Supabase in production)
 *   - unset / anything else                 → PGlite, an embedded Postgres stored
 *     under data/pglite/ (local dev and demo instances — no services needed)
 *
 * All tables live in the "board" Postgres schema (see src/db/schema.ts), so a
 * shared Supabase project (e.g. alongside the todo app) is safe: nothing in
 * "public" is touched, and the board schema is not exposed via Supabase's
 * REST API unless explicitly added.
 *
 * For Supabase, use the *pooler* connection string (Project Settings →
 * Database → Connection string → Transaction mode). prepare:false makes
 * postgres-js compatible with PgBouncer's transaction pooling.
 */

import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzleLite } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";

// Both backends speak the same drizzle pg-core dialect; we expose the
// postgres-js type as the canonical one.
export type Db = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __qDb?: Db };

export function isPostgresUrl(url: string | undefined): url is string {
  return !!url && (url.startsWith("postgres://") || url.startsWith("postgresql://"));
}

function makeDb(): Db {
  const url = process.env.DATABASE_URL;
  if (isPostgresUrl(url)) {
    const client = postgres(url, { prepare: false, max: 10 });
    return drizzlePg(client, { schema });
  }
  const dataDir = process.env.PGLITE_DIR ?? "./data/pglite";
  const client = new PGlite(dataDir);
  return drizzleLite(client, { schema }) as unknown as Db;
}

export const db: Db = globalForDb.__qDb ?? makeDb();
if (process.env.NODE_ENV !== "production") globalForDb.__qDb = db;

export { schema };
