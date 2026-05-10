import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import { memberships, users } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/enums";

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(ROLES),
  title: z.string().optional(),
  organizationLabel: z.string().optional(),
  votingRights: z.boolean(),
  tempPassword: z.string().min(8),
});

export default async function InviteMemberPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/members");

  async function inviteAction(formData: FormData) {
    "use server";
    const parsed = inviteSchema.safeParse({
      email: formData.get("email"),
      name: formData.get("name"),
      role: formData.get("role"),
      title: formData.get("title") || undefined,
      organizationLabel: formData.get("organizationLabel") || undefined,
      votingRights: formData.get("votingRights") === "on",
      tempPassword: formData.get("tempPassword"),
    });
    if (!parsed.success) {
      const msg = encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input");
      redirect(`/members/invite?error=${msg}`);
    }
    const { email, name, role, title, organizationLabel, votingRights, tempPassword } = parsed.data;
    const { membership: m } = await requireMembership();
    if (!canManage(m.role)) redirect("/members");

    const existingUserRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let userId: string;
    if (existingUserRows[0]) {
      userId = existingUserRows[0].id;
    } else {
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const [created] = await db.insert(users).values({ email, name, passwordHash }).returning();
      userId = created.id;
    }

    const existingMembershipRows = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, m.organizationId)))
      .limit(1);
    if (existingMembershipRows[0]) {
      redirect(`/members/invite?error=${encodeURIComponent("That person is already a member")}`);
    }

    await db.insert(memberships).values({
      userId,
      organizationId: m.organizationId,
      role,
      title: title ?? null,
      organizationLabel: organizationLabel ?? null,
      votingRights: role === "DIRECTOR" || role === "OWNER" ? votingRights : false,
    });

    redirect("/members");
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Invite a board member</CardTitle>
        <CardDescription>
          Add a director, observer, or admin. Share the temporary password with them in a separate channel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={inviteAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select name="role" defaultValue={"DIRECTOR" satisfies Role}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== "OWNER").map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" placeholder="e.g. Independent Director" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="organizationLabel">Affiliated org (optional)</Label>
            <Input id="organizationLabel" name="organizationLabel" placeholder="e.g. Sequoia Capital" />
          </div>
          <div className="flex items-center gap-2">
            <input id="votingRights" name="votingRights" type="checkbox" defaultChecked className="h-4 w-4" />
            <Label htmlFor="votingRights" className="cursor-pointer">
              Has voting rights
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tempPassword">Temporary password</Label>
            <Input
              id="tempPassword"
              name="tempPassword"
              type="text"
              minLength={8}
              required
              defaultValue={crypto.randomUUID().slice(0, 12)}
            />
            <p className="text-xs text-muted-foreground">Share this securely. They can change it after first login.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="submit">Add member</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
