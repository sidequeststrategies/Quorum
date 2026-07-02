import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_STATUSES, PROJECT_STATUS_LABELS } from "@/lib/enums";
import type { Project } from "@/db/schema";

type Member = { id: string; name: string | null; email: string };

function dateInputValue(d: Date | null | undefined) {
  if (!d) return undefined;
  return new Date(d).toISOString().slice(0, 10);
}

export function ProjectForm({
  action,
  project,
  members,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  project?: Project;
  members: Member[];
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-5">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={project?.name} placeholder="e.g. CapacityN robot v2 field trials" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="summary">Summary</Label>
        <Textarea
          id="summary"
          name="summary"
          rows={2}
          defaultValue={project?.summary ?? ""}
          placeholder="One or two sentences the board can scan."
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue={project?.status ?? "ON_TRACK"}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {PROJECT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ownerId">Owner</Label>
          <Select name="ownerId" defaultValue={project?.ownerId ?? undefined}>
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
          <Label htmlFor="startDate">Start date</Label>
          <Input id="startDate" name="startDate" type="date" defaultValue={dateInputValue(project?.startDate)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetDate">Target date</Label>
          <Input id="targetDate" name="targetDate" type="date" defaultValue={dateInputValue(project?.targetDate)} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
