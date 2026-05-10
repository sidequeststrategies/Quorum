"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resolutions, votes } from "@/db/schema";
import { canManage, canVote, requireMembership } from "@/lib/session";
import { RESOLUTION_KINDS, VOTE_CHOICES, RESOLUTION_STATUSES } from "@/lib/enums";

const createSchema = z.object({
  title: z.string().min(2),
  body: z.string().min(2),
  kind: z.enum(RESOLUTION_KINDS),
  meetingId: z.string().optional(),
  requiresUnanimous: z.boolean().default(false),
});

export async function createResolution(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = createSchema.parse({
    title: formData.get("title"),
    body: formData.get("body"),
    kind: formData.get("kind"),
    meetingId: formData.get("meetingId") || undefined,
    requiresUnanimous: formData.get("requiresUnanimous") === "on",
  });

  const [r] = await db
    .insert(resolutions)
    .values({
      organizationId: membership.organizationId,
      title: parsed.title,
      body: parsed.body,
      kind: parsed.kind,
      meetingId: parsed.meetingId && parsed.meetingId !== "none" ? parsed.meetingId : null,
      requiresUnanimous: parsed.requiresUnanimous || parsed.kind === "WRITTEN_CONSENT",
    })
    .returning();

  revalidatePath("/resolutions");
  redirect(`/resolutions/${r.id}`);
}

export async function openResolution(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(resolutions)
    .where(and(eq(resolutions.id, id), eq(resolutions.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.update(resolutions).set({ status: "OPEN", openedAt: new Date() }).where(eq(resolutions.id, id));
  revalidatePath(`/resolutions/${id}`);
}

const closeSchema = z.object({
  id: z.string(),
  outcome: z.enum(["PASSED", "FAILED", "WITHDRAWN"]),
});

export async function closeResolution(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = closeSchema.parse({
    id: formData.get("id"),
    outcome: formData.get("outcome"),
  });
  const rows = await db
    .select()
    .from(resolutions)
    .where(and(eq(resolutions.id, parsed.id), eq(resolutions.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  if (!RESOLUTION_STATUSES.includes(parsed.outcome as never)) throw new Error("Bad status");
  await db
    .update(resolutions)
    .set({ status: parsed.outcome, closedAt: new Date() })
    .where(eq(resolutions.id, parsed.id));
  revalidatePath(`/resolutions/${parsed.id}`);
}

const voteSchema = z.object({
  resolutionId: z.string(),
  choice: z.enum(VOTE_CHOICES),
  comment: z.string().optional(),
});

export async function castVote(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canVote(membership.role, membership.votingRights)) throw new Error("Not a voting member");

  const parsed = voteSchema.parse({
    resolutionId: formData.get("resolutionId"),
    choice: formData.get("choice"),
    comment: formData.get("comment") || undefined,
  });

  const rows = await db
    .select()
    .from(resolutions)
    .where(and(eq(resolutions.id, parsed.resolutionId), eq(resolutions.organizationId, membership.organizationId)))
    .limit(1);
  const r = rows[0];
  if (!r) throw new Error("Not found");
  if (r.status !== "OPEN") throw new Error("Resolution is not open for voting");

  const existing = await db
    .select()
    .from(votes)
    .where(and(eq(votes.resolutionId, r.id), eq(votes.userId, user.id)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(votes)
      .set({ choice: parsed.choice, comment: parsed.comment ?? null, castAt: new Date() })
      .where(eq(votes.id, existing[0].id));
  } else {
    await db.insert(votes).values({
      resolutionId: r.id,
      userId: user.id,
      choice: parsed.choice,
      comment: parsed.comment ?? null,
    });
  }

  revalidatePath(`/resolutions/${r.id}`);
}
