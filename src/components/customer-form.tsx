import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_LABELS } from "@/lib/enums";
import type { Customer } from "@/db/schema";

type Member = { id: string; name: string | null; email: string };

export function CustomerForm({
  action,
  customer,
  members,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  customer?: Customer;
  members: Member[];
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-5">
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
      <div className="space-y-2">
        <Label htmlFor="name">Customer</Label>
        <Input id="name" name="name" defaultValue={customer?.name} placeholder="e.g. National Grid" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="segment">Segment</Label>
          <Input id="segment" name="segment" defaultValue={customer?.segment ?? ""} placeholder="e.g. Transmission utility" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Input id="region" name="region" defaultValue={customer?.region ?? ""} placeholder="e.g. UK / Canada" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="arr">ARR / contract value ($)</Label>
          <Input id="arr" name="arr" type="number" min={0} step={1} defaultValue={customer?.arr ?? 0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={customer?.status ?? "ACTIVE"}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CUSTOMER_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="ownerId">Account owner</Label>
        <Select name="ownerId" defaultValue={customer?.ownerId ?? undefined}>
          <SelectTrigger id="ownerId">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name ?? m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={customer?.notes ?? ""} />
      </div>
      <div className="flex justify-end">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
