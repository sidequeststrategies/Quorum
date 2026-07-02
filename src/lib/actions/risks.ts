"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { risks, riskReviews } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { RISK_CATEGORIES, RISK_STATUSES } from "@/lib/enums";

const riskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.enum(RISK_CATEGORIES),
  likelihood: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  status: z.enum(RISK_STATUSES),
  ownerId: z.string().optional(),
  mitigation: z.string().optional(),
});

function parseRiskForm(formData: FormData) {
  return riskSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category"),
    likelihood: formData.get("likelihood"),
    impact: formData.get("impact"),
    status: formData.get("status") ?? "OPEN",
    ownerId: formData.get("ownerId") || undefined,
    mitigation: formData.get("mitigation") || undefined,
  });
}

async function requireRisk(id: string, organizationId: string) {
  const rows = await db
    .select()
    .from(risks)
    .where(and(eq(risks.id, id), eq(risks.organizationId, organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  return rows[0];
}

export async function createRisk(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = parseRiskForm(formData);

  await db.insert(risks).values({
    organizationId: membership.organizationId,
    title: parsed.title,
    description: parsed.description ?? null,
    category: parsed.category,
    likelihood: parsed.likelihood,
    impact: parsed.impact,
    status: parsed.status,
    ownerId: parsed.ownerId ?? null,
    mitigation: parsed.mitigation ?? null,
  });

  revalidatePath("/risks");
  redirect("/risks");
}

export async function updateRisk(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  await requireRisk(id, membership.organizationId);
  const parsed = parseRiskForm(formData);

  await db
    .update(risks)
    .set({
      title: parsed.title,
      description: parsed.description ?? null,
      category: parsed.category,
      likelihood: parsed.likelihood,
      impact: parsed.impact,
      status: parsed.status,
      ownerId: parsed.ownerId ?? null,
      mitigation: parsed.mitigation ?? null,
      closedAt: parsed.status === "CLOSED" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(risks.id, id));

  revalidatePath("/risks");
  redirect(`/risks/${id}`);
}

// A board review: appends to the risk's review trail (optionally tied to a
// meeting) and rolls the register entry forward to the reviewed state.
const reviewSchema = z.object({
  riskId: z.string().min(1),
  meetingId: z.string().optional(),
  likelihood: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  status: z.enum(RISK_STATUSES),
  note: z.string().optional(),
});

export async function reviewRisk(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = reviewSchema.parse({
    riskId: formData.get("riskId"),
    meetingId: formData.get("meetingId") || undefined,
    likelihood: formData.get("likelihood"),
    impact: formData.get("impact"),
    status: formData.get("status"),
    note: formData.get("note") || undefined,
  });
  await requireRisk(parsed.riskId, membership.organizationId);

  await db.insert(riskReviews).values({
    riskId: parsed.riskId,
    meetingId: parsed.meetingId ?? null,
    likelihood: parsed.likelihood,
    impact: parsed.impact,
    status: parsed.status,
    note: parsed.note ?? null,
    reviewedById: user.id,
  });

  await db
    .update(risks)
    .set({
      likelihood: parsed.likelihood,
      impact: parsed.impact,
      status: parsed.status,
      closedAt: parsed.status === "CLOSED" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(risks.id, parsed.riskId));

  revalidatePath("/risks");
  revalidatePath(`/risks/${parsed.riskId}`);
}

export async function deleteRisk(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  await requireRisk(id, membership.organizationId);
  await db.delete(risks).where(eq(risks.id, id));
  revalidatePath("/risks");
  redirect("/risks");
}
