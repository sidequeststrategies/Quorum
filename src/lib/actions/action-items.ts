"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { actionItems } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { ACTION_ITEM_STATUSES } from "@/lib/enums";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  meetingId: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function createActionItem(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const parsed = createSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    assigneeId: formData.get("assigneeId") || undefined,
    meetingId: formData.get("meetingId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });

  await db.insert(actionItems).values({
    organizationId: membership.organizationId,
    title: parsed.title,
    description: parsed.description ?? null,
    assigneeId: parsed.assigneeId && parsed.assigneeId !== "none" ? parsed.assigneeId : null,
    meetingId: parsed.meetingId && parsed.meetingId !== "none" ? parsed.meetingId : null,
    dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
  });

  revalidatePath("/action-items");
}

const statusSchema = z.object({
  id: z.string(),
  status: z.enum(ACTION_ITEM_STATUSES),
});

export async function updateActionItemStatus(formData: FormData) {
  const { user, membership } = await requireMembership();
  const parsed = statusSchema.parse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  const rows = await db
    .select()
    .from(actionItems)
    .where(and(eq(actionItems.id, parsed.id), eq(actionItems.organizationId, membership.organizationId)))
    .limit(1);
  const item = rows[0];
  if (!item) throw new Error("Not found");
  if (item.assigneeId !== user.id && !canManage(membership.role)) throw new Error("Forbidden");
  await db.update(actionItems).set({ status: parsed.status }).where(eq(actionItems.id, item.id));
  revalidatePath("/action-items");
}
