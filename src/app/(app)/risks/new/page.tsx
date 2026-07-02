import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canManage, listOrgMembers, requireMembership } from "@/lib/session";
import { createRisk } from "@/lib/actions/risks";
import { RiskForm } from "@/components/risk-form";

export default async function NewRiskPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/risks");
  const members = await listOrgMembers(membership.organizationId);

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Add a risk to the register</CardTitle>
        <CardDescription>
          It stays on the register — and in every board pack — until it&rsquo;s closed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RiskForm action={createRisk} members={members} submitLabel="Add to register" />
      </CardContent>
    </Card>
  );
}
