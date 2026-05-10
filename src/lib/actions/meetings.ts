"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agendaItems, attendances, meetings, memberships } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { MEETING_TYPES, MEETING_STATUSES, ATTENDANCE_STATUSES } from "@/lib/enums";

const createSchema = z.object({
  title: z.string().min(2),
  type: z.enum(MEETING_TYPES),
  scheduledAt: z.string().min(1),
  durationMin: z.coerce.number().int().min(15).max(720),
  location: z.string().optional(),
  videoUrl: z.string().optional(),
  notes: z.string().optional(),
  quorumRequired: z.coerce.number().int().min(0),
});

export async function createMeeting(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const parsed = createSchema.parse({
    title: formData.get("title"),
    type: formData.get("type"),
    scheduledAt: formData.get("scheduledAt"),
    durationMin: formData.get("durationMin"),
    location: formData.get("location") || undefined,
    videoUrl: formData.get("videoUrl") || undefined,
    notes: formData.get("notes") || undefined,
    quorumRequired: formData.get("quorumRequired") ?? 0,
  });

  const [meeting] = await db
    .insert(meetings)
    .values({
      organizationId: membership.organizationId,
      title: parsed.title,
      type: parsed.type,
      status: "SCHEDULED",
      scheduledAt: new Date(parsed.scheduledAt),
      durationMin: parsed.durationMin,
      location: parsed.location ?? null,
      videoUrl: parsed.videoUrl ?? null,
      notes: parsed.notes ?? null,
      quorumRequired: parsed.quorumRequired,
    })
    .returning();

  // Auto-invite all current members
  const orgMembers = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.organizationId, membership.organizationId));
  if (orgMembers.length) {
    await db.insert(attendances).values(
      orgMembers.map((m) => ({ meetingId: meeting.id, userId: m.userId, status: "INVITED" as const }))
    );
  }

  revalidatePath("/meetings");
  redirect(`/meetings/${meeting.id}`);
}

const agendaSchema = z.object({
  meetingId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  durationMin: z.coerce.number().int().min(1).max(480),
  presenterId: z.string().optional(),
});

export async function addAgendaItem(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const parsed = agendaSchema.parse({
    meetingId: formData.get("meetingId"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    durationMin: formData.get("durationMin") ?? 10,
    presenterId: formData.get("presenterId") || undefined,
  });

  const meetingRows = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, parsed.meetingId), eq(meetings.organizationId, membership.organizationId)))
    .limit(1);
  const meeting = meetingRows[0];
  if (!meeting) throw new Error("Not found");

  const lastRows = await db
    .select({ order: agendaItems.order })
    .from(agendaItems)
    .where(eq(agendaItems.meetingId, meeting.id))
    .orderBy(desc(agendaItems.order))
    .limit(1);
  const nextOrder = (lastRows[0]?.order ?? 0) + 1;

  await db.insert(agendaItems).values({
    meetingId: meeting.id,
    order: nextOrder,
    title: parsed.title,
    description: parsed.description ?? null,
    durationMin: parsed.durationMin,
    presenterId: parsed.presenterId && parsed.presenterId !== "none" ? parsed.presenterId : null,
  });

  revalidatePath(`/meetings/${meeting.id}`);
}

export async function deleteAgendaItem(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const id = String(formData.get("id"));
  const rows = await db
    .select({ a: agendaItems, m: meetings })
    .from(agendaItems)
    .innerJoin(meetings, eq(agendaItems.meetingId, meetings.id))
    .where(eq(agendaItems.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.m.organizationId !== membership.organizationId) throw new Error("Not found");

  await db.delete(agendaItems).where(eq(agendaItems.id, id));
  revalidatePath(`/meetings/${row.m.id}`);
}

const rsvpSchema = z.object({
  meetingId: z.string(),
  status: z.enum(ATTENDANCE_STATUSES),
});

export async function rsvpMeeting(formData: FormData) {
  const { user, membership } = await requireMembership();
  const parsed = rsvpSchema.parse({
    meetingId: formData.get("meetingId"),
    status: formData.get("status"),
  });
  const meetingRows = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, parsed.meetingId), eq(meetings.organizationId, membership.organizationId)))
    .limit(1);
  if (!meetingRows[0]) throw new Error("Not found");

  const existing = await db
    .select()
    .from(attendances)
    .where(and(eq(attendances.meetingId, parsed.meetingId), eq(attendances.userId, user.id)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(attendances)
      .set({ status: parsed.status, respondedAt: new Date() })
      .where(eq(attendances.id, existing[0].id));
  } else {
    await db.insert(attendances).values({
      meetingId: parsed.meetingId,
      userId: user.id,
      status: parsed.status,
      respondedAt: new Date(),
    });
  }

  revalidatePath(`/meetings/${parsed.meetingId}`);
}

const statusSchema = z.object({
  meetingId: z.string(),
  status: z.enum(MEETING_STATUSES),
});

export async function updateMeetingStatus(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = statusSchema.parse({
    meetingId: formData.get("meetingId"),
    status: formData.get("status"),
  });
  const rows = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, parsed.meetingId), eq(meetings.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.update(meetings).set({ status: parsed.status }).where(eq(meetings.id, parsed.meetingId));
  revalidatePath(`/meetings/${parsed.meetingId}`);
}

export async function saveMinutes(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const meetingId = String(formData.get("meetingId"));
  const minutes = String(formData.get("minutes") ?? "");
  const rows = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.update(meetings).set({ minutes }).where(eq(meetings.id, meetingId));
  revalidatePath(`/meetings/${meetingId}`);
}
