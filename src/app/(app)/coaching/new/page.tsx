import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProgram } from "@/lib/actions/coaching";
import { COACHING_PROGRAM_KINDS, COACHING_PROGRAM_LABELS } from "@/lib/enums";

export default function NewProgramPage() {
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>New coaching program</CardTitle>
        <CardDescription>Add lessons and clients after creating it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createProgram} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="First-Time Founder Fundamentals" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Who this is for and what it covers." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kind">Kind</Label>
            <Select name="kind" defaultValue="FOUNDER">
              <SelectTrigger id="kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COACHING_PROGRAM_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {COACHING_PROGRAM_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Create program</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
