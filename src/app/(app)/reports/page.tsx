import Link from "next/link";
import { desc, eq, isNull, or } from "drizzle-orm";
import { ClipboardList, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { meetings, reportTemplates, reports, users } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export default async function ReportsPage() {
  const { membership } = await requireMembership();
  const orgId = membership.organizationId;

  const [reportRows, templates] = await Promise.all([
    db
      .select({
        id: reports.id,
        title: reports.title,
        status: reports.status,
        updatedAt: reports.updatedAt,
        authorName: users.name,
        authorEmail: users.email,
        meetingTitle: meetings.title,
        templateName: reportTemplates.name,
      })
      .from(reports)
      .innerJoin(users, eq(reports.authorId, users.id))
      .leftJoin(meetings, eq(reports.meetingId, meetings.id))
      .leftJoin(reportTemplates, eq(reports.templateId, reportTemplates.id))
      .where(eq(reports.organizationId, orgId))
      .orderBy(desc(reports.updatedAt)),
    db
      .select()
      .from(reportTemplates)
      .where(or(eq(reportTemplates.organizationId, orgId), isNull(reportTemplates.organizationId)))
      .orderBy(desc(reportTemplates.updatedAt)),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Templated board reports — draft once, reuse every quarter.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/reports/templates/new">New template</Link>
          </Button>
          <Button asChild>
            <Link href="/reports/new">New report</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent reports</CardTitle>
          <CardDescription>{reportRows.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {reportRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet — pick a template to get started.</p>
          ) : (
            <ul className="divide-y">
              {reportRows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/reports/${r.id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-3 hover:bg-accent"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-md border bg-background p-2">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{r.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.templateName ? `Template: ${r.templateName} · ` : ""}
                          by {r.authorName ?? r.authorEmail} · {formatDate(r.updatedAt)}
                          {r.meetingTitle ? ` · for ${r.meetingTitle}` : ""}
                        </div>
                      </div>
                    </div>
                    <Badge variant={r.status === "PUBLISHED" ? "success" : "secondary"}>
                      {r.status === "PUBLISHED" ? "Published" : "Draft"}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>{templates.length} available</CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {templates.map((t) => {
                let count = 0;
                try {
                  count = (JSON.parse(t.sections) as unknown[]).length;
                } catch {
                  /* noop */
                }
                return (
                  <li key={t.id}>
                    <Link
                      href={`/reports/templates/${t.id}`}
                      className="flex items-start gap-3 rounded-md border p-3 hover:bg-accent"
                    >
                      <ClipboardList className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{t.name}</div>
                        {t.description ? (
                          <div className="text-xs text-muted-foreground">{t.description}</div>
                        ) : null}
                        <div className="mt-1 text-xs text-muted-foreground">
                          {count} section{count === 1 ? "" : "s"}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
