// Apply every .sql file under drizzle/ to the database in lexical order.
// Used in place of drizzle-kit push because drizzle-kit's runtime relies on
// better-sqlite3, which has no win32-arm64 prebuilt.
//
// Detects the backend from DATABASE_URL:
//   - file:... (or no scheme)         → node:sqlite (local)
//   - libsql:// / https:// / http://  → @libsql/client/web (Turso, prod)
//
// Both code paths share the same statement-splitter and the same idempotent-
// error tolerance.

import fs from "node:fs";
import path from "node:path";

type SqlExec = (stmt: string) => Promise<void>;

function isIdempotentError(msg: string): boolean {
  return (
    msg.includes("already exists") ||
    msg.includes("duplicate column name") ||
    msg.includes("table already exists")
  );
}

function extractStatements(file: string): string[] {
  const sql = fs.readFileSync(file, "utf8");
  return sql
    .split(/-->\s*statement-breakpoint/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/quorum.db";
  const lower = url.toLowerCase();
  const isLibsql =
    lower.startsWith("libsql://") || lower.startsWith("https://") || lower.startsWith("http://");

  let exec: SqlExec;
  let close: () => Promise<void>;

  if (isLibsql) {
    const { createClient } = await import("@libsql/client/web");
    const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
    exec = async (stmt) => {
      await client.execute(stmt);
    };
    close = async () => {
      // libsql HTTP client doesn't need explicit close
    };
    console.log(`Applying migrations to libsql at ${url} ...`);
  } else {
    const filename = url.replace(/^file:/, "");
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const { DatabaseSync } = await import("node:sqlite");
    const db = new DatabaseSync(filename);
    db.exec("PRAGMA foreign_keys = ON;");
    exec = async (stmt) => {
      db.exec(stmt);
    };
    close = async () => {
      db.close();
    };
    console.log(`Applying migrations to ${filename} ...`);
  }

  const migrationsDir = path.join(process.cwd(), "drizzle");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    for (const stmt of extractStatements(path.join(migrationsDir, file))) {
      try {
        await exec(stmt);
      } catch (e) {
        const msg = String(e);
        if (isIdempotentError(msg)) continue;
        console.error(`Failed in ${file}:`, msg);
        throw e;
      }
    }
    console.log(`  ✓ ${file}`);
  }

  await close();
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
