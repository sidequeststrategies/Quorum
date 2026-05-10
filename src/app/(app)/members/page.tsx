import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { memberships, users } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { initials, formatDateOnly } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/enums";

export default async function MembersPage() {
  const { membership } = await requireMembership();

  const rows = await db
    .select({
      id: memberships.id,
      role: memberships.role,
      title: memberships.title,
      organizationLabel: memberships.organizationLabel,
      votingRights: memberships.votingRights,
      termEnd: memberships.termEnd,
      createdAt: memberships.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.organizationId, membership.organizationId))
    .orderBy(asc(memberships.role), asc(memberships.createdAt));

  const isManager = canManage(membership.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Board members</h1>
          <p className="text-muted-foreground">
            Directors, observers, and admins for {membership.organization.name}.
          </p>
        </div>
        {isManager ? (
          <Button asChild>
            <Link href="/members/invite">Invite member</Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roster</CardTitle>
          <CardDescription>
            {rows.length} member{rows.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {rows.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(m.userName ?? m.userEmail)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{m.userName ?? m.userEmail}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.title ?? "—"}
                      {m.organizationLabel ? ` · ${m.organizationLabel}` : ""}
                      {m.termEnd ? ` · term ends ${formatDateOnly(m.termEnd)}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!m.votingRights ? <Badge variant="outline">Non-voting</Badge> : null}
                  <Badge variant={m.role === "OWNER" ? "default" : "secondary"}>
                    {ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
