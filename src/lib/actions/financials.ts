"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { financialPlans, financialScenarios } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { SCENARIO_KINDS } from "@/lib/enums";
import { DEFAULT_ASSUMPTIONS } from "@/lib/finance";

const planSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  horizonMonths: z.coerce.number().int().min(3).max(60),
  startingCash: z.coerce.number().int().min(0),
  startMonth: z.string().min(1),
});

export async function createPlan(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const parsed = planSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    horizonMonths: formData.get("horizonMonths") ?? 24,
    startingCash: formData.get("startingCash") ?? 0,
    startMonth: formData.get("startMonth"),
  });
  const [plan] = await db
    .insert(financialPlans)
    .values({
      organizationId: membership.organizationId,
      name: parsed.name,
      description: parsed.description ?? null,
      horizonMonths: parsed.horizonMonths,
      startingCash: parsed.startingCash,
      startMonth: new Date(parsed.startMonth + "-01"),
    })
    .returning();

  // Seed a Base scenario with defaults so the plan opens with something to look at
  await db.insert(financialScenarios).values({
    planId: plan.id,
    name: "Base case",
    kind: "BASE",
    assumptions: JSON.stringify(DEFAULT_ASSUMPTIONS),
    notes: "Default starting assumptions — edit in scenario detail.",
  });

  revalidatePath("/financials");
  redirect(`/financials/${plan.id}`);
}

const scenarioSchema = z.object({
  planId: z.string(),
  name: z.string().min(1),
  kind: z.enum(SCENARIO_KINDS),
  notes: z.string().optional(),
  startingMRR: z.coerce.number(),
  monthlyGrowthPct: z.coerce.number(),
  churnPct: z.coerce.number(),
  grossMarginPct: z.coerce.number(),
  monthlyOpexBase: z.coerce.number(),
  opexGrowthPct: z.coerce.number(),
  headcountStart: z.coerce.number().int(),
  monthlyHires: z.coerce.number(),
  avgFullyLoadedSalary: z.coerce.number(),
});

export async function createScenario(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const parsed = scenarioSchema.parse({
    planId: formData.get("planId"),
    name: formData.get("name"),
    kind: formData.get("kind"),
    notes: formData.get("notes") || undefined,
    startingMRR: formData.get("startingMRR"),
    monthlyGrowthPct: formData.get("monthlyGrowthPct"),
    churnPct: formData.get("churnPct"),
    grossMarginPct: formData.get("grossMarginPct"),
    monthlyOpexBase: formData.get("monthlyOpexBase"),
    opexGrowthPct: formData.get("opexGrowthPct"),
    headcountStart: formData.get("headcountStart"),
    monthlyHires: formData.get("monthlyHires"),
    avgFullyLoadedSalary: formData.get("avgFullyLoadedSalary"),
  });

  const planRows = await db
    .select()
    .from(financialPlans)
    .where(and(eq(financialPlans.id, parsed.planId), eq(financialPlans.organizationId, membership.organizationId)))
    .limit(1);
  if (!planRows[0]) throw new Error("Plan not found");

  await db.insert(financialScenarios).values({
    planId: parsed.planId,
    name: parsed.name,
    kind: parsed.kind,
    notes: parsed.notes ?? null,
    assumptions: JSON.stringify({
      startingMRR: parsed.startingMRR,
      monthlyGrowthPct: parsed.monthlyGrowthPct,
      churnPct: parsed.churnPct,
      grossMarginPct: parsed.grossMarginPct,
      monthlyOpexBase: parsed.monthlyOpexBase,
      opexGrowthPct: parsed.opexGrowthPct,
      headcountStart: parsed.headcountStart,
      monthlyHires: parsed.monthlyHires,
      avgFullyLoadedSalary: parsed.avgFullyLoadedSalary,
    }),
  });

  revalidatePath(`/financials/${parsed.planId}`);
  redirect(`/financials/${parsed.planId}`);
}

export async function updateScenario(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const id = String(formData.get("id"));
  const parsed = scenarioSchema.omit({ planId: true }).parse({
    name: formData.get("name"),
    kind: formData.get("kind"),
    notes: formData.get("notes") || undefined,
    startingMRR: formData.get("startingMRR"),
    monthlyGrowthPct: formData.get("monthlyGrowthPct"),
    churnPct: formData.get("churnPct"),
    grossMarginPct: formData.get("grossMarginPct"),
    monthlyOpexBase: formData.get("monthlyOpexBase"),
    opexGrowthPct: formData.get("opexGrowthPct"),
    headcountStart: formData.get("headcountStart"),
    monthlyHires: formData.get("monthlyHires"),
    avgFullyLoadedSalary: formData.get("avgFullyLoadedSalary"),
  });

  // ownership check via plan join
  const rows = await db
    .select({ s: financialScenarios, p: financialPlans })
    .from(financialScenarios)
    .innerJoin(financialPlans, eq(financialScenarios.planId, financialPlans.id))
    .where(and(eq(financialScenarios.id, id), eq(financialPlans.organizationId, membership.organizationId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Not found");

  await db
    .update(financialScenarios)
    .set({
      name: parsed.name,
      kind: parsed.kind,
      notes: parsed.notes ?? null,
      assumptions: JSON.stringify({
        startingMRR: parsed.startingMRR,
        monthlyGrowthPct: parsed.monthlyGrowthPct,
        churnPct: parsed.churnPct,
        grossMarginPct: parsed.grossMarginPct,
        monthlyOpexBase: parsed.monthlyOpexBase,
        opexGrowthPct: parsed.opexGrowthPct,
        headcountStart: parsed.headcountStart,
        monthlyHires: parsed.monthlyHires,
        avgFullyLoadedSalary: parsed.avgFullyLoadedSalary,
      }),
      updatedAt: new Date(),
    })
    .where(eq(financialScenarios.id, id));

  revalidatePath(`/financials/${row.p.id}`);
}

export async function deleteScenario(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select({ s: financialScenarios, p: financialPlans })
    .from(financialScenarios)
    .innerJoin(financialPlans, eq(financialScenarios.planId, financialPlans.id))
    .where(and(eq(financialScenarios.id, id), eq(financialPlans.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.delete(financialScenarios).where(eq(financialScenarios.id, id));
  revalidatePath(`/financials/${rows[0].p.id}`);
}
