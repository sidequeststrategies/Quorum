import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { memberships, organizations, users } from "@/db/schema";
import { signIn } from "@/auth";
import { supabaseConfigured } from "@/lib/supabase";
import { slugify } from "@/lib/utils";

const signupSchema = z.object({
  name: z.string().min(2, "Tell us your name"),
  email: z.string().email(),
  password: z.string().min(8, "Use at least 8 characters"),
  orgName: z.string().min(2, "Company name"),
});

export default function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // On SSO deployments accounts are provisioned automatically on first
  // Google sign-in (allowlist-gated) — password signup stays off.
  if (supabaseConfigured) redirect("/login");
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Start your board</CardTitle>
        <CardDescription>Create your founder account and your company workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm searchParamsPromise={searchParams} />
        <p className="mt-6 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Log in
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}

async function SignupForm({ searchParamsPromise }: { searchParamsPromise: Promise<{ error?: string }> }) {
  const sp = await searchParamsPromise;
  const error = sp.error;

  async function signupAction(formData: FormData) {
    "use server";
    const parsed = signupSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      orgName: formData.get("orgName"),
    });
    if (!parsed.success) {
      const msg = encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input");
      redirect(`/signup?error=${msg}`);
    }
    const { name, email, password, orgName } = parsed.data;

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) redirect(`/signup?error=${encodeURIComponent("That email is already registered")}`);

    const passwordHash = await bcrypt.hash(password, 10);

    let slug = slugify(orgName);
    let n = 1;
    while ((await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1))[0]) {
      n += 1;
      slug = `${slugify(orgName)}-${n}`;
    }

    const [createdUser] = await db.insert(users).values({ name, email, passwordHash }).returning();
    const [createdOrg] = await db.insert(organizations).values({ name: orgName, slug }).returning();
    await db.insert(memberships).values({
      userId: createdUser.id,
      organizationId: createdOrg.id,
      role: "OWNER",
      title: "Founder & CEO",
      votingRights: true,
    });

    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  }

  return (
    <form action={signupAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" required autoComplete="name" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="orgName">Company name</Label>
        <Input id="orgName" name="orgName" required placeholder="Acme, Inc." />
      </div>
      {error ? <p className="text-sm text-destructive">{decodeURIComponent(error)}</p> : null}
      <Button type="submit" className="w-full">
        Create account
      </Button>
    </form>
  );
}
