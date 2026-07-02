import Link from "next/link";
import { Briefcase } from "lucide-react";
import { BrandMark } from "@/components/brand-logo";
import { brand } from "@/lib/brand";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { listMyMemberships } from "@/lib/session";
import { OrgSwitcher } from "./org-switcher";

type Props = {
  userId: string;
  orgId: string;
  orgName: string;
  userName?: string | null;
  userEmail: string;
};

export async function AppHeader({ userId, orgId, orgName, userName, userEmail }: Props) {
  const memberships = await listMyMemberships(userId);
  const hasMultiple = memberships.length > 1;

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <BrandMark />
          <span>{brand.name}</span>
        </Link>
        <span className="text-muted-foreground">/</span>
        {hasMultiple ? (
          <OrgSwitcher
            currentOrgId={orgId}
            currentOrgName={orgName}
            options={memberships.map((m) => ({
              id: m.organizationId,
              name: m.organization.name,
              role: m.role,
            }))}
          />
        ) : (
          <span className="text-sm font-medium">{orgName}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {hasMultiple ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/portfolio">
              <Briefcase className="mr-1.5 h-4 w-4" />
              Portfolio
            </Link>
          </Button>
        ) : null}
        <div className="text-right text-sm">
          <div className="font-medium">{userName ?? userEmail}</div>
          {userName ? <div className="text-xs text-muted-foreground">{userEmail}</div> : null}
        </div>
        <Avatar>
          <AvatarFallback>{initials(userName ?? userEmail)}</AvatarFallback>
        </Avatar>
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
