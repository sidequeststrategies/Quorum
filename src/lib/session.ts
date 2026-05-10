import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { memberships, organizations } from "@/db/schema";
import type { Role } from "@/lib/enums";

export type SessionUser = { id: string; email: string; name?: string | null };

const ACTIVE_ORG_COOKIE = "quorum_active_org";

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  const email = session?.user?.email;
  if (!id || !email) redirect("/login");
  return { id, email, name: session?.user?.name };
}

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

export async function getCurrentMembership() {
  const user = await requireUser();
  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  let membership = activeOrgId ? await findMembership(user.id, activeOrgId) : null;
  if (!membership) {
    membership = await firstMembership(user.id);
  }
  return { user, membership };
}

export async function requireMembership() {
  const { user, membership } = await getCurrentMembership();
  if (!membership) redirect("/onboarding");
  return { user, membership };
}

export async function listMyMemberships(userId: string) {
  const rows = await db
    .select({ m: memberships, o: organizations })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(organizations.name));
  return rows.map((r) => ({ ...r.m, organization: r.o }));
}

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
