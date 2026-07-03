import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireMembership, canManage } from "@/lib/session";
import { ProFormaUploadClient } from "./proforma-upload-client";

export default async function NewProFormaModelPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/financials/proforma");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/financials/proforma" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Pro forma
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Upload financial model</h1>
        <p className="text-muted-foreground">
          Upload the pro forma workbook (quarterly P&amp;L, cash flow, headcount). It becomes the baseline the
          modeling sliders and sensitivity analysis run on — upload a new vintage anytime to re-baseline.
        </p>
      </div>
      <ProFormaUploadClient />
    </div>
  );
}
