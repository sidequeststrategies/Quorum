import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { financialPlans } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { createScenario } from "@/lib/actions/financials";
import { ScenarioForm } from "../../scenario-form";
import { DEFAULT_ASSUMPTIONS } from "@/lib/finance";

export default async function NewScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect(`/financials/${id}`);

  const planRows = await db
    .select()
    .from(financialPlans)
    .where(and(eq(financialPlans.id, id), eq(financialPlans.organizationId, membership.organizationId)))
    .limit(1);
  if (!planRows[0]) notFound();

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>New scenario for {planRows[0].name}</CardTitle>
        <CardDescription>Plug in your assumptions; we'll compute the projection and runway.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScenarioForm action={createScenario} planId={id} initial={DEFAULT_ASSUMPTIONS} />
      </CardContent>
    </Card>
  );
}
