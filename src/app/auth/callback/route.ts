// OAuth callback for Supabase Auth (Google SSO). Supabase redirects here
// with a PKCE code after the provider round-trip; we exchange it for a
// session (cookies set via the server client) and land on the dashboard.

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  // Behind the Vercel rewrite the request URL's origin is the deployment
  // host. APP_ORIGIN pins the public domain explicitly; otherwise fall back
  // to the forwarded host.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const publicOrigin =
    process.env.APP_ORIGIN?.trim().replace(/\/+$/, "") ??
    (process.env.NODE_ENV === "development" || !forwardedHost
      ? origin
      : `${forwardedProto.split(",")[0]}://${forwardedHost.split(",")[0]}`);

  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${publicOrigin}${BASE_PATH}${next.startsWith("/") ? next : "/dashboard"}`);
    }
  }
  return NextResponse.redirect(`${publicOrigin}${BASE_PATH}/login?error=oauth`);
}
