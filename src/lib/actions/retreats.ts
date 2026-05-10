"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  retreatActivities,
  retreatAgendaItems,
  retreatIntakeResponses,
  retreatTakeaways,
  retreatTemplates,
  retreats,
} from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { ACTIVITY_KINDS, RETREAT_STATUSES } from "@/lib/enums";
import { genToken } from "@/lib/utils";

const activitySchema = z.object({
  title: z.string().min(2),
  kind: z.enum(ACTIVITY_KINDS),
  description: z.string().optional(),
  durationMin: z.coerce.number().int().min(5).max(480),
  groupSizeMin: z.coerce.number().int().min(1),
  groupSizeMax: z.coerce.number().int().min(1),
  instructions: z.string().min(1),
  materials: z.string().optional(),
  learningObjectives: z.string().optional(),
});

export async function createActivity(formData: FormData) {
  const { membership } = await requireMembership();
  const parsed = activitySchema.parse({
    title: formData.get("title"),
    kind: formData.get("kind"),
    description: formData.get("description") || undefined,
    durationMin: formData.get("durationMin") ?? 30,
    groupSizeMin: formData.get("groupSizeMin") ?? 2,
    groupSizeMax: formData.get("groupSizeMax") ?? 50,
    instructions: formData.get("instructions"),
    materials: formData.get("materials") || undefined,
    learningObjectives: formData.get("learningObjectives") || undefined,
  });
  await db.insert(retreatActivities).values({
    organizationId: membership.organizationId,
    title: parsed.title,
    kind: parsed.kind,
    description: parsed.description ?? null,
    durationMin: parsed.durationMin,
    groupSizeMin: parsed.groupSizeMin,
    groupSizeMax: parsed.groupSizeMax,
    instructions: parsed.instructions,
    materials: parsed.materials ?? null,
    learningObjectives: parsed.learningObjectives ?? null,
  });
  revalidatePath("/retreats/activities");
  redirect("/retreats/activities");
}

const retreatSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

export async function createRetreat(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = retreatSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    location: formData.get("location") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });
  const [r] = await db
    .insert(retreats)
    .values({
      organizationId: membership.organizationId,
      organizerId: user.id,
      title: parsed.title,
      description: parsed.description ?? null,
      location: parsed.location ?? null,
      startDate: new Date(parsed.startDate),
      endDate: new Date(parsed.endDate),
      status: "PLANNING",
    })
    .returning();
  revalidatePath("/retreats");
  redirect(`/retreats/${r.id}`);
}

