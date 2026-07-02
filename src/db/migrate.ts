// Apply every .sql file under drizzle/pg/ to the database in lexical order.
//
// Detects the backend from DATABASE_URL:
//   - postgres:// / postgresql://  → postgres-js (Supabase, prod)
//   - unset / anything else        → PGlite under ./data/pglite (local dev)
//
// Idempotent: "already exists" errors are tolerated so re-runs are safe.

import fs from "node:fs";
import path from "node:path";

function isIdempotentError(msg: string): boolean {
  return /already exists|duplicate/i.test(msg);
}

function extractStatements(file: string): string[] {
  const sql = fs.readFileSync(file, "utf8");
  return sql
    .split(/-->\s*statement-breakpoint/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const url = process.env.DATABASE_URL;
  const isPg = !!url && (url.startsWith("postgres://") || url.startsWith("postgresql://"));

  let exec: (stmt: string) => Promise<void>;
  let close: () => Promise<void>;

  if (isPg) {
    const postgres = (await import("postgres")).default;
    const client = postgres(url!, { prepare: false, max: 1 });
    exec = async (stmt) => {
      await client.unsafe(stmt);
    };
    close = async () => {
      await client.end();
    };
    console.log("Applying migrations to Postgres…");
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const client = new PGlite(process.env.PGLITE_DIR ?? "./data/pglite");
    exec = async (stmt) => {
      await client.exec(stmt);
    };
    close = async () => {
      await client.close();
    };
    console.log("Applying migrations to local PGlite…");
  }

  const dir = path.join(process.cwd(), "drizzle", "pg");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const statements = extractStatements(path.join(dir, file));
    let applied = 0;
    let skipped = 0;
    for (const stmt of statements) {
      try {
        await exec(stmt);
        applied++;
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        if (isIdempotentError(msg)) {
          skipped++;
          continue;
        }
        console.error(`\n✗ ${file}:\n${stmt.slice(0, 200)}\n→ ${msg}`);
        await close();
        process.exit(1);
      }
    }
    console.log(`  ✓ ${file} (${applied} applied${skipped ? `, ${skipped} already present` : ""})`);
  }

  console.log("Done.");
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
