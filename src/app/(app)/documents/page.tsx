import Link from "next/link";
import { FileText } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { documents, meetings, users } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { formatDateOnly } from "@/lib/utils";

const VIS_LABEL: Record<string, string> = {
  ALL_MEMBERS: "All members",
  DIRECTORS_ONLY: "Directors only",
  PRIVATE: "Private",
};

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const { membership } = await requireMembership();

  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      filename: documents.filename,
      sizeBytes: documents.sizeBytes,
      createdAt: documents.createdAt,
      visibility: documents.visibility,
      uploadedById: documents.uploadedById,
      uploaderName: users.name,
      uploaderEmail: users.email,
      meetingTitle: meetings.title,
    })
    .from(documents)
    .innerJoin(users, eq(documents.uploadedById, users.id))
    .leftJoin(meetings, eq(documents.meetingId, meetings.id))
    .where(eq(documents.organizationId, membership.organizationId))
    .orderBy(desc(documents.createdAt));

  const visible = rows.filter((d) => {
    if (d.visibility === "ALL_MEMBERS") return true;
    if (d.visibility === "DIRECTORS_ONLY") {
      return ["OWNER", "DIRECTOR", "ADMIN"].includes(membership.role);
    }
    if (d.visibility === "PRIVATE") {
      return d.uploadedById === membership.userId || membership.role === "OWNER" || membership.role === "ADMIN";
    }
    return false;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Board pack</h1>
          <p className="text-muted-foreground">Documents distributed to your board.</p>
        </div>
        <Button asChild>
          <Link href="/documents/new">Upload document</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>{visible.length} visible to you</CardDescription>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <ul className="divide-y">
              {visible.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/documents/${d.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-3 hover:bg-accent"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-md border bg-background p-2">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{d.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.filename} · {formatBytes(d.sizeBytes)} · uploaded {formatDateOnly(d.createdAt)} by{" "}
                          {d.uploaderName ?? d.uploaderEmail}
                          {d.meetingTitle ? ` · ${d.meetingTitle}` : ""}
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">{VIS_LABEL[d.visibility] ?? d.visibility}</Badge>
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
