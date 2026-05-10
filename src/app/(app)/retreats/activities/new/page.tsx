import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createActivity } from "@/lib/actions/retreats";
import { ACTIVITY_KINDS, ACTIVITY_KIND_LABELS } from "@/lib/enums";

export default function NewActivityPage() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>New retreat activity</CardTitle>
        <CardDescription>
          Capture an exercise once so you (and your team) can reuse it across every offsite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createActivity} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Pre-mortem" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kind">Kind</Label>
              <Select name="kind" defaultValue="STRATEGIC">
                <SelectTrigger id="kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ACTIVITY_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMin">Duration (min)</Label>
              <Input id="durationMin" name="durationMin" type="number" min={5} max={480} defaultValue={60} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="groupSizeMin">Min group size</Label>
              <Input id="groupSizeMin" name="groupSizeMin" type="number" min={1} defaultValue={4} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupSizeMax">Max group size</Label>
              <Input id="groupSizeMax" name="groupSizeMax" type="number" min={1} defaultValue={20} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} placeholder="One-line summary." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              name="instructions"
              rows={6}
              required
              placeholder="Step-by-step. How a facilitator would run this."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="materials">Materials needed</Label>
            <Input id="materials" name="materials" placeholder="Sticky notes, sharpies, dot stickers." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="learningObjectives">Learning objectives</Label>
            <Textarea
              id="learningObjectives"
              name="learningObjectives"
              rows={2}
              placeholder="What participants take away."
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Save activity</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
