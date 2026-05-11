import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, Building2, Vote } from "lucide-react";
import { and, count, eq, gte, inArray, ne } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { meetings, resolutions } from "@/db/schema";
import { listMyMemberships, requireUser } from "@/lib/session";
import { switchOrganization } from "@/lib/actions/portfolio";
import { ROLE_LABELS } from "@/lib/enums";
import { signOut } from "@/auth";
import { initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await requireUser();
  const memberships = await listMyMemberships(user.id);

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  // Resolve stats for ALL orgs in 2 grouped queries (vs 2-per-org with the
  // per-row loop). For an advisor sitting on 5+ boards this is the difference
  // between ~12 round-trips and 3.
  const orgIds = memberships.map((m) => m.organizationId);
  const now = new Date();
  const [upcomingRows, openResRows] = orgIds.length
    ? await Promise.all([
        db
          .select({ orgId: meetings.organizationId, c: count() })
          .from(meetings)
          .where(
            and(
              inArray(meetings.organizationId, orgIds),
              gte(meetings.scheduledAt, now),
              ne(meetings.status, "CANCELLED")
            )
          )
          .groupBy(meetings.organizationId),
        db
          .select({ orgId: resolutions.organizationId, c: count() })
          .from(resolutions)
          .where(and(inArray(resolutions.organizationId, orgIds), eq(resolutions.status, "OPEN")))
          .groupBy(resolutions.organizationId),
      ])
    : [[], []];
  const upcomingByOrg = new Map(upcomingRows.map((r) => [r.orgId, r.c]));
  const openByOrg = new Map(openResRows.map((r) => [r.orgId, r.c]));
  const enriched = memberships.map((m) => ({
    membership: m,
    upcomingMeetings: upcomingByOrg.get(m.organizationId) ?? 0,
    openResolutions: openByOrg.get(m.organizationId) ?? 0,
  }));

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Portfolio</div>
              <div className="text-xs text-muted-foreground">{user.name ?? user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{initials(user.name ?? user.email)}</AvatarFallback>
            </Avatar>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="container max-w-5xl py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Your portfolio</h1>
          <p className="mt-1 text-muted-foreground">
            Companies you sit on the board of, advise, or operate. Pick one to enter that workspace.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {enriched.map(({ membership, upcomingMeetings, openResolutions }) => (
            <Card key={membership.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <Badge variant={membership.role === "OWNER" ? "default" : "secondary"}>
                      {ROLE_LABELS[membership.role as keyof typeof ROLE_LABELS] ?? membership.role}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="mt-3">{membership.organization.name}</CardTitle>
                {membership.title ? <CardDescription>{membership.title}</CardDescription> : null}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Upcoming meetings</div>
                    <div className="mt-1 text-xl font-semibold">{upcomingMeetings}</div>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Vote className="h-3 w-3" />
                      Open resolutions
                    </div>
                    <div className="mt-1 text-xl font-semibold">{openResolutions}</div>
                  </div>
                </div>
                <form action={switchOrganization}>
                  <input type="hidden" name="orgId" value={membership.organizationId} />
                  <Button type="submit" className="w-full">
                    Enter {membership.organization.name} →
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Need to add a company you advise?{" "}
          <span>An owner of that company invites you, and it appears here automatically.</span>
        </div>
      </main>
    </div>
  );
}
