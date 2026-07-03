// Round-trip test for the private db storage driver: put → verify row →
// delete → verify gone. Run with STORAGE_DRIVER=db. Stop the dev server
// first (PGlite is single-process).

import { eq } from "drizzle-orm";
import { getStorage } from "../src/lib/storage";
import { db } from "../src/lib/db";
import { fileBlobs, organizations } from "../src/db/schema";

async function main() {
  const storage = getStorage();
  if (storage.driver !== "db") throw new Error(`expected db driver, got ${storage.driver} — run with STORAGE_DRIVER=db`);

  const [org] = await db.select().from(organizations).limit(1);
  if (!org) throw new Error("seed first");

  const payload = Buffer.from("test-bytes-" + "x".repeat(5000));
  const stored = await storage.put({
    keyHint: `${org.id}/financials/test.bin`,
    data: payload,
    mimeType: "application/octet-stream",
    organizationId: org.id,
    filename: "board pack — June 2026.xlsx",
  });
  console.log(`✓ put → ${stored.url} (${stored.size} bytes)`);
  if (!/\/api\/files\/[a-zA-Z0-9]+$/.test(stored.url)) throw new Error("unexpected URL shape");

  const id = stored.url.split("/").pop()!;
  const [row] = await db.select().from(fileBlobs).where(eq(fileBlobs.id, id)).limit(1);
  if (!row) throw new Error("row not found");
  const back = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data as unknown as Uint8Array);
  if (!back.equals(payload)) throw new Error(`payload mismatch: ${back.length} vs ${payload.length}`);
  console.log(`✓ read back ${back.length} bytes, org=${row.organizationId === org.id ? "ok" : "WRONG"}, filename="${row.filename}"`);

  await storage.delete(stored.url);
  const gone = await db.select().from(fileBlobs).where(eq(fileBlobs.id, id)).limit(1);
  if (gone.length > 0) throw new Error("delete failed");
  console.log("✓ delete ok");
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
