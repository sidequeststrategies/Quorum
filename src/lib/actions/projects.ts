"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, projectMilestones, projectUpdates } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { MILESTONE_STATUSES, PROJECT_STATUSES } from "@/lib/enums";
import { periodFromString } from "@/lib/utils";

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  summary: z.string().optional(),
  status: z.enum(PROJECT_STATUSES),
  ownerId: z.string().optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
});

function parseProjectForm(formData: FormData) {
  return projectSchema.parse({
    name: formData.get("name"),
    summary: formData.get("summary") || undefined,
    status: formData.get("status") ?? "ON_TRACK",
    ownerId: formData.get("ownerId") || undefined,
    startDate: formData.get("startDate") || undefined,
    targetDate: formData.get("targetDate") || undefined,
  });
}

async function requireProject(id: string, organizationId: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  return rows[0];
}

export async function createProject(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = parseProjectForm(formData);

  const inserted = await db
    .insert(projects)
    .values({
      organizationId: membership.organizationId,
      name: parsed.name,
      summary: parsed.summary ?? null,
      status: parsed.status,
      ownerId: parsed.ownerId ?? null,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      targetDate: parsed.targetDate ? new Date(parsed.targetDate) : null,
    })
    .returning({ id: projects.id });

  revalidatePath("/projects");
  redirect(`/projects/${inserted[0].id}`);
}

export async function updateProject(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  await requireProject(id, membership.organizationId);
  const parsed = parseProjectForm(formData);

  await db
    .update(projects)
    .set({
      name: parsed.name,
      summary: parsed.summary ?? null,
      status: parsed.status,
      ownerId: parsed.ownerId ?? null,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
      targetDate: parsed.targetDate ? new Date(parsed.targetDate) : null,
      completedAt: parsed.status === "COMPLETED" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id));

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function deleteProject(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  await requireProject(id, membership.organizationId);
  await db.delete(projects).where(eq(projects.id, id));
  revalidatePath("/projects");
  redirect("/projects");
}

// ---- Milestones ----

const milestoneSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().min(1).max(200),
  dueDate: z.string().optional(),
});

export async function addMilestone(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = milestoneSchema.parse({
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    dueDate: formData.get("dueDate") || undefined,
  });
  await requireProject(parsed.projectId, membership.organizationId);

  const existing = await db
    .select({ order: projectMilestones.order })
    .from(projectMilestones)
    .where(eq(projectMilestones.projectId, parsed.projectId));
  const nextOrder = existing.reduce((m, r) => Math.max(m, r.order), -1) + 1;

  await db.insert(projectMilestones).values({
    projectId: parsed.projectId,
    order: nextOrder,
    title: parsed.title,
    dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
  });

  revalidatePath(`/projects/${parsed.projectId}`);
}

export async function setMilestoneStatus(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const status = z.enum(MILESTONE_STATUSES).parse(formData.get("status"));

  const rows = await db
    .select({ ms: projectMilestones, p: projects })
    .from(projectMilestones)
    .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
    .where(and(eq(projectMilestones.id, id), eq(projects.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");

  await db
    .update(projectMilestones)
    .set({ status, completedAt: status === "DONE" ? new Date() : null })
    .where(eq(projectMilestones.id, id));

  revalidatePath(`/projects/${rows[0].ms.projectId}`);
}

export async function deleteMilestone(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select({ ms: projectMilestones })
    .from(projectMilestones)
    .innerJoin(projects, eq(projectMilestones.projectId, projects.id))
    .where(and(eq(projectMilestones.id, id), eq(projects.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.delete(projectMilestones).where(eq(projectMilestones.id, id));
  revalidatePath(`/projects/${rows[0].ms.projectId}`);
}

// ---- Monthly written updates ----

const updateSchema = z.object({
  projectId: z.string().min(1),
  period: z.string().min(1), // YYYY-MM
  headline: z.string().min(1).max(300),
  body: z.string().default(""),
  status: z.enum(PROJECT_STATUSES),
});

// Upsert: one write-up per project per month. Also rolls the project's
// current status forward so the register and the write-up never disagree.
export async function saveProjectUpdate(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = updateSchema.parse({
    projectId: formData.get("projectId"),
    period: formData.get("period"),
    headline: formData.get("headline"),
    body: formData.get("body") ?? "",
    status: formData.get("status"),
  });
  await requireProject(parsed.projectId, membership.organizationId);
  const period = periodFromString(parsed.period);

  const existing = await db
    .select()
    .from(projectUpdates)
    .where(and(eq(projectUpdates.projectId, parsed.projectId), eq(projectUpdates.period, period)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(projectUpdates)
      .set({ headline: parsed.headline, body: parsed.body, status: parsed.status, updatedAt: new Date() })
      .where(eq(projectUpdates.id, existing[0].id));
  } else {
    await db.insert(projectUpdates).values({
      projectId: parsed.projectId,
      period,
      headline: parsed.headline,
      body: parsed.body,
      status: parsed.status,
      authorId: user.id,
    });
  }

  await db
    .update(projects)
    .set({ status: parsed.status, updatedAt: new Date() })
    .where(eq(projects.id, parsed.projectId));

  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.projectId}`);
}

export async function deleteProjectUpdate(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select({ u: projectUpdates })
    .from(projectUpdates)
    .innerJoin(projects, eq(projectUpdates.projectId, projects.id))
    .where(and(eq(projectUpdates.id, id), eq(projects.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.delete(projectUpdates).where(eq(projectUpdates.id, id));
  revalidatePath(`/projects/${rows[0].u.projectId}`);
}
