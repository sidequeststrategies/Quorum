import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canManage, requireMembership } from "@/lib/session";
import { createMeeting } from "@/lib/actions/meetings";
import { MEETING_TYPES } from "@/lib/enums";

export default async function NewMeetingPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/meetings");

  const d = new Date();
  d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
  d.setHours(10, 0, 0, 0);
  const defaultDateTime = d.toISOString().slice(0, 16);

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Schedule a meeting</CardTitle>
        <CardDescription>You can edit details and add the agenda after.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createMeeting} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Q2 2026 Board Meeting" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue="REGULAR">
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationMin">Duration (minutes)</Label>
              <Input id="durationMin" name="durationMin" type="number" min={15} max={720} defaultValue={60} required />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scheduledAt">Date & time</Label>
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" defaultValue={defaultDateTime} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quorumRequired">Quorum (0 = simple majority)</Label>
              <Input id="quorumRequired" name="quorumRequired" type="number" min={0} defaultValue={0} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" placeholder="HQ Conference Room or Zoom" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="videoUrl">Video link (optional)</Label>
            <Input id="videoUrl" name="videoUrl" placeholder="https://meet.example.com/..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" placeholder="Anything board members should review beforehand" />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit">Create meeting</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