export async function updateRetreatStatus(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!RETREAT_STATUSES.includes(status as never)) throw new Error("Bad status");
  const rows = await db
    .select()
    .from(retreats)
    .where(and(eq(retreats.id, id), eq(retreats.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.update(retreats).set({ status }).where(eq(retreats.id, id));
  revalidatePath(`/retreats/${id}`);
}

const agendaSchema = z.object({
  retreatId: z.string(),
  activityId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  durationMin: z.coerce.number().int().min(5).max(480),
  facilitatorName: z.string().optional(),
});

export async function addRetreatAgendaItem(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = agendaSchema.parse({
    retreatId: formData.get("retreatId"),
    activityId: formData.get("activityId") || undefined,
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    durationMin: formData.get("durationMin") ?? 30,
    facilitatorName: formData.get("facilitatorName") || undefined,
  });

  const r = await db
    .select()
    .from(retreats)
    .where(and(eq(retreats.id, parsed.retreatId), eq(retreats.organizationId, membership.organizationId)))
    .limit(1);
  if (!r[0]) throw new Error("Not found");

  const last = await db
    .select()
    .from(retreatAgendaItems)
    .where(eq(retreatAgendaItems.retreatId, parsed.retreatId))
    .orderBy(desc(retreatAgendaItems.order))
    .limit(1);
  const nextOrder = (last[0]?.order ?? 0) + 1;

  await db.insert(retreatAgendaItems).values({
    retreatId: parsed.retreatId,
    activityId: parsed.activityId && parsed.activityId !== "none" ? parsed.activityId : null,
    order: nextOrder,
    title: parsed.title,
    description: parsed.description ?? null,
    durationMin: parsed.durationMin,
    facilitatorName: parsed.facilitatorName ?? null,
  });
  revalidatePath(`/retreats/${parsed.retreatId}`);
}

export async function deleteRetreatAgendaItem(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select({ a: retreatAgendaItems, r: retreats })
    .from(retreatAgendaItems)
    .innerJoin(retreats, eq(retreatAgendaItems.retreatId, retreats.id))
    .where(and(eq(retreatAgendaItems.id, id), eq(retreats.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.delete(retreatAgendaItems).where(eq(retreatAgendaItems.id, id));
  revalidatePath(`/retreats/${rows[0].r.id}`);
}

const takeawaySchema = z.object({
  retreatId: z.string(),
  content: z.string().min(2),
});

export async function generateIntakeToken(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(retreats)
    .where(and(eq(retreats.id, id), eq(retreats.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.update(retreats).set({ intakeToken: genToken("rt_"), intakeOpen: true }).where(eq(retreats.id, id));
  revalidatePath(`/retreats/${id}`);
}

export async function setIntakeOpen(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const open = formData.get("open") === "true";
  await db
    .update(retreats)
    .set({ intakeOpen: open })
    .where(and(eq(retreats.id, id), eq(retreats.organizationId, membership.organizationId)));
  revalidatePath(`/retreats/${id}`);
}

const submitIntakeSchema = z.object({
  token: z.string(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  role: z.string().optional(),
  answersJson: z.string(),
});

export async function submitIntakeResponse(formData: FormData) {
  // Public action — no auth required, only the unguessable token gates it.
  const parsed = submitIntakeSchema.parse({
    token: formData.get("token"),
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    role: formData.get("role") || undefined,
    answersJson: formData.get("answersJson"),
  });

  const rows = await db.select().from(retreats).where(eq(retreats.intakeToken, parsed.token)).limit(1);
  const retreat = rows[0];
  if (!retreat) throw new Error("Invalid token");
  if (!retreat.intakeOpen) throw new Error("This intake form is closed");

  let answers: Record<string, unknown> = {};
  try {
    answers = JSON.parse(parsed.answersJson) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid answers payload");
  }

  await db.insert(retreatIntakeResponses).values({
    retreatId: retreat.id,
    participantName: parsed.name,
    participantEmail: parsed.email && parsed.email !== "" ? parsed.email : null,
    participantRole: parsed.role ?? null,
    answers: JSON.stringify(answers),
  });

  redirect(`/r/${parsed.token}/done`);
}

const useTemplateSchema = z.object({
  templateId: z.string(),
  title: z.string().min(2),
  startDate: z.string().min(1),
  location: z.string().optional(),
});

export async function useRetreatTemplate(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const parsed = useTemplateSchema.parse({
    templateId: formData.get("templateId"),
    title: formData.get("title"),
    startDate: formData.get("startDate"),
    location: formData.get("location") || undefined,
  });

  const tplRows = await db.select().from(retreatTemplates).where(eq(retreatTemplates.id, parsed.templateId)).limit(1);
  const tpl = tplRows[0];
  if (!tpl) throw new Error("Template not found");

  // Compute end date by summing agenda durations
  let agenda: Array<{ title: string; description?: string; durationMin: number; activityKey?: string | null; facilitatorRole?: string | null }> = [];
  try {
    agenda = JSON.parse(tpl.agenda) as typeof agenda;
  } catch {
    /* noop */
  }
  const totalMin = agenda.reduce((s, a) => s + (a.durationMin ?? 0), 0);
  const startDate = new Date(parsed.startDate);
  const endDate = new Date(startDate.getTime() + totalMin * 60 * 1000);

  const [r] = await db
    .insert(retreats)
    .values({
      organizationId: membership.organizationId,
      organizerId: user.id,
      title: parsed.title,
      description: tpl.tagline ?? null,
      location: parsed.location ?? null,
      startDate,
      endDate,
      status: "PLANNING",
      intakeToken: genToken("rt_"),
      intakeOpen: true,
      philosophy: tpl.philosophy,
    })
    .returning();

  // Copy agenda items
  if (agenda.length) {
    await db.insert(retreatAgendaItems).values(
      agenda.map((item, idx) => ({
        retreatId: r.id,
        order: idx + 1,
        title: item.title,
        description: item.description ?? null,
        durationMin: item.durationMin,
        facilitatorName: item.facilitatorRole ?? null,
      }))
    );
  }

  revalidatePath("/retreats");
  redirect(`/retreats/${r.id}`);
}

export async function getIntakeForToken(token: string) {
  const rows = await db.select().from(retreats).where(eq(retreats.intakeToken, token)).limit(1);
  return rows[0] ?? null;
}

export async function listIntakeResponses(retreatId: string) {
  return db
    .select()
    .from(retreatIntakeResponses)
    .where(eq(retreatIntakeResponses.retreatId, retreatId))
    .orderBy(asc(retreatIntakeResponses.submittedAt));
}

export async function addTakeaway(formData: FormData) {
  const { user, membership } = await requireMembership();
  const parsed = takeawaySchema.parse({
    retreatId: formData.get("retreatId"),
    content: formData.get("content"),
  });
  const r = await db
    .select()
    .from(retreats)
    .where(and(eq(retreats.id, parsed.retreatId), eq(retreats.organizationId, membership.organizationId)))
    .limit(1);
  if (!r[0]) throw new Error("Not found");
  await db.insert(retreatTakeaways).values({
    retreatId: parsed.retreatId,
    authorId: user.id,
    content: parsed.content,
  });
  revalidatePath(`/retreats/${parsed.retreatId}`);
}
