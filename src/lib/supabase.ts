// Supabase Auth wiring (server side). Only used when the deployment points
// at a Supabase project — locally (PGlite, no Supabase) the app falls back
// to the NextAuth credentials login and none of this is exercised.

import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component render — safe to ignore, the
            // middleware refreshes sessions.
          }
        },
      },
    }
  );
}

// Public origin of the current request, used to build OAuth redirect URLs.
// Behind the assetcool.sidequeststrategies.com → vercel.app rewrite the
// forwarded headers can carry the internal deployment host, which would
// bounce the OAuth callback onto the wrong domain (cookies then live on the
// wrong host and the PKCE exchange fails). Set APP_ORIGIN to pin it:
//   APP_ORIGIN=https://assetcool.sidequeststrategies.com
export async function getRequestOrigin(): Promise<string> {
  const explicit = process.env.APP_ORIGIN;
  if (explicit) return explicit.replace(/\/+$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto.split(",")[0]}://${host.split(",")[0]}`;
}
