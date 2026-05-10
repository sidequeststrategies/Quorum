/**
 * Dual-mode SQLite adapter for Quorum.
 *
 * Picks the backend at startup based on DATABASE_URL:
 *   - "file:..." or no scheme  → node:sqlite (local dev / single-instance hosts)
 *   - "libsql://..." / "https://..." / "http://..." → @libsql/client/web (Turso, serverless)
 *
 * Both backends are wired through Drizzle's sqlite-proxy adapter so the rest of
 * the app is identical. The two backends differ in how they return result rows;
 * we normalize to positional-value arrays before handing them to Drizzle.
 *
 * SECURITY: For libsql/Turso, also set DATABASE_AUTH_TOKEN. The HTTP client
 * sends it as a bearer token. Never commit it.
 */

import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "@/db/schema";

type ProxyMethod = "run" | "all" | "get" | "values";

interface Backend {
  run(sql: string, params: unknown[]): Promise<void>;
  query(sql: string, params: unknown[], method: ProxyMethod): Promise<unknown[][]>;
  beginTx(): Promise<void>;
  commitTx(): Promise<void>;
  rollbackTx(): Promise<void>;
}

const globalForDb = globalThis as unknown as {
  __qBackend?: Backend;
  __qDb?: ReturnType<typeof makeDb>;
};

// ─── SQL rewrite: alias every column in the outer SELECT list ──────────────
//
// Drizzle emits `select "Tbl"."id", ..., "OtherTbl"."id" from ...` on joins.
// node:sqlite returns row objects keyed by column name — duplicate keys
// collapse, silently dropping data and corrupting Drizzle's positional decoding.
// We rewrite each output column with a unique synthetic alias (`c_0, c_1, ...`)
// so every key is unique.
//
// libsql's HTTP client returns rows that ARE indexable, so this rewrite is
// not strictly needed there, but applying it uniformly is harmless and keeps
// the code path consistent.
function aliasOuterSelect(sql: string): string {
  const head = sql.match(/^\s*select\s+(distinct\s+)?/i);
  if (!head) return sql;
  const headLen = head[0].length;
  const rest = sql.slice(headLen);
  const fromIdx = findTopLevelFrom(rest);
  if (fromIdx === -1) return sql;
  const items = splitTopLevel(rest.slice(0, fromIdx), ",");
  let aliased = false;
  const newItems = items.map((raw, i) => {
    const item = raw.trim();
    if (/\bas\b/i.test(item)) return raw;
    if (item === "*" || item.endsWith(".*")) return raw;
    aliased = true;
    return `${raw} as "c_${i}"`;
  });
  if (!aliased) return sql;
  return sql.slice(0, headLen) + newItems.join(",") + rest.slice(fromIdx);
}

function findTopLevelFrom(s: string): number {
  let depth = 0, sg = false, db_ = false, bt = false, br = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (sg) { if (ch === "'" && s[i-1] !== "\\") sg = false; continue; }
    if (db_) { if (ch === '"' && s[i-1] !== "\\") db_ = false; continue; }
    if (bt) { if (ch === "`") bt = false; continue; }
    if (br) { if (ch === "]") br = false; continue; }
    if (ch === "'") { sg = true; continue; }
    if (ch === '"') { db_ = true; continue; }
    if (ch === "`") { bt = true; continue; }
    if (ch === "[") { br = true; continue; }
    if (ch === "(") { depth++; continue; }
    if (ch === ")") { depth--; continue; }
    if (depth === 0 && (ch === "f" || ch === "F") && /^from\b/i.test(s.slice(i)) && /\s/.test(s[i-1] ?? " ")) return i;
  }
  return -1;
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0, sg = false, db_ = false, bt = false, br = false, start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (sg) { if (ch === "'" && s[i-1] !== "\\") sg = false; continue; }
    if (db_) { if (ch === '"' && s[i-1] !== "\\") db_ = false; continue; }
    if (bt) { if (ch === "`") bt = false; continue; }
    if (br) { if (ch === "]") br = false; continue; }
    if (ch === "'") { sg = true; continue; }
    if (ch === '"') { db_ = true; continue; }
    if (ch === "`") { bt = true; continue; }
    if (ch === "[") { br = true; continue; }
    if (ch === "(") { depth++; continue; }
    if (ch === ")") { depth--; continue; }
    if (depth === 0 && ch === sep) { out.push(s.slice(start, i)); start = i + 1; }
  }
  out.push(s.slice(start));
  return out;
}

// ─── Backend selection ─────────────────────────────────────────────────────

