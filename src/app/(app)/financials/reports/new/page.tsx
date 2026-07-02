import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireMembership, canManage } from "@/lib/session";
import { redirect } from "next/navigation";
import { ReportUploadClient } from "./report-upload-client";

export default async function NewMonthlyReportPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/financials");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/financials" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Financials
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">New monthly report</h1>
        <p className="text-muted-foreground">
          Upload the board financial pack for the month. Metrics, forecast columns, and the sales funnel are detected
          automatically — you review and correct everything before it's saved.
        </p>
      </div>
      <ReportUploadClient />
    </div>
  );
}
