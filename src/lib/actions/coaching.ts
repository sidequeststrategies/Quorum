"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  coachingClients,
  coachingLessons,
  coachingPrograms,
  coachingSessions,
  lessonAssignments,
} from "@/db/schema";
import { requireUser } from "@/lib/session";
import {
  COACHING_CLIENT_STATUSES,
  COACHING_PROGRAM_KINDS,
  LESSON_ASSIGNMENT_STATUSES,
} from "@/lib/enums";
import { genToken } from "@/lib/utils";

const programSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  kind: z.enum(COACHING_PROGRAM_KINDS),
});

export async function createProgram(formData: FormData) {
  const user = await requireUser();
  const parsed = programSchema.parse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    kind: formData.get("kind"),
  });
  const [p] = await db
    .insert(coachingPrograms)
    .values({
      ownerId: user.id,
      title: parsed.title,
      description: parsed.description ?? null,
      kind: parsed.kind,
    })
    .returning();
  revalidatePath("/coaching");
  redirect(`/coaching/${p.id}`);
}

const lessonSchema = z.object({
  programId: z.string(),
  title: z.string().min(2),
  body: z.string().optional(),
  durationMin: z.coerce.number().int().min(5).max(480),
  exercisesJson: z.string().optional(),
});

export async function createLesson(formData: FormData) {
  const user = await requireUser();
  const parsed = lessonSchema.parse({
    programId: formData.get("programId"),
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    durationMin: formData.get("durationMin") ?? 45,
    exercisesJson: formData.get("exercisesJson") || undefined,
  });
  const programRows = await db
    .select()
    .from(coachingPrograms)
    .where(and(eq(coachingPrograms.id, parsed.programId), eq(coachingPrograms.ownerId, user.id)))
    .limit(1);
  if (!programRows[0]) throw new Error("Not found");

  const last = await db
    .select()
    .from(coachingLessons)
    .where(eq(coachingLessons.programId, parsed.programId))
    .orderBy(coachingLessons.order);
  const nextOrder = (last[last.length - 1]?.order ?? 0) + 1;

  await db.insert(coachingLessons).values({
    programId: parsed.programId,
    order: nextOrder,
    title: parsed.title,
    body: parsed.body ?? "",
    durationMin: parsed.durationMin,
    exercises: parsed.exercisesJson ?? "[]",
  });
  revalidatePath(`/coaching/${parsed.programId}`);
}

export async function deleteLesson(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const rows = await db
    .select({ l: coachingLessons, p: coachingPrograms })
    .from(coachingLessons)
    .innerJoin(coachingPrograms, eq(coachingLessons.programId, coachingPrograms.id))
    .where(and(eq(coachingLessons.id, id), eq(coachingPrograms.ownerId, user.id)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.delete(coachingLessons).where(eq(coachingLessons.id, id));
  revalidatePath(`/coaching/${rows[0].p.id}`);
}

const clientSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  company: z.string().optional(),
  role: z.string().optional(),
  programId: z.string().optional(),
  notes: z.string().optional(),
  startDate: z.string().optional(),
});

export async function createClient(formData: FormData) {
  const user = await requireUser();
  const parsed = clientSchema.parse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    company: formData.get("company") || undefined,
    role: formData.get("role") || undefined,
    programId: formData.get("programId") || undefined,
    notes: formData.get("notes") || undefined,
    startDate: formData.get("startDate") || undefined,
  });
  const [c] = await db
    .insert(coachingClients)
    .values({
      ownerId: user.id,
      name: parsed.name,
      email: parsed.email && parsed.email !== "" ? parsed.email : null,
      company: parsed.company ?? null,
      role: parsed.role ?? null,
      programId: parsed.programId && parsed.programId !== "none" ? parsed.programId : null,
      notes: parsed.notes ?? null,
      startDate: parsed.startDate ? new Date(parsed.startDate) : null,
    })
    .returning();
  revalidatePath("/coaching/clients");
  redirect(`/coaching/clients/${c.id}`);
}

