import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { memberships, organizations } from "@/db/schema";
import type { Role } from "@/lib/enums";

export type SessionUser = { id: string; email: string; name?: string | null };

const ACTIVE_ORG_COOKIE = "quorum_active_org";

// React's cache() dedupes calls within a single render request. AppHeader,
// AppNav, and the page body all need the same user + membership data — without
// this they each issue their own DB query for identical data.
export const requireUser = cache(async (): Promise<SessionUser> => {
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
  if (!membership) redirect("/onboarding");
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
