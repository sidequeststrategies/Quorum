// Authenticated file downloads for db-stored files. Access requires a
// session AND a membership in the file's organization — board documents are
// never served from public URLs. Every download is written to the audit log.

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { fileBlobs } from "@/db/schema";
import { requireUser, findMembership } from "@/lib/session";
import { logAccess } from "@/lib/audit";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9]+$/.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let user;
  try {
    user = await requireUser(); // redirects to /login when signed out
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.select().from(fileBlobs).where(eq(fileBlobs.id, id)).limit(1);
  const blob = rows[0];
  // Same response for "missing" and "not yours": no existence oracle.
  if (!blob) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const membership = await findMembership(user.id, blob.organizationId);
  if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logAccess({
    organizationId: blob.organizationId,
    userId: user.id,
    action: "FILE_DOWNLOAD",
    resource: "file",
    resourceId: blob.id,
    detail: blob.filename,
  });

  // bytea comes back as Uint8Array from postgres-js/PGlite.
  const body = Buffer.isBuffer(blob.data) ? blob.data : Buffer.from(blob.data as unknown as Uint8Array);
  const asciiName = blob.filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": blob.mimeType || "application/octet-stream",
      "Content-Length": String(body.length),
      // Images render inline (report media in <img>); everything else downloads.
      "Content-Disposition": blob.mimeType.startsWith("image/")
        ? "inline"
        : `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(blob.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