export async function updateClientStatus(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!COACHING_CLIENT_STATUSES.includes(status as never)) throw new Error("Bad status");
  const rows = await db
    .select()
    .from(coachingClients)
    .where(and(eq(coachingClients.id, id), eq(coachingClients.ownerId, user.id)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.update(coachingClients).set({ status }).where(eq(coachingClients.id, id));
  revalidatePath(`/coaching/clients/${id}`);
}

export async function assignLesson(formData: FormData) {
  const user = await requireUser();
  const lessonId = String(formData.get("lessonId"));
  const clientId = String(formData.get("clientId"));

  // Authorize: lesson belongs to a program owned by this user, client belongs to this user
  const lessonRows = await db
    .select({ l: coachingLessons, p: coachingPrograms })
    .from(coachingLessons)
    .innerJoin(coachingPrograms, eq(coachingLessons.programId, coachingPrograms.id))
    .where(and(eq(coachingLessons.id, lessonId), eq(coachingPrograms.ownerId, user.id)))
    .limit(1);
  if (!lessonRows[0]) throw new Error("Lesson not found");
  const clientRows = await db
    .select()
    .from(coachingClients)
    .where(and(eq(coachingClients.id, clientId), eq(coachingClients.ownerId, user.id)))
    .limit(1);
  if (!clientRows[0]) throw new Error("Client not found");

  const existing = await db
    .select()
    .from(lessonAssignments)
    .where(and(eq(lessonAssignments.lessonId, lessonId), eq(lessonAssignments.clientId, clientId)))
    .limit(1);
  if (existing[0]) {
    revalidatePath(`/coaching/clients/${clientId}`);
    return;
  }
  await db.insert(lessonAssignments).values({
    lessonId,
    clientId,
    status: "ASSIGNED",
  });
  revalidatePath(`/coaching/clients/${clientId}`);
}

export async function updateAssignmentStatus(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!LESSON_ASSIGNMENT_STATUSES.includes(status as never)) throw new Error("Bad status");
  const rows = await db
    .select({ a: lessonAssignments, c: coachingClients })
    .from(lessonAssignments)
    .innerJoin(coachingClients, eq(lessonAssignments.clientId, coachingClients.id))
    .where(and(eq(lessonAssignments.id, id), eq(coachingClients.ownerId, user.id)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db
    .update(lessonAssignments)
    .set({ status, completedAt: status === "COMPLETED" ? new Date() : null })
    .where(eq(lessonAssignments.id, id));
  revalidatePath(`/coaching/clients/${rows[0].c.id}`);
}

const sessionSchema = z.object({
  clientId: z.string(),
  sessionDate: z.string().min(1),
  durationMin: z.coerce.number().int().min(5).max(480),
  topic: z.string().optional(),
  notes: z.string().optional(),
  followUps: z.string().optional(),
});

export async function generatePortalToken(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(coachingClients)
    .where(and(eq(coachingClients.id, id), eq(coachingClients.ownerId, user.id)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db
    .update(coachingClients)
    .set({ portalToken: genToken("cp_"), portalEnabled: true })
    .where(eq(coachingClients.id, id));
  revalidatePath(`/coaching/clients/${id}`);
}

export async function setPortalEnabled(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const enabled = formData.get("enabled") === "true";
  const rows = await db
    .select()
    .from(coachingClients)
    .where(and(eq(coachingClients.id, id), eq(coachingClients.ownerId, user.id)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.update(coachingClients).set({ portalEnabled: enabled }).where(eq(coachingClients.id, id));
  revalidatePath(`/coaching/clients/${id}`);
}

const portalAssignmentSchema = z.object({
  token: z.string(),
  assignmentId: z.string(),
  status: z.enum(LESSON_ASSIGNMENT_STATUSES),
});

// Public action — gated only by the unguessable portal token.
export async function clientUpdateAssignment(formData: FormData) {
  const parsed = portalAssignmentSchema.parse({
    token: formData.get("token"),
    assignmentId: formData.get("assignmentId"),
    status: formData.get("status"),
  });

  const clientRows = await db
    .select()
    .from(coachingClients)
    .where(eq(coachingClients.portalToken, parsed.token))
    .limit(1);
  const client = clientRows[0];
  if (!client || !client.portalEnabled) throw new Error("Invalid token");

  const arows = await db
    .select()
    .from(lessonAssignments)
    .where(and(eq(lessonAssignments.id, parsed.assignmentId), eq(lessonAssignments.clientId, client.id)))
    .limit(1);
  if (!arows[0]) throw new Error("Assignment not found");

  await db
    .update(lessonAssignments)
    .set({
      status: parsed.status,
      completedAt: parsed.status === "COMPLETED" ? new Date() : null,
    })
    .where(eq(lessonAssignments.id, parsed.assignmentId));

  revalidatePath(`/c/${parsed.token}`);
}

export async function logSession(formData: FormData) {
  const user = await requireUser();
  const parsed = sessionSchema.parse({
    clientId: formData.get("clientId"),
    sessionDate: formData.get("sessionDate"),
    durationMin: formData.get("durationMin") ?? 60,
    topic: formData.get("topic") || undefined,
    notes: formData.get("notes") || undefined,
    followUps: formData.get("followUps") || undefined,
  });
  const rows = await db
    .select()
    .from(coachingClients)
    .where(and(eq(coachingClients.id, parsed.clientId), eq(coachingClients.ownerId, user.id)))
    .limit(1);
  if (!rows[0]) throw new Error("Client not found");
  await db.insert(coachingSessions).values({
    clientId: parsed.clientId,
    ownerId: user.id,
    sessionDate: new Date(parsed.sessionDate),
    durationMin: parsed.durationMin,
    topic: parsed.topic ?? null,
    notes: parsed.notes ?? null,
    followUps: parsed.followUps ?? null,
  });
  revalidatePath(`/coaching/clients/${parsed.clientId}`);
}
