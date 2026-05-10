import { notFound, redirect } from "next/navigation";
import { eq, isNull, or, and } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { retreatTemplates } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { useRetreatTemplate } from "@/lib/actions/retreats";

export default async function UseTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/retreats");

  const rows = await db
    .select()
    .from(retreatTemplates)
    .where(
      and(
        eq(retreatTemplates.id, id),
        or(eq(retreatTemplates.organizationId, membership.organizationId), isNull(retreatTemplates.organizationId))
      )
    )
    .limit(1);
  const tpl = rows[0];
  if (!tpl) notFound();

  type AgendaItem = { title: string; description?: string; durationMin: number };
  let agenda: AgendaItem[] = [];
  try {
    agenda = JSON.parse(tpl.agenda) as AgendaItem[];
  } catch {
    /* noop */
  }
  const totalMin = agenda.reduce((s, a) => s + (a.durationMin ?? 0), 0);

  // Default to next Monday at 9am local
  const d = new Date();
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
  d.setHours(9, 0, 0, 0);
  const defaultDateTime = d.toISOString().slice(0, 16);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <Badge variant="outline" className="mb-2 w-fit">Template</Badge>
          <CardTitle>{tpl.name}</CardTitle>
          {tpl.tagline ? <CardDescription>{tpl.tagline}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Agenda</h3>
          <div className="mt-3 text-xs text-muted-foreground">
            {agenda.length} items · {totalMin} minutes total ({Math.round((totalMin / 60) * 10) / 10} hours)
          </div>
          <ol className="mt-3 space-y-2">
            {agenda.map((item, idx) => (
              <li key={idx} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">
                    {idx + 1}. {item.title}
                  </div>
                  <div className="text-xs text-muted-foreground">{item.durationMin} min</div>
                </div>
                {item.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Set up your retreat</CardTitle>
          <CardDescription>We&apos;ll copy the agenda + philosophy and generate an intake link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={useRetreatTemplate} className="space-y-4">
            <input type="hidden" name="templateId" value={tpl.id} />
            <div className="space-y-2">
              <Label htmlFor="title">Retreat title</Label>
              <Input id="title" name="title" required placeholder="Acme Leadership Working Day" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date & time</Label>
              <Input id="startDate" name="startDate" type="datetime-local" defaultValue={defaultDateTime} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="Cavallo Point, Sausalito CA" />
            </div>
            <Button type="submit" className="w-full">
              Create retreat from this template
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
