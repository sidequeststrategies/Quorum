import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signIn } from "@/auth";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your Quorum board.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm searchParamsPromise={searchParams} />
        <p className="mt-6 text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}

async function LoginForm({ searchParamsPromise }: { searchParamsPromise: Promise<{ error?: string }> }) {
  const sp = await searchParamsPromise;
  const error = sp.error;

  async function loginAction(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/dashboard",
      });
    } catch (e) {
      if ((e as Error).message?.includes("NEXT_REDIRECT")) throw e;
      redirect("/login?error=invalid");
    }
  }

  return (
    <form action={loginAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error ? (
        <p className="text-sm text-destructive">Invalid email or password. Please try again.</p>
      ) : null}
      <Button type="submit" className="w-full">
        Sign in
      </Button>
    </form>
  );
}
