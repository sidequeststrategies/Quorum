import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { customers, customerUpdates } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { CustomerStatusBadge, HealthDot } from "@/components/report-badges";
import { fmtUSD } from "@/lib/finance";
import { formatPeriod } from "@/lib/utils";

export default async function CustomersPage() {
  const { membership } = await requireMembership();

  const list = await db
    .select()
    .from(customers)
    .where(eq(customers.organizationId, membership.organizationId))
    .orderBy(desc(customers.arr));

  const ids = list.map((c) => c.id);
  const updates =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(customerUpdates)
          .where(inArray(customerUpdates.customerId, ids))
          .orderBy(desc(customerUpdates.period));

  const active = list.filter((c) => c.status === "ACTIVE" || c.status === "AT_RISK");
  const totalArr = active.reduce((s, c) => s + c.arr, 0);
  const atRisk = list.filter((c) => c.status === "AT_RISK").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Key customers</h1>
          <p className="text-muted-foreground">The accounts the board asks about, with a monthly health check.</p>
        </div>
        {canManage(membership.role) ? (
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New customer
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Tracked accounts" value={String(list.length)} />
        <SummaryCard label="ARR (active)" value={fmtUSD(totalArr, { compact: true })} />
        <SummaryCard label="At risk" value={String(atRisk)} danger={atRisk > 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>Latest health comes from the most recent monthly update.</CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customers tracked yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4">Customer</th>
                    <th className="py-2 pr-4">Segment</th>
                    <th className="py-2 pr-4">Region</th>
                    <th className="py-2 pr-4">ARR</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Health</th>
                    <th className="py-2">Last update</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => {
                    const latest = updates.find((u) => u.customerId === c.id);
                    return (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-2.5 pr-4">
                          <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                            {c.name}
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4">{c.segment ?? "—"}</td>
                        <td className="py-2.5 pr-4">{c.region ?? "—"}</td>
                        <td className="py-2.5 pr-4">{c.arr ? fmtUSD(c.arr, { compact: true }) : "—"}</td>
                        <td className="py-2.5 pr-4">
                          <CustomerStatusBadge status={c.status} />
                        </td>
                        <td className="py-2.5 pr-4">{latest ? <HealthDot health={latest.health} /> : "—"}</td>
                        <td className="py-2.5 text-muted-foreground">{latest ? formatPeriod(latest.period) : "never"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={danger ? "text-3xl font-bold text-destructive" : "text-3xl font-bold"}>{value}</p>
      </CardContent>
    </Card>
  );
}
