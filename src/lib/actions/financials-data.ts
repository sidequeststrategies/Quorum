"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { financialDocuments, financialSnapshots } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { FINANCIAL_DOC_KINDS } from "@/lib/financial-docs";
import { getStorage } from "@/lib/storage";
import { logAccess } from "@/lib/audit";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
]);
const MAX_BYTES = 25 * 1024 * 1024;

const snapshotSchema = z.object({
  period: z.string().min(1), // YYYY-MM
  cash: z.coerce.number().int().min(0).default(0),
  arr: z.coerce.number().int().min(0).default(0),
  mrr: z.coerce.number().int().min(0).default(0),
  revenue: z.coerce.number().int().min(0).default(0),
  grossMargin: z.coerce.number().int().min(0).max(100).default(0),
  burn: z.coerce.number().int().default(0),
  headcount: z.coerce.number().int().min(0).default(0),
  accountsReceivable: z.coerce.number().int().min(0).default(0),
  accountsPayable: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export async function saveSnapshot(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const parsed = snapshotSchema.parse({
    period: formData.get("period"),
    cash: formData.get("cash") ?? 0,
    arr: formData.get("arr") ?? 0,
    mrr: formData.get("mrr") ?? 0,
    revenue: formData.get("revenue") ?? 0,
    grossMargin: formData.get("grossMargin") ?? 0,
    burn: formData.get("burn") ?? 0,
    headcount: formData.get("headcount") ?? 0,
    accountsReceivable: formData.get("accountsReceivable") ?? 0,
    accountsPayable: formData.get("accountsPayable") ?? 0,
    notes: formData.get("notes") || undefined,
  });

  const period = new Date(parsed.period + "-01");

  const existing = await db
    .select()
    .from(financialSnapshots)
    .where(and(eq(financialSnapshots.organizationId, membership.organizationId), eq(financialSnapshots.period, period)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(financialSnapshots)
      .set({
        cash: parsed.cash,
        arr: parsed.arr,
        mrr: parsed.mrr,
        revenue: parsed.revenue,
        grossMargin: parsed.grossMargin,
        burn: parsed.burn,
        headcount: parsed.headcount,
        accountsReceivable: parsed.accountsReceivable,
        accountsPayable: parsed.accountsPayable,
        notes: parsed.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(financialSnapshots.id, existing[0].id));
  } else {
    await db.insert(financialSnapshots).values({
      organizationId: membership.organizationId,
      period,
      cash: parsed.cash,
      arr: parsed.arr,
      mrr: parsed.mrr,
      revenue: parsed.revenue,
      grossMargin: parsed.grossMargin,
      burn: parsed.burn,
      headcount: parsed.headcount,
      accountsReceivable: parsed.accountsReceivable,
      accountsPayable: parsed.accountsPayable,
      notes: parsed.notes ?? null,
      createdById: user.id,
    });
  }

  revalidatePath("/financials");
  redirect("/financials");
}

export async function deleteSnapshot(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(financialSnapshots)
    .where(and(eq(financialSnapshots.id, id), eq(financialSnapshots.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.delete(financialSnapshots).where(eq(financialSnapshots.id, id));
  revalidatePath("/financials");
}

const uploadSchema = z.object({
  period: z.string().min(1),
  kind: z.enum(FINANCIAL_DOC_KINDS),
  title: z.string().min(1),
  description: z.string().optional(),
});

export async function uploadFinancialDocument(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const parsed = uploadSchema.parse({
    period: formData.get("period"),
    kind: formData.get("kind"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
  });

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Choose a file");
  if (file.size > MAX_BYTES) throw new Error("File exceeds 25MB limit");
  if (!ALLOWED_MIME.has(file.type)) throw new Error(`Unsupported file type: ${file.type}`);

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const keyHint = `${membership.organizationId}/financials/${Date.now()}-${parsed.kind}-${safeName}`;
  const stored = await getStorage().put({
    keyHint,
    data: buf,
    mimeType: file.type,
    organizationId: membership.organizationId,
    filename: file.name,
  });

  const period = new Date(parsed.period + "-01");

  await db.insert(financialDocuments).values({
    organizationId: membership.organizationId,
    period,
    kind: parsed.kind,
    title: parsed.title,
    description: parsed.description ?? null,
    filename: file.name,
    mimeType: file.type,
    sizeBytes: stored.size,
    storagePath: stored.url,
    uploadedById: user.id,
  });

  await logAccess({
    organizationId: membership.organizationId,
    userId: user.id,
    action: "DOC_UPLOAD",
    resource: "financial-document",
    detail: `${parsed.kind}: ${file.name} (${parsed.period})`,
  });

  revalidatePath("/financials");
  redirect("/financials");
}

export async function deleteFinancialDocument(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(financialDocuments)
    .where(and(eq(financialDocuments.id, id), eq(financialDocuments.organizationId, membership.organizationId)))
    .limit(1);
  const doc = rows[0];
  if (!doc) throw new Error("Not found");
  await getStorage().delete(doc.storagePath);
  await db.delete(financialDocuments).where(eq(financialDocuments.id, id));
  await logAccess({
    organizationId: membership.organizationId,
    action: "DOC_DELETE",
    resource: "financial-document",
    resourceId: doc.id,
    detail: doc.filename,
  });
  revalidatePath("/financials");
}
