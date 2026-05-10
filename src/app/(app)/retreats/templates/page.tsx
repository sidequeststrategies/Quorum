import Link from "next/link";
import { eq, isNull, or } from "drizzle-orm";
import { Sparkles, Tent } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { retreatTemplates } from "@/db/schema";
import { requireMembership } from "@/lib/session";

export default async function RetreatTemplatesPage() {
  const { membership } = await requireMembership();

  const templates = await db
    .select()
    .from(retreatTemplates)
    .where(or(eq(retreatTemplates.organizationId, membership.organizationId), isNull(retreatTemplates.organizationId)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Retreat templates</h1>
          <p className="text-muted-foreground">
            Pre-built blueprints. Pick one, set a date, and get a fully-staged retreat with agenda + intake form.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/retreats">Back to retreats</Link>
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No templates yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => {
            let agendaCount = 0;
            try {
              agendaCount = (JSON.parse(t.agenda) as unknown[]).length;
            } catch {
              /* noop */
            }
            return (
              <li key={t.id}>
                <Link
                  href={`/retreats/templates/${t.id}/use`}
                  className="block rounded-lg border p-5 transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {t.isGlobal ? <Badge variant="outline">Built-in</Badge> : null}
                  </div>
                  <div className="mt-3 text-lg font-semibold">{t.name}</div>
                  {t.tagline ? <p className="mt-1 text-sm text-muted-foreground">{t.tagline}</p> : null}
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Tent className="h-3 w-3" />
                      {agendaCount} agenda items
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
