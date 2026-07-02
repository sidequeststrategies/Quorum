import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { meetings, reportTemplates, reports, users } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { ReportEditor, type ReportSection } from "./report-editor";
import { publishToBoardPack } from "@/lib/actions/reports";
import { pullReportFromNotionAction, syncReportToNotion } from "@/lib/actions/notion";
import { notionConfigured } from "@/lib/notion-sync";

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();

  const rows = await db
    .select({
      r: reports,
      tmpName: reportTemplates.name,
      tmpSections: reportTemplates.sections,
      authorName: users.name,
      authorEmail: users.email,
      meetingId: meetings.id,
      meetingTitle: meetings.title,
    })
    .from(reports)
    .innerJoin(users, eq(reports.authorId, users.id))
    .leftJoin(reportTemplates, eq(reports.templateId, reportTemplates.id))
    .leftJoin(meetings, eq(reports.meetingId, meetings.id))
    .where(and(eq(reports.id, id), eq(reports.organizationId, membership.organizationId)))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();

  let sections: ReportSection[] = [];
  if (row.tmpSections) {
    try {
      sections = JSON.parse(row.tmpSections) as ReportSection[];
    } catch {
      /* noop */
    }
  }

  let values: Record<string, string> = {};
  try {
    values = JSON.parse(row.r.values) as Record<string, string>;
  } catch {
    /* noop */
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Badge variant={row.r.status === "PUBLISHED" ? "success" : "secondary"}>
            {row.r.status === "PUBLISHED" ? "Published" : "Draft"}
          </Badge>
          {row.tmpName ? <Badge variant="outline">{row.tmpName}</Badge> : null}
          {row.meetingId ? (
            <Badge variant="outline">
              <Link href={`/meetings/${row.meetingId}`}>{row.meetingTitle}</Link>
            </Badge>
          ) : null}
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{row.r.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          By {row.authorName ?? row.authorEmail} · last updated {formatDate(row.r.updatedAt)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Editor</CardTitle>
          <CardDescription>Fill out each section. Changes save when you press Save draft.</CardDescription>
        </CardHeader>
        <CardContent>
          <ReportEditor
            reportId={row.r.id}
            status={row.r.status}
            sections={sections}
            initialValues={values}
          />
        </CardContent>
      </Card>

      {notionConfigured && sections.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Notion sync</CardTitle>
            <CardDescription>
              Push writes this report to a Notion page (one heading per section) so it can be edited in Notion —
              by hand or with Claude via the Notion MCP server. Pull brings those edits back here.
              {row.r.notionSyncedAt ? ` Last synced ${formatDate(row.r.notionSyncedAt)}.` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <form action={syncReportToNotion}>
              <input type="hidden" name="id" value={row.r.id} />
              <Button type="submit">{row.r.notionPageId ? "Push to Notion (overwrite page)" : "Push to Notion"}</Button>
            </form>
            {row.r.notionPageId ? (
              <>
                <form action={pullReportFromNotionAction}>
                  <input type="hidden" name="id" value={row.r.id} />
                  <Button type="submit" variant="outline">
                    Pull from Notion (overwrite sections here)
                  </Button>
                </form>
                <Button asChild variant="ghost">
                  <a
                    href={`https://www.notion.so/${row.r.notionPageId.replace(/-/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Notion ↗
                  </a>
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {row.meetingId ? (
        <Card>
          <CardHeader>
            <CardTitle>Send to board pack</CardTitle>
            <CardDescription>
              Publishes a snapshot of this report as a document attached to{" "}
              <Link href={`/meetings/${row.meetingId}`} className="text-primary hover:underline">
                {row.meetingTitle}
              </Link>
              . Re-publish anytime to refresh.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <form action={publishToBoardPack}>
              <input type="hidden" name="id" value={row.r.id} />
              <Button type="submit">
                {row.r.boardPackDocumentId ? "Re-publish to board pack" : "Publish to board pack"}
              </Button>
            </form>
            {row.r.boardPackDocumentId ? (
              <Button asChild variant="outline">
                <Link href={`/documents/${row.r.boardPackDocumentId}`}>View in board pack</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
