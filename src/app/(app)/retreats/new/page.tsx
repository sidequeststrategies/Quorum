import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { canManage, requireMembership } from "@/lib/session";
import { createRetreat } from "@/lib/actions/retreats";

export default async function NewRetreatPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/retreats");

  const start = new Date();
  start.setDate(start.getDate() + 30);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(17, 0, 0, 0);

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>New retreat</CardTitle>
        <CardDescription>You'll add the agenda and pull from your activity library after.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createRetreat} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Acme Leadership Offsite — Summer 2026" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" placeholder="Cavallo Point, Sausalito CA" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">Starts</Label>
              <Input id="startDate" name="startDate" type="datetime-local" defaultValue={start.toISOString().slice(0, 16)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Ends</Label>
              <Input id="endDate" name="endDate" type="datetime-local" defaultValue={end.toISOString().slice(0, 16)} required />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Create retreat</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
