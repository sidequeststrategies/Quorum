import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canManage, listOrgMembers, requireMembership } from "@/lib/session";
import { createProject } from "@/lib/actions/projects";
import { ProjectForm } from "@/components/project-form";

export default async function NewProjectPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/projects");
  const members = await listOrgMembers(membership.organizationId);

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>New project / initiative</CardTitle>
        <CardDescription>Add a workstream the board should see every month.</CardDescription>
      </CardHeader>
      <CardContent>
        <ProjectForm action={createProject} members={members} submitLabel="Create project" />
      </CardContent>
    </Card>
  );
}
