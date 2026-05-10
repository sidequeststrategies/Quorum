import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import { coachingPrograms } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { createClient } from "@/lib/actions/coaching";

export default async function NewClientPage() {
  const user = await requireUser();
  const programs = await db.select().from(coachingPrograms).where(eq(coachingPrograms.ownerId, user.id));

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Add a coaching client</CardTitle>
        <CardDescription>Track the relationship outside of any company workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createClient} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="Maya Okonkwo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="maya@company.com" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input id="company" name="company" placeholder="Northstar Grid" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input id="role" name="role" placeholder="Founder & CEO" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="programId">Program</Label>
              <Select name="programId" defaultValue="none">
                <SelectTrigger id="programId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" name="startDate" type="date" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Background, goals, what you're working on together." />
          </div>
          <div className="flex justify-end">
            <Button type="submit">Add client</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
