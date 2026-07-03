import { revalidatePath } from "next/cache";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { organizations } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";

export default async function SettingsPage() {
  const { membership } = await requireMembership();
  const isManager = canManage(membership.role);

  async function updateOrg(formData: FormData) {
    "use server";
    const { membership: m } = await requireMembership();
    if (!canManage(m.role)) throw new Error("Forbidden");
    await db
      .update(organizations)
      .set({
        name: String(formData.get("name") || m.organization.name),
        legalName: String(formData.get("legalName") || "") || null,
        jurisdiction: String(formData.get("jurisdiction") || "") || null,
      })
      .where(eq(organizations.id, m.organizationId));
    revalidatePath("/settings");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Workspace-level preferences for {membership.organization.name}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Used in headers, minutes, and resolution records.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateOrg} className="space-y-4">
            <fieldset disabled={!isManager} className="space-y-4 disabled:opacity-60">
              <div className="space-y-2">
                <Label htmlFor="name">Display name</Label>
                <Input id="name" name="name" defaultValue={membership.organization.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalName">Legal name</Label>
                <Input
                  id="legalName"
                  name="legalName"
                  defaultValue={membership.organization.legalName ?? ""}
                  placeholder="Acme, Inc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jurisdiction">Jurisdiction</Label>
                <Input
                  id="jurisdiction"
                  name="jurisdiction"
                  defaultValue={membership.organization.jurisdiction ?? ""}
                  placeholder="Delaware, USA"
                />
              </div>
              {isManager ? (
                <div className="flex justify-end">
                  <Button type="submit">Save</Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Only owners and admins can change these.</p>
              )}
            </fieldset>
          </form>
        </CardContent>
      </Card>

      {isManager ? (
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Audit trail of file downloads, uploads, and report changes.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/activity">
                <ShieldCheck className="mr-1 h-4 w-4" />
                View activity log
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
