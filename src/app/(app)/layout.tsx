import { requireMembership } from "@/lib/session";
import { AppHeader } from "@/components/app-header";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, membership } = await requireMembership();
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        userId={user.id}
        orgId={membership.organizationId}
        orgName={membership.organization.name}
        userName={user.name}
        userEmail={user.email}
      />
      <div className="flex flex-1">
        <aside className="w-56 border-r bg-muted/20">
          <AppNav />
        </aside>
        <main className="flex-1 overflow-auto">
          <div className="container max-w-6xl py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
