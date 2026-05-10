import { notFound } from "next/navigation";
import { and, eq, isNull, or } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { db } from "@/lib/db";
import { reportTemplates } from "@/db/schema";
import { requireMembership } from "@/lib/session";

type Section = {
  id: string;
  title: string;
  kind: "text" | "rich" | "metric" | "checklist";
  prompt?: string;
  placeholder?: string;
};

const KIND_LABEL: Record<string, string> = {
  text: "Short text",
  rich: "Long-form",
  metric: "Metric line",
  checklist: "Checklist",
};

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();

  const rows = await db
    .select()
    .from(reportTemplates)
    .where(
      and(
        eq(reportTemplates.id, id),
        or(eq(reportTemplates.organizationId, membership.organizationId), isNull(reportTemplates.organizationId))
      )
    )
    .limit(1);
  const t = rows[0];
  if (!t) notFound();

  let sections: Section[] = [];
  try {
    sections = JSON.parse(t.sections) as Section[];
  } catch {
    /* noop */
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Badge variant="outline">Template</Badge>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{t.name}</h1>
          {t.description ? <p className="mt-1 text-sm text-muted-foreground">{t.description}</p> : null}
        </div>
        <Button asChild>
          <Link href={`/reports/new?templateId=${t.id}`}>Use this template</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
          <CardDescription>{sections.length} section{sections.length === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {sections.map((s, idx) => (
              <li key={s.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {idx + 1}. {s.title}
                  </span>
                  <Badge variant="secondary">{KIND_LABEL[s.kind] ?? s.kind}</Badge>
                </div>
                {s.prompt ? <p className="mt-1 text-sm text-muted-foreground">{s.prompt}</p> : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
