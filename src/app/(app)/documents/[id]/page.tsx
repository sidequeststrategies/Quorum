import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { documents, meetings, users } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { deleteDocument } from "@/lib/actions/documents";

const VIS_LABEL: Record<string, string> = {
  ALL_MEMBERS: "All members",
  DIRECTORS_ONLY: "Directors only",
  PRIVATE: "Private",
};

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();

  const rows = await db
    .select({
      d: documents,
      uploaderName: users.name,
      uploaderEmail: users.email,
      meetingId: meetings.id,
      meetingTitle: meetings.title,
    })
    .from(documents)
    .innerJoin(users, eq(documents.uploadedById, users.id))
    .leftJoin(meetings, eq(documents.meetingId, meetings.id))
    .where(and(eq(documents.id, id), eq(documents.organizationId, membership.organizationId)))
    .limit(1);
  const row = rows[0];
  if (!row) notFound();
  const doc = row.d;

  if (doc.visibility === "DIRECTORS_ONLY" && !["OWNER", "DIRECTOR", "ADMIN"].includes(membership.role)) {
    notFound();
  }
  if (doc.visibility === "PRIVATE" && doc.uploadedById !== membership.userId && !canManage(membership.role)) {
    notFound();
  }

  const isImage = doc.mimeType.startsWith("image/");
  const isPdf = doc.mimeType === "application/pdf";

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{VIS_LABEL[doc.visibility] ?? doc.visibility}</Badge>
          {row.meetingId ? (
            <Badge variant="secondary">
              <Link href={`/meetings/${row.meetingId}`}>{row.meetingTitle}</Link>
            </Badge>
          ) : null}
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{doc.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {doc.filename} · uploaded {formatDate(doc.createdAt)} by {row.uploaderName ?? row.uploaderEmail}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>Or download the original.</CardDescription>
        </CardHeader>
        <CardContent>
          {doc.description ? <p className="mb-4 text-sm">{doc.description}</p> : null}
          {isPdf ? (
            <iframe src={doc.storagePath} className="h-[70vh] w-full rounded-md border" title={doc.title} />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.storagePath} alt={doc.title} className="max-h-[70vh] rounded-md border" />
          ) : (
            <p className="text-sm text-muted-foreground">Inline preview not available for this file type.</p>
          )}
          <div className="mt-4 flex gap-2">
            <Button asChild>
              <a href={doc.storagePath} target="_blank" rel="noreferrer" download={doc.filename}>
                Download
              </a>
            </Button>
            {canManage(membership.role) || doc.uploadedById === membership.userId ? (
              <form action={deleteDocument}>
                <input type="hidden" name="id" value={doc.id} />
                <Button type="submit" variant="destructive">
                  Delete
                </Button>
              </form>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
