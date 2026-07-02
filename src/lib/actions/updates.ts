"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teamUpdates, customers, customerUpdates, gtmUpdates } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { CUSTOMER_HEALTHS, CUSTOMER_STATUSES } from "@/lib/enums";
import { periodFromString } from "@/lib/utils";

// ---- Team updates (one per org per month) ----

const teamSchema = z.object({
  period: z.string().min(1),
  headline: z.string().max(300).default(""),
  body: z.string().default(""),
  hires: z.string().optional(),
  departures: z.string().optional(),
  openRoles: z.string().optional(),
  headcount: z.coerce.number().int().min(0).optional(),
});

export async function saveTeamUpdate(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = teamSchema.parse({
    period: formData.get("period"),
    headline: formData.get("headline") ?? "",
    body: formData.get("body") ?? "",
    hires: formData.get("hires") || undefined,
    departures: formData.get("departures") || undefined,
    openRoles: formData.get("openRoles") || undefined,
    headcount: formData.get("headcount") || undefined,
  });
  const period = periodFromString(parsed.period);

  const existing = await db
    .select()
    .from(teamUpdates)
    .where(and(eq(teamUpdates.organizationId, membership.organizationId), eq(teamUpdates.period, period)))
    .limit(1);

  const values = {
    headline: parsed.headline,
    body: parsed.body,
    hires: parsed.hires ?? null,
    departures: parsed.departures ?? null,
    openRoles: parsed.openRoles ?? null,
    headcount: parsed.headcount ?? null,
  };

  if (existing[0]) {
    await db.update(teamUpdates).set({ ...values, updatedAt: new Date() }).where(eq(teamUpdates.id, existing[0].id));
  } else {
    await db.insert(teamUpdates).values({
      organizationId: membership.organizationId,
      period,
      ...values,
      authorId: user.id,
    });
  }

  revalidatePath("/team");
  redirect("/team");
}

export async function deleteTeamUpdate(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(teamUpdates)
    .where(and(eq(teamUpdates.id, id), eq(teamUpdates.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.delete(teamUpdates).where(eq(teamUpdates.id, id));
  revalidatePath("/team");
}

// ---- Customers ----

const customerSchema = z.object({
  name: z.string().min(1).max(200),
  segment: z.string().optional(),
  region: z.string().optional(),
  arr: z.coerce.number().int().min(0).default(0),
  status: z.enum(CUSTOMER_STATUSES),
  ownerId: z.string().optional(),
  notes: z.string().optional(),
});

function parseCustomerForm(formData: FormData) {
  return customerSchema.parse({
    name: formData.get("name"),
    segment: formData.get("segment") || undefined,
    region: formData.get("region") || undefined,
    arr: formData.get("arr") ?? 0,
    status: formData.get("status") ?? "ACTIVE",
    ownerId: formData.get("ownerId") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

async function requireCustomer(id: string, organizationId: string) {
  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.organizationId, organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  return rows[0];
}

export async function createCustomer(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = parseCustomerForm(formData);
  await db.insert(customers).values({
    organizationId: membership.organizationId,
    name: parsed.name,
    segment: parsed.segment ?? null,
    region: parsed.region ?? null,
    arr: parsed.arr,
    status: parsed.status,
    ownerId: parsed.ownerId ?? null,
    notes: parsed.notes ?? null,
  });
  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  await requireCustomer(id, membership.organizationId);
  const parsed = parseCustomerForm(formData);
  await db
    .update(customers)
    .set({
      name: parsed.name,
      segment: parsed.segment ?? null,
      region: parsed.region ?? null,
      arr: parsed.arr,
      status: parsed.status,
      ownerId: parsed.ownerId ?? null,
      notes: parsed.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id));
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
}

export async function deleteCustomer(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  await requireCustomer(id, membership.organizationId);
  await db.delete(customers).where(eq(customers.id, id));
  revalidatePath("/customers");
  redirect("/customers");
}

const customerUpdateSchema = z.object({
  customerId: z.string().min(1),
  period: z.string().min(1),
  health: z.enum(CUSTOMER_HEALTHS),
  note: z.string().default(""),
});

export async function saveCustomerUpdate(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = customerUpdateSchema.parse({
    customerId: formData.get("customerId"),
    period: formData.get("period"),
    health: formData.get("health"),
    note: formData.get("note") ?? "",
  });
  await requireCustomer(parsed.customerId, membership.organizationId);
  const period = periodFromString(parsed.period);

  const existing = await db
    .select()
    .from(customerUpdates)
    .where(and(eq(customerUpdates.customerId, parsed.customerId), eq(customerUpdates.period, period)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(customerUpdates)
      .set({ health: parsed.health, note: parsed.note })
      .where(eq(customerUpdates.id, existing[0].id));
  } else {
    await db.insert(customerUpdates).values({
      customerId: parsed.customerId,
      period,
      health: parsed.health,
      note: parsed.note,
      authorId: user.id,
    });
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${parsed.customerId}`);
}

// ---- Sales & GTM (one per org per month) ----

const gtmSchema = z.object({
  period: z.string().min(1),
  headline: z.string().max(300).default(""),
  body: z.string().default(""),
  pipelineValue: z.coerce.number().int().min(0).default(0),
  qualifiedLeads: z.coerce.number().int().min(0).default(0),
  newWins: z.coerce.number().int().min(0).default(0),
  lostDeals: z.coerce.number().int().min(0).default(0),
  newArr: z.coerce.number().int().min(0).default(0),
});

export async function saveGtmUpdate(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = gtmSchema.parse({
    period: formData.get("period"),
    headline: formData.get("headline") ?? "",
    body: formData.get("body") ?? "",
    pipelineValue: formData.get("pipelineValue") ?? 0,
    qualifiedLeads: formData.get("qualifiedLeads") ?? 0,
    newWins: formData.get("newWins") ?? 0,
    lostDeals: formData.get("lostDeals") ?? 0,
    newArr: formData.get("newArr") ?? 0,
  });
  const period = periodFromString(parsed.period);

  const existing = await db
    .select()
    .from(gtmUpdates)
    .where(and(eq(gtmUpdates.organizationId, membership.organizationId), eq(gtmUpdates.period, period)))
    .limit(1);

  const values = {
    headline: parsed.headline,
    body: parsed.body,
    pipelineValue: parsed.pipelineValue,
    qualifiedLeads: parsed.qualifiedLeads,
    newWins: parsed.newWins,
    lostDeals: parsed.lostDeals,
    newArr: parsed.newArr,
  };

  if (existing[0]) {
    await db.update(gtmUpdates).set({ ...values, updatedAt: new Date() }).where(eq(gtmUpdates.id, existing[0].id));
  } else {
    await db.insert(gtmUpdates).values({
      organizationId: membership.organizationId,
      period,
      ...values,
      authorId: user.id,
    });
  }

  revalidatePath("/sales");
  redirect("/sales");
}

export async function deleteGtmUpdate(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(gtmUpdates)
    .where(and(eq(gtmUpdates.id, id), eq(gtmUpdates.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.delete(gtmUpdates).where(eq(gtmUpdates.id, id));
  revalidatePath("/sales");
}
