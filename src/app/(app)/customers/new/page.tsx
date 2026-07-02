import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canManage, listOrgMembers, requireMembership } from "@/lib/session";
import { createCustomer } from "@/lib/actions/updates";
import { CustomerForm } from "@/components/customer-form";

export default async function NewCustomerPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/customers");
  const members = await listOrgMembers(membership.organizationId);

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Track a key customer</CardTitle>
        <CardDescription>Add the accounts the board should see health on every month.</CardDescription>
      </CardHeader>
      <CardContent>
        <CustomerForm action={createCustomer} members={members} submitLabel="Add customer" />
      </CardContent>
    </Card>
  );
}
