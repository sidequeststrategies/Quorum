import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { financialPlans, financialScenarios } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { DEFAULT_ASSUMPTIONS, type ScenarioAssumptions } from "@/lib/finance";
import { deleteScenario, updateScenario } from "@/lib/actions/financials";
import { ScenarioForm } from "../../scenario-form";

export default async function ScenarioEditPage({
  params,
}: {
  params: Promise<{ id: string; scenarioId: string }>;
}) {
  const { id, scenarioId } = await params;
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect(`/financials/${id}`);

  const rows = await db
    .select({ s: financialScenarios, p: financialPlans })
    .from(financialScenarios)
    .innerJoin(financialPlans, eq(financialScenarios.planId, financialPlans.id))
    .where(
      and(
        eq(financialScenarios.id, scenarioId),
        eq(financialPlans.id, id),
        eq(financialPlans.organizationId, membership.organizationId)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) notFound();

  let initial: ScenarioAssumptions = DEFAULT_ASSUMPTIONS;
  try {
    initial = { ...DEFAULT_ASSUMPTIONS, ...(JSON.parse(row.s.assumptions) as ScenarioAssumptions) };
  } catch {
    /* noop */
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Edit scenario</h1>
        <Button asChild variant="outline">
          <Link href={`/financials/${id}`}>← Back to plan</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{row.s.name}</CardTitle>
          <CardDescription>Plan: {row.p.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <ScenarioForm
            action={updateScenario}
            scenarioId={row.s.id}
            defaultName={row.s.name}
            defaultKind={row.s.kind}
            defaultNotes={row.s.notes ?? undefined}
            initial={initial}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Permanently delete this scenario.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={deleteScenario}>
            <input type="hidden" name="id" value={row.s.id} />
            <Button type="submit" variant="destructive" size="sm">
              Delete scenario
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
