import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canManage, requireMembership } from "@/lib/session";
import { uploadFinancialDocument } from "@/lib/actions/financials-data";
import { FINANCIAL_DOC_KINDS, FINANCIAL_DOC_LABELS } from "@/lib/financial-docs";

export default async function UploadFinancialDocPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/financials");

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Upload financial document</CardTitle>
        <CardDescription>
          Balance sheet, P&L, AR/AP aging, pro forma, headcount, cap table — anything your finance team needs to attach to a period. PDFs, Excel, CSV, Word, images. Max 25MB.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={uploadFinancialDocument} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="period">Period</Label>
              <Input id="period" name="period" type="month" defaultValue={defaultMonth} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kind">Kind</Label>
              <Select name="kind" defaultValue="P_AND_L">
                <SelectTrigger id="kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCIAL_DOC_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {FINANCIAL_DOC_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Q1 2026 P&L Statement" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" name="file" type="file" required />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Upload</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
