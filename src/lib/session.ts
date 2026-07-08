import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { memberships, organizations, users } from "@/db/schema";
import { getSupabaseServer, supabaseConfigured } from "@/lib/supabase";
import { pipelineReportGuest, ssoEmailAllowed } from "@/lib/access";
import type { Role } from "@/lib/enums";

export type SessionUser = { id: string; email: string; name?: string | null };

const ACTIVE_ORG_COOKIE = "quorum_active_org";

// React's cache() dedupes calls within a single render request. AppHeader,
// AppNav, and the page body all need the same user + membership data — without
// this they each issue their own DB query for identical data.
//
// Two auth modes:
//   - Supabase configured → the Supabase Auth session (Google SSO) is the
//     source of truth. On first sign-in an app user row is provisioned,
//     gated by the SSO allowlist; already-provisioned users (e.g. invited
//     members) always get through.
//   - Otherwise → NextAuth credentials (local dev / demo instances).
// Cheap "is anyone signed in" check for public pages (no provisioning).
export const hasActiveSession = cache(async (): Promise<boolean> => {
  if (supabaseConfigured) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.auth.getUser();
    return !!data.user;
  }
  const session = await auth();
  return !!session?.user;
});

export const requireUser = cache(async (): Promise<SessionUser> => {
  if (supabaseConfigured) {
    const supabase = await getSupabaseServer();
    const { data } = await supabase.auth.getUser();
    const sUser = data.user;
    if (!sUser?.email) redirect("/login");
    const email = sUser.email.toLowerCase();

    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let user = found[0];
    if (!user) {
      if (!ssoEmailAllowed(email)) {
        await supabase.auth.signOut();
        redirect("/login?error=denied");
      }
      const meta = (sUser.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string };
      const inserted = await db
        .insert(users)
        .values({
          email,
          name: meta.full_name ?? meta.name ?? null,
          image: meta.avatar_url ?? null,
          emailVerified: new Date(),
        })
        .returning();
      user = inserted[0];
    }
    return { id: user.id, email: user.email, name: user.name };
  }

  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  const email = session?.user?.email;
  if (!id || !email) redirect("/login");
  return { id, email, name: session?.user?.name };
});

async function findMembership(userId: string, orgId: string) {
  const rows = await db
    .select({ m: memberships, o: organizations })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, orgId)))
    .limit(1);
  const r = rows[0];
  return r ? { ...r.m, organization: r.o } : null;
}

async function firstMembership(userId: string) {
  const rows = await db
    .select({ m: memberships, o: organizations })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.createdAt))
    .limit(1);
  const r = rows[0];
  return r ? { ...r.m, organization: r.o } : null;
}

export const getCurrentMembership = cache(async () => {
  const user = await requireUser();
  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  let membership = activeOrgId ? await findMembership(user.id, activeOrgId) : null;
  if (!membership) {
    membership = await firstMembership(user.id);
  }
  return { user, membership };
});

export async function requireMembership() {
  const { user, membership } = await getCurrentMembership();
  if (!membership) {
    // Pipeline-report guests are confined to that one page; everyone else
    // without a workspace goes through onboarding.
    redirect(pipelineReportGuest(user.email) ? "/pipelinereport" : "/onboarding");
  }
  return { user, membership };
}

// Memoize per-userId. AppHeader calls this on every authenticated render to
// decide whether to show the org switcher; pages may also call it. One DB hit
// per request instead of two.
export const listMyMemberships = cache(async (userId: string) => {
  const rows = await db
    .select({ m: memberships, o: organizations })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(organizations.name));
  return rows.map((r) => ({ ...r.m, organization: r.o }));
});

// Members of an org, for owner/presenter dropdowns.
export const listOrgMembers = cache(async (organizationId: string) => {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.organizationId, organizationId))
    .orderBy(asc(users.name));
  return rows;
});

// Internal helpers used by the action in /lib/actions/portfolio.ts
export const ACTIVE_ORG_COOKIE_NAME = ACTIVE_ORG_COOKIE;
export { findMembership };

export function canManage(role: string) {
  return role === "OWNER" || role === "ADMIN";
}

export function canVote(role: string, votingRights: boolean) {
  return votingRights && (role === "OWNER" || role === "DIRECTOR");
}

export type { Role };
