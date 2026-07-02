"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { financialPlans, financialScenarios, forecastSnapshots, meetings } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { projectScenario, type ScenarioAssumptions } from "@/lib/finance";

// Capture the forward view as it stands at this meeting: copies the chosen
// scenario's assumptions into an immutable snapshot with headline outputs,
// so future meetings can show how the forecast moved.
export async function captureForecast(formData: FormData) {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");

  const meetingId = String(formData.get("meetingId"));
  const scenarioId = String(formData.get("scenarioId"));

  const meetingRows = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.organizationId, membership.organizationId)))
    .limit(1);
  if (!meetingRows[0]) throw new Error("Meeting not found");

  const scenarioRows = await db
    .select({ s: financialScenarios, p: financialPlans })
    .from(financialScenarios)
    .innerJoin(financialPlans, eq(financialScenarios.planId, financialPlans.id))
    .where(and(eq(financialScenarios.id, scenarioId), eq(financialPlans.organizationId, membership.organizationId)))
    .limit(1);
  const row = scenarioRows[0];
  if (!row) throw new Error("Scenario not found");

  const assumptions = JSON.parse(row.s.assumptions) as ScenarioAssumptions;
  const projection = projectScenario(row.p.startingCash, row.p.startMonth, row.p.horizonMonths, assumptions);

  const name = row.s.name;
  const values = {
    sourceScenarioId: row.s.id,
    assumptions: row.s.assumptions,
    startingCash: row.p.startingCash,
    startMonth: row.p.startMonth,
    horizonMonths: row.p.horizonMonths,
    runwayMonths: projection.runwayMonths,
    endingArr: projection.endingARR,
    endingCash: projection.endingCash,
    breakevenMonth: projection.breakevenMonth,
  };

  const existing = await db
    .select()
    .from(forecastSnapshots)
    .where(and(eq(forecastSnapshots.meetingId, meetingId), eq(forecastSnapshots.name, name)))
    .limit(1);

  if (existing[0]) {
    await db.update(forecastSnapshots).set(values).where(eq(forecastSnapshots.id, existing[0].id));
  } else {
    await db.insert(forecastSnapshots).values({
      organizationId: membership.organizationId,
      meetingId,
      name,
      ...values,
      createdById: user.id,
    });
  }

  revalidatePath(`/meetings/${meetingId}/pack`);
}

export async function deleteForecastSnapshot(formData: FormData) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Forbidden");
  const id = String(formData.get("id"));
  const rows = await db
    .select()
    .from(forecastSnapshots)
    .where(and(eq(forecastSnapshots.id, id), eq(forecastSnapshots.organizationId, membership.organizationId)))
    .limit(1);
  if (!rows[0]) throw new Error("Not found");
  await db.delete(forecastSnapshots).where(eq(forecastSnapshots.id, id));
  revalidatePath(`/meetings/${rows[0].meetingId}/pack`);
}
