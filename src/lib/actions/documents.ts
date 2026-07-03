"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents, meetings } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { DOCUMENT_VISIBILITIES } from "@/lib/enums";
import { getStorage } from "@/lib/storage";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
]);

const uploadSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  meetingId: z.string().optional(),
  visibility: z.enum(DOCUMENT_VISIBILITIES),
});

export async function uploadDocument(formData: FormData) {
  const { user, membership } = await requireMembership();
  const parsed = uploadSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    meetingId: formData.get("meetingId") || undefined,
    visibility: formData.get("visibility"),
  });

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Choose a file");
  if (file.size > MAX_BYTES) throw new Error("File exceeds 10MB limit");
  if (!ALLOWED_MIME.has(file.type)) throw new Error(`Unsupported file type: ${file.type}`);

  const meetingId = parsed.meetingId && parsed.meetingId !== "none" ? parsed.meetingId : null;
  if (meetingId) {
    const m = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.id, meetingId), eq(meetings.organizationId, membership.organizationId)))
      .limit(1);
    if (!m[0]) throw new Error("Meeting not found");
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const keyHint = `${membership.organizationId}/${Date.now()}-${safeName}`;
  const stored = await getStorage().put({
    keyHint,
    data: buf,
    mimeType: file.type,
    organizationId: membership.organizationId,
    filename: file.name,
  });

  const [doc] = await db
    .insert(documents)
    .values({
      organizationId: membership.organizationId,
      meetingId,
      uploadedById: user.id,
      title: parsed.title,
      description: parsed.description ?? null,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: stored.size,
      storagePath: stored.url,
      visibility: parsed.visibility,
    })
    .returning();

  revalidatePath("/documents");
  if (meetingId) revalidatePath(`/meetings/${meetingId}`);
  redirect(`/documents/${doc.id}`);
}

export async function deleteDocument(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.organizationId, membership.organizationId)))
    .limit(1);
  const doc = rows[0];
  if (!doc) throw new Error("Not found");

  await getStorage().delete(doc.storagePath);
  await db.delete(documents).where(eq(documents.id, id));
  revalidatePath("/documents");
  redirect("/documents");
}
