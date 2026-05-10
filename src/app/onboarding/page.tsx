import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { memberships, organizations } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { signOut } from "@/auth";

export default async function OnboardingPage() {
  const user = await requireUser();
  const existing = await db.select().from(memberships).where(eq(memberships.userId, user.id)).limit(1);
  if (existing[0]) redirect("/dashboard");

  async function createOrg(formData: FormData) {
    "use server";
    const u = await requireUser();
    const orgName = String(formData.get("orgName") || "").trim();
    if (orgName.length < 2) throw new Error("Org name required");

    let slug = slugify(orgName);
    let n = 1;
    while ((await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1))[0]) {
      n += 1;
      slug = `${slugify(orgName)}-${n}`;
    }

    const [org] = await db.insert(organizations).values({ name: orgName, slug }).returning();
    await db.insert(memberships).values({
      userId: u.id,
      organizationId: org.id,
      role: "OWNER",
      title: "Founder",
      votingRights: true,
    });
    redirect("/dashboard");
  }

  async function logoutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="container flex min-h-screen items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>One more step</CardTitle>
          <CardDescription>
            You&apos;re not part of any board workspace yet. Create one or ask an admin to invite you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createOrg} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Company name</Label>
              <Input id="orgName" name="orgName" required placeholder="Acme, Inc." />
            </div>
            <Button type="submit" className="w-full">
              Create workspace
            </Button>
          </form>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">
              Back to home
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
