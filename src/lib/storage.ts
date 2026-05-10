/**
 * Pluggable file-storage backend.
 *
 * Picks the driver from STORAGE_DRIVER env var (defaults to "local"):
 *   - "local"        → writes under public/uploads/ (dev, single-instance hosts)
 *   - "vercel-blob"  → uploads to Vercel Blob; requires BLOB_READ_WRITE_TOKEN
 *
 * Callers go through put() and delete(). Both return / accept the URL string
 * stored in the DB:
 *   - local:        "/uploads/orgId/foo.pdf"        (same-origin)
 *   - vercel-blob:  "https://....vercel-storage.com/orgId/foo.pdf"
 *
 * Both work as <a href> / <iframe src> directly. No migration needed when
 * switching drivers — old local rows keep working as long as the local files
 * exist; new uploads go to whichever driver is currently selected.
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

export interface Storage {
  put(args: { keyHint: string; data: Buffer; mimeType: string }): Promise<StoredFile>;
  /** Delete a previously-stored file by the URL returned from put(). */
  delete(url: string): Promise<void>;
  readonly driver: "local" | "vercel-blob";
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
  const driver = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  if (driver === "vercel-blob") {
    if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.NODE_ENV === "production") {
      console.warn("STORAGE_DRIVER=vercel-blob set but BLOB_READ_WRITE_TOKEN missing");
    }
    cached = new VercelBlobStorage();
  } else if (driver !== "local") {
    console.warn(`Unknown STORAGE_DRIVER='${driver}', falling back to local`);
    cached = new LocalStorage();
  } else {
    cached = new LocalStorage();
  }
  return cached;
}
