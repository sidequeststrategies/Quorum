import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RISK_CATEGORIES, RISK_CATEGORY_LABELS, RISK_STATUSES, RISK_STATUS_LABELS } from "@/lib/enums";
import type { Risk } from "@/db/schema";

type Member = { id: string; name: string | null; email: string };

export function RiskForm({
  action,
  risk,
  members,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  risk?: Risk;
  members: Member[];
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-5">
      {risk ? <input type="hidden" name="id" value={risk.id} /> : null}
      <div className="space-y-2">
        <Label htmlFor="title">Risk</Label>
        <Input id="title" name="title" defaultValue={risk?.title} placeholder="e.g. Key supplier concentration" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={risk?.description ?? ""}
          placeholder="What could happen, and what would it mean for the business?"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select name="category" defaultValue={risk?.category ?? "OPERATIONAL"}>
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {RISK_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={risk?.status ?? "OPEN"}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {RISK_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ScaleField
          name="likelihood"
          label="Likelihood (1–5)"
          defaultValue={risk?.likelihood ?? 3}
          hint="1 = remote, 5 = near certain"
        />
        <ScaleField name="impact" label="Impact (1–5)" defaultValue={risk?.impact ?? 3} hint="1 = minor, 5 = existential" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ownerId">Owner</Label>
        <Select name="ownerId" defaultValue={risk?.ownerId ?? undefined}>
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
        <Label htmlFor="mitigation">Mitigation plan</Label>
        <Textarea
          id="mitigation"
          name="mitigation"
          rows={3}
          defaultValue={risk?.mitigation ?? ""}
          placeholder="What management is doing about it."
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}

function ScaleField({
  name,
  label,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  defaultValue: number;
  hint: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={1} max={5} step={1} defaultValue={defaultValue} required />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
