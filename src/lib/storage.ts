/**
 * Pluggable file-storage backend.
 *
 * Picks the driver from STORAGE_DRIVER env var:
 *   - "db"           → Postgres bytea rows served via the authenticated
 *                      /api/files/[id] route. Private: downloads require a
 *                      session + membership in the file's org. Use this in
 *                      production — board documents must not sit on public
 *                      URLs. Default when DATABASE_URL is Postgres.
 *   - "local"        → writes under public/uploads/ (dev, single-instance
 *                      hosts). Default otherwise.
 *   - "vercel-blob"  → uploads to Vercel Blob; requires BLOB_READ_WRITE_TOKEN.
 *                      NOTE: Vercel Blob is public-by-URL — unguessable but
 *                      unauthenticated. Kept for legacy rows only.
 *
 * Callers go through put() and delete(). Both return / accept the URL string
 * stored in the DB:
 *   - db:           "<basePath>/api/files/<id>"     (same-origin, auth-gated)
 *   - local:        "/uploads/orgId/foo.pdf"        (same-origin)
 *   - vercel-blob:  "https://....vercel-storage.com/orgId/foo.pdf"
 *
 * All work as <a href> / <img src> directly (the browser sends the session
 * cookie for same-origin URLs). No migration needed when switching drivers —
 * old rows keep working; new uploads go to the selected driver.
 */

import fs from "node:fs/promises";
import path from "node:path";

export type StoredFile = {
  /** URL to read the file. Persist this in DB. */
  url: string;
  /** Bytes stored. */
  size: number;
  /** Mime type as supplied. */
  mimeType: string;
};

export type PutArgs = {
  keyHint: string;
  data: Buffer;
  mimeType: string;
  /** Required by the "db" driver: scopes download access to org members. */
  organizationId?: string;
  /** Original filename, used for Content-Disposition on download. */
  filename?: string;
};

export interface Storage {
  put(args: PutArgs): Promise<StoredFile>;
  /** Delete a previously-stored file by the URL returned from put(). */
  delete(url: string): Promise<void>;
  readonly driver: "db" | "local" | "vercel-blob";
}

// ─── Postgres driver (private, auth-gated) ──────────────────────────────────

class DbStorage implements Storage {
  readonly driver = "db" as const;

  async put({ keyHint, data, mimeType, organizationId, filename }: PutArgs): Promise<StoredFile> {
    if (!organizationId) throw new Error("db storage requires organizationId for access control");
    // Deferred import: keeps the storage module importable in contexts that
    // don't have a database (and avoids a schema<->storage import cycle).
    const { db } = await import("@/lib/db");
    const { fileBlobs } = await import("@/db/schema");
    const name = filename ?? keyHint.split("/").pop() ?? "file";
    const [row] = await db
      .insert(fileBlobs)
      .values({ organizationId, filename: name, mimeType, sizeBytes: data.length, data })
      .returning({ id: fileBlobs.id });
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    return { url: `${basePath}/api/files/${row.id}`, size: data.length, mimeType };
  }

  async delete(url: string): Promise<void> {
    const m = url.match(/\/api\/files\/([a-zA-Z0-9]+)$/);
    if (!m) return;
    const { db } = await import("@/lib/db");
    const { fileBlobs } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.delete(fileBlobs).where(eq(fileBlobs.id, m[1]));
  }
}

// ─── Local-disk driver ──────────────────────────────────────────────────────

class LocalStorage implements Storage {
  readonly driver = "local" as const;
  private root = path.join(process.cwd(), "public", "uploads");

  async put({ keyHint, data, mimeType }: { keyHint: string; data: Buffer; mimeType: string }): Promise<StoredFile> {
    const safe = sanitizeKey(keyHint);
    const fullPath = path.join(this.root, safe);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, data);
    return {
      url: "/uploads/" + safe.replace(/\\/g, "/"),
      size: data.length,
      mimeType,
    };
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith("/uploads/")) return;
    const rel = url.slice("/uploads/".length);
    const fullPath = path.join(this.root, rel);
    await fs.rm(fullPath, { force: true });
  }
}

// ─── Vercel Blob driver ─────────────────────────────────────────────────────
//
// Soft-loaded — the @vercel/blob package is only imported when this driver is
// actually selected.

class VercelBlobStorage implements Storage {
  readonly driver = "vercel-blob" as const;

  async put({ keyHint, data, mimeType }: { keyHint: string; data: Buffer; mimeType: string }): Promise<StoredFile> {
    const { put } = await import("@vercel/blob");
    const safe = sanitizeKey(keyHint);
    const blob = await put(safe, data, {
      access: "public",
      contentType: mimeType,
      addRandomSuffix: false, // we already include a timestamp in keyHint
      // BLOB_READ_WRITE_TOKEN is read from env automatically.
    });
    return { url: blob.url, size: data.length, mimeType };
  }

  async delete(url: string): Promise<void> {
    // Defensive: only forward to @vercel/blob if it's plausibly a blob URL.
    if (!/^https?:\/\//i.test(url)) return;
    const { del } = await import("@vercel/blob");
    await del(url);
  }
}

function sanitizeKey(key: string): string {
  const cleaned = key
    .replace(/^[\\/]+/, "")
    .replace(/\\/g, "/")
    .replace(/\.\.+/g, ".");
  if (!cleaned) throw new Error("Invalid storage key");
  return cleaned;
}

// ─── Selection ──────────────────────────────────────────────────────────────

let cached: Storage | null = null;
export function getStorage(): Storage {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  const isPg = !!url && (url.startsWith("postgres://") || url.startsWith("postgresql://"));
  // Default: private db storage on Postgres deployments, local disk otherwise.
  const driver = (process.env.STORAGE_DRIVER ?? (isPg ? "db" : "local")).toLowerCase();
  if (driver === "db") {
    cached = new DbStorage();
  } else if (driver === "vercel-blob") {
    if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.NODE_ENV === "production") {
      console.warn("STORAGE_DRIVER=vercel-blob set but BLOB_READ_WRITE_TOKEN missing");
    }
    console.warn("STORAGE_DRIVER=vercel-blob stores files on public URLs — use STORAGE_DRIVER=db for board documents");
    cached = new VercelBlobStorage();
  } else if (driver !== "local") {
    console.warn(`Unknown STORAGE_DRIVER='${driver}', falling back to local`);
    cached = new LocalStorage();
  } else {
    cached = new LocalStorage();
  }
  return cached;
}
