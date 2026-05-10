import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { retreatIntakeResponses, retreats } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { LEADERSHIP_DAY_INTAKE } from "@/db/seed-content";

export default async function IntakeResponsePage({
  params,
}: {
  params: Promise<{ id: string; responseId: string }>;
}) {
  const { id, responseId } = await params;
  const { membership } = await requireMembership();

  const rows = await db
    .select({ r: retreatIntakeResponses, retreat: retreats })
    .from(retreatIntakeResponses)
    .innerJoin(retreats, eq(retreatIntakeResponses.retreatId, retreats.id))
    .where(
      and(
        eq(retreatIntakeResponses.id, responseId),
        eq(retreats.id, id),
        eq(retreats.organizationId, membership.organizationId)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) notFound();

  let answers: Record<string, string | string[] | number> = {};
  try {
    answers = JSON.parse(row.r.answers) as typeof answers;
  } catch {
    /* noop */
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{row.r.participantName}</h1>
          <p className="text-sm text-muted-foreground">
            {row.r.participantRole}
            {row.r.participantEmail ? ` · ${row.r.participantEmail}` : ""} · submitted {formatDate(row.r.submittedAt)}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/retreats/${id}`}>← Back to retreat</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Responses</CardTitle>
          <CardDescription>For: {row.retreat.title}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-4">
            {LEADERSHIP_DAY_INTAKE.map((field) => {
              const v = answers[field.id];
              if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null;
              return (
                <div key={field.id}>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {field.label}
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm">
                    {Array.isArray(v) ? v.join(", ") : String(v)}
                  </dd>
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
