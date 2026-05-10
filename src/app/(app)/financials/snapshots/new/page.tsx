import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { canManage, requireMembership } from "@/lib/session";
import { saveSnapshot } from "@/lib/actions/financials-data";

export default async function NewSnapshotPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/financials");

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Add monthly financial snapshot</CardTitle>
        <CardDescription>
          The numbers you'd report in a board update. Saving the same period overwrites the prior snapshot.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={saveSnapshot} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="period">Period</Label>
            <Input id="period" name="period" type="month" defaultValue={defaultMonth} required />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="cash" label="Cash on hand ($)" defaultValue="0" />
            <Field name="arr" label="ARR ($)" defaultValue="0" />
            <Field name="mrr" label="MRR ($)" defaultValue="0" />
            <Field name="revenue" label="Monthly revenue ($)" defaultValue="0" />
            <Field name="grossMargin" label="Gross margin (%)" defaultValue="0" />
            <Field name="burn" label="Net burn / month ($)" defaultValue="0" hint="Positive = burning, negative = generating cash" />
            <Field name="headcount" label="Headcount" defaultValue="0" />
            <Field name="accountsReceivable" label="AR ($)" defaultValue="0" />
            <Field name="accountsPayable" label="AP ($)" defaultValue="0" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Anything notable about this month — large one-time items, accounting changes, etc." />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit">Save snapshot</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ name, label, defaultValue, hint }: { name: string; label: string; defaultValue?: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" step="1" defaultValue={defaultValue} required />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
