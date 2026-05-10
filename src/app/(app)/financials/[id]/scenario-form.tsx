import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SCENARIO_KINDS } from "@/lib/enums";
import type { ScenarioAssumptions } from "@/lib/finance";

type Props = {
  action: (formData: FormData) => void;
  planId?: string;
  scenarioId?: string;
  defaultName?: string;
  defaultKind?: string;
  defaultNotes?: string;
  initial: ScenarioAssumptions;
};

export function ScenarioForm({
  action,
  planId,
  scenarioId,
  defaultName,
  defaultKind = "CUSTOM",
  defaultNotes,
  initial,
}: Props) {
  return (
    <form action={action} className="space-y-5">
      {planId ? <input type="hidden" name="planId" value={planId} /> : null}
      {scenarioId ? <input type="hidden" name="id" value={scenarioId} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={defaultName ?? ""} required placeholder="Base case" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kind">Kind</Label>
          <Select name="kind" defaultValue={defaultKind}>
            <SelectTrigger id="kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCENARIO_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {k.charAt(0) + k.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={defaultNotes ?? ""} />
      </div>

      <div className="rounded-md border p-4">
        <div className="text-sm font-semibold">Revenue assumptions</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field name="startingMRR" label="Starting MRR ($)" type="number" defaultValue={initial.startingMRR} />
          <Field name="monthlyGrowthPct" label="MoM growth (%)" type="number" step="0.1" defaultValue={initial.monthlyGrowthPct} />
          <Field name="churnPct" label="Monthly churn (%)" type="number" step="0.1" defaultValue={initial.churnPct} />
          <Field name="grossMarginPct" label="Gross margin (%)" type="number" step="0.1" defaultValue={initial.grossMarginPct} />
        </div>
      </div>

      <div className="rounded-md border p-4">
        <div className="text-sm font-semibold">Cost assumptions</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field name="monthlyOpexBase" label="Fixed opex / month ($)" type="number" defaultValue={initial.monthlyOpexBase} />
          <Field name="opexGrowthPct" label="Opex creep / month (%)" type="number" step="0.1" defaultValue={initial.opexGrowthPct} />
          <Field name="headcountStart" label="Starting headcount" type="number" defaultValue={initial.headcountStart} />
          <Field name="monthlyHires" label="Hires / month" type="number" step="0.1" defaultValue={initial.monthlyHires} />
          <Field name="avgFullyLoadedSalary" label="Avg fully-loaded salary ($/yr)" type="number" defaultValue={initial.avgFullyLoadedSalary} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">Save scenario</Button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type,
  step,
}: {
  name: string;
  label: string;
  defaultValue: number | string;
  type?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type ?? "text"} step={step} defaultValue={defaultValue} required />
    </div>
  );
}
