import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canManage, requireMembership } from "@/lib/session";
import { createTemplate } from "@/lib/actions/reports";
import { TemplateBuilder } from "./template-builder";

export default async function NewTemplatePage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/reports");

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader>
        <CardTitle>New template</CardTitle>
        <CardDescription>
          Build a reusable structure for a recurring report — CEO update, fundraising memo, product review, etc.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TemplateBuilder action={createTemplate} />
      </CardContent>
    </Card>
  );
}
