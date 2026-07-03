// Image/file uploads from the report block editor. Stores via the same
// storage driver as documents (local disk in dev, Vercel Blob in prod) and
// returns the public URL BlockNote expects.

import { NextResponse } from "next/server";
import { canManage, requireMembership } from "@/lib/session";
import { getStorage } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]);

export async function POST(request: Request) {
  let membership;
  try {
    ({ membership } = await requireMembership());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManage(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File exceeds 10MB" }, { status: 413 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: `Unsupported type ${file.type}` }, { status: 415 });

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const keyHint = `${membership.organizationId}/report-media/${Date.now()}-${safeName}`;
  const stored = await getStorage().put({
    keyHint,
    data: buf,
    mimeType: file.type,
    organizationId: membership.organizationId,
    filename: file.name,
  });

  return NextResponse.json({ url: stored.url });
}
