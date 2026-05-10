import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { canManage, requireMembership } from "@/lib/session";
import { createPlan } from "@/lib/actions/financials";

export default async function NewPlanPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/financials");

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>New financial plan</CardTitle>
        <CardDescription>You'll add scenarios after creating the plan shell.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createPlan} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required placeholder="FY2026 Operating Plan" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="startMonth">Start month</Label>
              <Input id="startMonth" name="startMonth" type="month" defaultValue={defaultMonth} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="horizonMonths">Horizon (months)</Label>
              <Input id="horizonMonths" name="horizonMonths" type="number" min={3} max={60} defaultValue={24} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startingCash">Starting cash ($)</Label>
              <Input id="startingCash" name="startingCash" type="number" min={0} defaultValue={10000000} required />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Create plan</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
