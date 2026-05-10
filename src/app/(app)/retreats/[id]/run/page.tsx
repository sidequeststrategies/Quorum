import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { retreatAgendaItems, retreats } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { FacilitationClient } from "./facilitation-client";

export const dynamic = "force-dynamic";

export default async function RunRetreatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();

  const rows = await db
    .select()
    .from(retreats)
    .where(and(eq(retreats.id, id), eq(retreats.organizationId, membership.organizationId)))
    .limit(1);
  const retreat = rows[0];
  if (!retreat) notFound();

  const agenda = await db
    .select()
    .from(retreatAgendaItems)
    .where(eq(retreatAgendaItems.retreatId, retreat.id))
    .orderBy(asc(retreatAgendaItems.order));

  return (
    <FacilitationClient
      retreatId={retreat.id}
      retreatTitle={retreat.title}
      items={agenda.map((a) => ({
        id: a.id,
        order: a.order,
        title: a.title,
        description: a.description,
        durationMin: a.durationMin,
        facilitatorName: a.facilitatorName,
      }))}
    />
  );
}