function detectBackendKind(url: string): "file" | "libsql" {
  const u = url.toLowerCase();
  if (u.startsWith("libsql://") || u.startsWith("https://") || u.startsWith("http://")) {
    return "libsql";
  }
  return "file";
}

async function makeFileBackend(url: string): Promise<Backend> {
  const filename = url.replace(/^file:/, "");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DatabaseSync } = await import("node:sqlite");
  const sqlite = new DatabaseSync(filename);
  sqlite.exec("PRAGMA foreign_keys = ON;");

  function rowToValues(stmt: { columns?: () => Array<{ name: string }> }, row: Record<string, unknown>): unknown[] {
    const cols = stmt.columns?.();
    if (cols && cols.length === Object.keys(row).length) {
      return cols.map((c) => row[c.name]);
    }
    return Object.values(row);
  }

  return {
    async run(sql, params) {
      sqlite.prepare(sql).run(...(params as never[]));
    },
    async query(sql, params, method) {
      const rewritten = aliasOuterSelect(sql);
      const stmt = sqlite.prepare(rewritten);
      if (method === "run") {
        stmt.run(...(params as never[]));
        return [];
      }
      if (method === "get") {
        const row = stmt.get(...(params as never[]));
        if (!row) return [];
        return [rowToValues(stmt, row as Record<string, unknown>)];
      }
      const rows = stmt.all(...(params as never[])) as Array<Record<string, unknown>>;
      return rows.map((r) => rowToValues(stmt, r));
    },
    async beginTx() { sqlite.exec("BEGIN"); },
    async commitTx() { sqlite.exec("COMMIT"); },
    async rollbackTx() { sqlite.exec("ROLLBACK"); },
  };
}

async function makeLibsqlBackend(url: string, authToken?: string): Promise<Backend> {
  // Use the /web entry point — pure HTTP, no native bindings. Works on Vercel,
  // Cloudflare Workers, Node runtimes alike.
  const { createClient } = await import("@libsql/client/web");
  const client = createClient({ url, authToken });

  function valuesFromRow(row: unknown): unknown[] {
    // libsql Row is array-like with both index access and named access.
    if (Array.isArray(row)) return row as unknown[];
    if (row && typeof row === "object") {
      // Use array-indexed access if row has length
      const r = row as { length?: number; [k: number]: unknown };
      if (typeof r.length === "number") {
        const out: unknown[] = [];
        for (let i = 0; i < r.length; i++) out.push(r[i]);
        return out;
      }
      return Object.values(row as Record<string, unknown>);
    }
    return [];
  }

  return {
    async run(sql, params) {
      await client.execute({ sql, args: params as never[] });
    },
    async query(sql, params, method) {
      const rewritten = aliasOuterSelect(sql);
      const result = await client.execute({ sql: rewritten, args: params as never[] });
      if (method === "run") return [];
      const rows = result.rows.map((r) => valuesFromRow(r));
      if (method === "get") return rows.slice(0, 1);
      return rows;
    },
    async beginTx() { await client.execute("BEGIN"); },
    async commitTx() { await client.execute("COMMIT"); },
    async rollbackTx() { await client.execute("ROLLBACK"); },
  };
}

let backendPromise: Promise<Backend> | null = null;
function getBackend(): Promise<Backend> {
  if (globalForDb.__qBackend) return Promise.resolve(globalForDb.__qBackend);
  if (backendPromise) return backendPromise;

  const url = process.env.DATABASE_URL ?? "file:./data/quorum.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const kind = detectBackendKind(url);

  backendPromise = (kind === "libsql" ? makeLibsqlBackend(url, authToken) : makeFileBackend(url)).then(
    (b) => {
      if (process.env.NODE_ENV !== "production") globalForDb.__qBackend = b;
      return b;
    }
  );
  return backendPromise;
}

// ─── Drizzle sqlite-proxy wrapper ──────────────────────────────────────────

function makeDb() {
  return drizzle(
    async (sql, params, method) => {
      const backend = await getBackend();
      try {
        const rows = await backend.query(sql, params, method);
        return { rows };
      } catch (err) {
        console.error("db error:", err, "\nSQL:", sql);
        throw err;
      }
    },
    async (queries) => {
      const backend = await getBackend();
      await backend.beginTx();
      try {
        const results: { rows: unknown[][] }[] = [];
        for (const { sql, params, method } of queries) {
          const rows = await backend.query(sql, params, method);
          results.push({ rows });
        }
        await backend.commitTx();
        return results;
      } catch (err) {
        await backend.rollbackTx();
        throw err;
      }
    },
    { schema }
  );
}

export const db = globalForDb.__qDb ?? makeDb();
if (process.env.NODE_ENV !== "production") globalForDb.__qDb = db;

export { schema };
