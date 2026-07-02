import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { AlertTriangle, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { risks, users } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { RISK_CATEGORY_LABELS } from "@/lib/enums";
import { RiskSeverityBadge, RiskStatusBadge } from "@/components/report-badges";
import { formatDateOnly } from "@/lib/utils";

export default async function RisksPage() {
  const { membership } = await requireMembership();

  const rows = await db
    .select({ r: risks, ownerName: users.name, ownerEmail: users.email })
    .from(risks)
    .leftJoin(users, eq(risks.ownerId, users.id))
    .where(eq(risks.organizationId, membership.organizationId))
    .orderBy(desc(risks.updatedAt));

  const open = rows
    .filter(({ r }) => r.status !== "CLOSED")
    .sort((a, b) => b.r.likelihood * b.r.impact - a.r.likelihood * a.r.impact);
  const closed = rows.filter(({ r }) => r.status === "CLOSED");
  const high = open.filter(({ r }) => r.likelihood * r.impact >= 15);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Risk register</h1>
          <p className="text-muted-foreground">
            A living register — every risk carries over meeting to meeting until it&rsquo;s closed.
          </p>
        </div>
        {canManage(membership.role) ? (
          <Button asChild>
            <Link href="/risks/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New risk
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Open risks" value={open.length} icon={AlertTriangle} />
        <StatCard label="High severity (≥15)" value={high.length} icon={AlertTriangle} danger={high.length > 0} />
        <StatCard label="Closed" value={closed.length} icon={ShieldCheck} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open register</CardTitle>
          <CardDescription>Sorted by severity (likelihood × impact). Click a risk to review or update it.</CardDescription>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open risks. Add the first one to start the register.</p>
          ) : (
            <RiskTable rows={open} />
          )}
        </CardContent>
      </Card>

      {closed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Closed</CardTitle>
            <CardDescription>Kept for the record — the board sees what was retired and when.</CardDescription>
          </CardHeader>
          <CardContent>
            <RiskTable rows={closed} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  danger,
}: {
  label: string;
  value: number;
  icon: typeof AlertTriangle;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <Icon className={danger ? "h-6 w-6 text-destructive" : "h-6 w-6 text-brand-teal"} />
      </CardContent>
    </Card>
  );
}

function RiskTable({
  rows,
}: {
  rows: { r: typeof risks.$inferSelect; ownerName: string | null; ownerEmail: string | null }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-4">Risk</th>
            <th className="py-2 pr-4">Category</th>
            <th className="py-2 pr-4">L</th>
            <th className="py-2 pr-4">I</th>
            <th className="py-2 pr-4">Severity</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Owner</th>
            <th className="py-2">Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, ownerName, ownerEmail }) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
              <td className="py-2.5 pr-4">
                <Link href={`/risks/${r.id}`} className="font-medium text-primary hover:underline">
                  {r.title}
                </Link>
              </td>
              <td className="py-2.5 pr-4">{RISK_CATEGORY_LABELS[r.category] ?? r.category}</td>
              <td className="py-2.5 pr-4">{r.likelihood}</td>
              <td className="py-2.5 pr-4">{r.impact}</td>
              <td className="py-2.5 pr-4">
                <RiskSeverityBadge likelihood={r.likelihood} impact={r.impact} />
              </td>
              <td className="py-2.5 pr-4">
                <RiskStatusBadge status={r.status} />
              </td>
              <td className="py-2.5 pr-4">{ownerName ?? ownerEmail ?? "—"}</td>
              <td className="py-2.5 text-muted-foreground">{formatDateOnly(r.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
