import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { signIn, googleConfigured } from "@/auth";
import { getRequestOrigin, getSupabaseServer, supabaseConfigured } from "@/lib/supabase";
import { brand } from "@/lib/brand";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to the {brand.name} boardroom.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm searchParamsPromise={searchParams} />
        {!supabaseConfigured ? (
          <p className="mt-6 text-sm text-muted-foreground">
            New here?{" "}
            <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
            .
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.1 3.7-8.6Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1L1.2 17.2C3.1 21.2 7.2 24 12 24Z"
      />
      <path fill="#FBBC05" d="M5.1 14.3a7.3 7.3 0 0 1 0-4.6L1.2 6.8a12 12 0 0 0 0 10.4l3.9-2.9Z" />
      <path
        fill="#EA4335"
        d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17 1.1 15.2 0 12 0 7.2 0 3.1 2.8 1.2 6.8l3.9 2.9C6 6.8 8.8 4.7 12 4.7Z"
      />
    </svg>
  );
}

async function LoginForm({ searchParamsPromise }: { searchParamsPromise: Promise<{ error?: string }> }) {
  const sp = await searchParamsPromise;
  const error = sp.error;
  const showGoogle = supabaseConfigured || googleConfigured;

  async function loginAction(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    if (supabaseConfigured) {
      const supabase = await getSupabaseServer();
      const { error: sbError } = await supabase.auth.signInWithPassword({ email, password });
      if (sbError) redirect("/login?error=invalid");
      redirect("/dashboard");
    }

    try {
      await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    } catch (e) {
      if ((e as Error).message?.includes("NEXT_REDIRECT")) throw e;
      redirect("/login?error=invalid");
    }
  }

  async function googleAction() {
    "use server";
    if (supabaseConfigured) {
      const supabase = await getSupabaseServer();
      const origin = await getRequestOrigin();
      const { data, error: sbError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}${BASE_PATH}/auth/callback?next=/dashboard` },
      });
      if (sbError || !data?.url) redirect("/login?error=oauth");
      redirect(data.url);
    }
    await signIn("google", { redirectTo: "/dashboard" });
  }

  return (
    <div className="space-y-5">
      {showGoogle ? (
        <>
          <form action={googleAction}>
            <Button type="submit" variant="outline" className="w-full">
              <GoogleIcon />
              Continue with Google
            </Button>
          </form>
          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">or with password</span>
            <Separator className="flex-1" />
          </div>
        </>
      ) : null}
      <form action={loginAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        {error === "invalid" ? (
          <p className="text-sm text-destructive">Invalid email or password. Please try again.</p>
        ) : error === "oauth" ? (
          <p className="text-sm text-destructive">Google sign-in didn&rsquo;t complete. Please try again.</p>
        ) : error ? (
          <p className="text-sm text-destructive">
            Sign-in was not allowed. Google sign-in is limited to approved board members — ask the workspace
            owner to add your email.
          </p>
        ) : null}
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </div>
  );
}
