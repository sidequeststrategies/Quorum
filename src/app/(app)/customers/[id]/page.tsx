import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import { customers, customerUpdates, users } from "@/db/schema";
import { canManage, listOrgMembers, requireMembership } from "@/lib/session";
import { deleteCustomer, saveCustomerUpdate, updateCustomer } from "@/lib/actions/updates";
import { CustomerForm } from "@/components/customer-form";
import { CustomerStatusBadge, HealthDot } from "@/components/report-badges";
import { CUSTOMER_HEALTHS, CUSTOMER_HEALTH_LABELS } from "@/lib/enums";
import { currentPeriodString, formatPeriod } from "@/lib/utils";
import { fmtUSD } from "@/lib/finance";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();

  const rows = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.organizationId, membership.organizationId)))
    .limit(1);
  const customer = rows[0];
  if (!customer) notFound();

  const [members, updates] = await Promise.all([
    listOrgMembers(membership.organizationId),
    db
      .select({ u: customerUpdates, authorName: users.name, authorEmail: users.email })
      .from(customerUpdates)
      .leftJoin(users, eq(customerUpdates.authorId, users.id))
      .where(eq(customerUpdates.customerId, id))
      .orderBy(desc(customerUpdates.period)),
  ]);

  const manager = canManage(membership.role);
  const thisMonth = updates.find((x) => formatPeriod(x.u.period) === formatPeriod(new Date()))?.u;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
            <CustomerStatusBadge status={customer.status} />
          </div>
          <p className="mt-1 text-muted-foreground">
            {[customer.segment, customer.region, customer.arr ? fmtUSD(customer.arr, { compact: true }) + " ARR" : null]
              .filter(Boolean)
              .join(" · ") || "No details yet"}
          </p>
        </div>
        {manager ? (
          <form action={deleteCustomer}>
            <input type="hidden" name="id" value={customer.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {manager ? (
            <Card>
              <CardHeader>
                <CardTitle>{thisMonth ? "Edit this month's health check" : "Monthly health check"}</CardTitle>
                <CardDescription>One per month; it rolls into the board pack&rsquo;s customer section.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={saveCustomerUpdate} className="space-y-4">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cu-period">Period</Label>
                      <Input id="cu-period" name="period" type="month" defaultValue={currentPeriodString()} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cu-health">Health</Label>
                      <Select name="health" defaultValue={thisMonth?.health ?? updates[0]?.u.health ?? "GREEN"}>
                        <SelectTrigger id="cu-health">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CUSTOMER_HEALTHS.map((h) => (
                            <SelectItem key={h} value={h}>
                              {CUSTOMER_HEALTH_LABELS[h]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cu-note">Note</Label>
                    <Textarea
                      id="cu-note"
                      name="note"
                      rows={3}
                      defaultValue={thisMonth?.note ?? ""}
                      placeholder="Renewal state, expansion, escalations, champion changes."
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">Save health check</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Health history</CardTitle>
            </CardHeader>
            <CardContent>
              {updates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No monthly updates yet.</p>
              ) : (
                <ol className="space-y-4">
                  {updates.map(({ u, authorName, authorEmail }) => (
                    <li key={u.id} className="border-l-2 border-brand-teal/40 pl-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-medium">{formatPeriod(u.period)}</span>
                        <HealthDot health={u.health} />
                        <span className="text-xs text-muted-foreground">{authorName ?? authorEmail}</span>
                      </div>
                      {u.note ? <p className="mt-1 text-sm text-muted-foreground">{u.note}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {manager ? (
          <Card>
            <CardHeader>
              <CardTitle>Account settings</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomerForm action={updateCustomer} customer={customer} members={members} submitLabel="Save changes" />
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
