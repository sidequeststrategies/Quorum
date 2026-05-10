import { desc, eq, gte, isNull, or } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import { meetings, reportTemplates } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { createReport } from "@/lib/actions/reports";

export default async function NewReportPage() {
  const { membership } = await requireMembership();
  const [templates, upcomingMeetings] = await Promise.all([
    db
      .select()
      .from(reportTemplates)
      .where(or(eq(reportTemplates.organizationId, membership.organizationId), isNull(reportTemplates.organizationId)))
      .orderBy(desc(reportTemplates.updatedAt)),
    db
      .select()
      .from(meetings)
      .where(eq(meetings.organizationId, membership.organizationId))
      .orderBy(desc(meetings.scheduledAt))
      .limit(10),
  ]);
  void gte;

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>New report</CardTitle>
        <CardDescription>Pick a template and start filling it in.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createReport} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="CEO Update — Q2 2026" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="templateId">Template</Label>
            <Select name="templateId" defaultValue={templates[0]?.id ?? "none"}>
              <SelectTrigger id="templateId">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Blank report —</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="meetingId">For meeting (optional)</Label>
            <Select name="meetingId" defaultValue="none">
              <SelectTrigger id="meetingId">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {upcomingMeetings.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Create</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
