import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canManage, requireMembership } from "@/lib/session";
import { db } from "@/lib/db";
import { meetings } from "@/db/schema";
import { createResolution } from "@/lib/actions/resolutions";

export default async function NewResolutionPage({
  searchParams,
}: {
  searchParams: Promise<{ meetingId?: string }>;
}) {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/resolutions");

  const { meetingId } = await searchParams;
  const meetingRows = await db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.organizationId, membership.organizationId),
        inArray(meetings.status, ["DRAFT", "SCHEDULED", "IN_PROGRESS"])
      )
    )
    .orderBy(asc(meetings.scheduledAt));

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Propose a resolution</CardTitle>
        <CardDescription>
          Save as a draft now, then open it for voting when ready. Use written consent to bypass a meeting if all
          directors agree.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createResolution} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Approve 2026 operating budget" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Resolution text</Label>
            <Textarea
              id="body"
              name="body"
              required
              rows={6}
              placeholder={`RESOLVED, that the Board hereby approves the 2026 operating budget as presented...`}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kind">Kind</Label>
              <Select name="kind" defaultValue="MEETING_VOTE">
                <SelectTrigger id="kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEETING_VOTE">Meeting vote</SelectItem>
                  <SelectItem value="WRITTEN_CONSENT">Written consent (unanimous)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meetingId">Tied to meeting (optional)</Label>
              <Select name="meetingId" defaultValue={meetingId ?? "none"}>
                <SelectTrigger id="meetingId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {meetingRows.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input id="requiresUnanimous" name="requiresUnanimous" type="checkbox" className="h-4 w-4" />
            <Label htmlFor="requiresUnanimous" className="cursor-pointer">
              Requires unanimous approval
            </Label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="submit">Save as draft</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
