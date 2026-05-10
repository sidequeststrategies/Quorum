import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Tent } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { retreats } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { formatDateOnly } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default async function RetreatsPage() {
  const { membership } = await requireMembership();

  const list = await db
    .select()
    .from(retreats)
    .where(eq(retreats.organizationId, membership.organizationId))
    .orderBy(desc(retreats.startDate));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Retreats</h1>
          <p className="text-muted-foreground">
            Plan offsites and leadership trainings — pull activities from your library, capture takeaways.
          </p>
        </div>
        {canManage(membership.role) ? (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/retreats/activities">Activity library</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/retreats/templates">Templates</Link>
            </Button>
            <Button asChild>
              <Link href="/retreats/new">New retreat</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>{list.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">No retreats yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((r) => (
                <li key={r.id}>
                  <Link href={`/retreats/${r.id}`} className="block rounded-lg border p-4 hover:bg-accent">
                    <div className="flex items-center gap-2">
                      <Tent className="h-5 w-5 text-primary" />
                      <Badge
                        variant={
                          r.status === "COMPLETED"
                            ? "success"
                            : r.status === "IN_PROGRESS"
                            ? "default"
                            : r.status === "CANCELLED"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    </div>
                    <div className="mt-3 font-medium">{r.title}</div>
                    {r.description ? (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                    ) : null}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {formatDateOnly(r.startDate)} – {formatDateOnly(r.endDate)}
                      {r.location ? ` · ${r.location}` : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
