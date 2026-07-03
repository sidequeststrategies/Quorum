// Audit trail viewer (owners/admins only): who uploaded, downloaded, or
// deleted what, and when. Backed by the AccessLog table — every board-pack
// download goes through /api/files/[id], which writes a row here.

import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { db } from "@/lib/db";
import { accessLogs, users } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { formatDate } from "@/lib/utils";

const ACTION_LABELS: Record<string, string> = {
  FILE_DOWNLOAD: "Downloaded file",
  FILE_UPLOAD: "Uploaded file",
  REPORT_CREATE: "Created financial report",
  REPORT_DELETE: "Deleted financial report",
  DOC_UPLOAD: "Uploaded document",
  DOC_DELETE: "Deleted document",
};

const ACTION_VARIANTS: Record<string, "outline" | "destructive"> = {
  REPORT_DELETE: "destructive",
  DOC_DELETE: "destructive",
};

export default async function ActivityPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/dashboard");

  const rows = await db
    .select({ log: accessLogs, userName: users.name, userEmail: users.email })
    .from(accessLogs)
    .leftJoin(users, eq(accessLogs.userId, users.id))
    .where(eq(accessLogs.organizationId, membership.organizationId))
    .orderBy(desc(accessLogs.createdAt))
    .limit(200);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold tracking-tight">
          <ShieldCheck className="h-7 w-7 text-primary" />
          Activity log
        </h1>
        <p className="text-muted-foreground">
          Audit trail for {membership.organization.name}: file downloads, uploads, and report changes. Visible to
          owners and admins only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Last {rows.length} events.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing logged yet. Events appear as members download board packs, upload documents, and manage monthly
              reports.
            </p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Who</th>
                  <th className="py-2 pr-3 font-medium">Action</th>
                  <th className="py-2 pr-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(({ log, userName, userEmail }) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap py-2 pr-3 text-muted-foreground">{formatDate(log.createdAt)}</td>
                    <td className="py-2 pr-3">
                      {userName ?? userEmail ?? <span className="text-muted-foreground">system</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={ACTION_VARIANTS[log.action] ?? "outline"}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                    </td>
                    <td className="max-w-md py-2 pr-3 text-muted-foreground">{log.detail ?? log.resourceId ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
