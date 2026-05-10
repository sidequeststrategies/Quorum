import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import { meetings } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { uploadDocument } from "@/lib/actions/documents";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ meetingId?: string }>;
}) {
  const { membership } = await requireMembership();
  const { meetingId } = await searchParams;

  const meetingRows = await db
    .select()
    .from(meetings)
    .where(eq(meetings.organizationId, membership.organizationId))
    .orderBy(desc(meetings.scheduledAt));

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Upload to board pack</CardTitle>
        <CardDescription>PDF, Office docs, images, or text files up to 10MB.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={uploadDocument} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required placeholder="Q2 2026 financials" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea id="description" name="description" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">File</Label>
            <Input id="file" name="file" type="file" required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="meetingId">Tied to meeting</Label>
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
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select name="visibility" defaultValue="ALL_MEMBERS">
                <SelectTrigger id="visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL_MEMBERS">All members</SelectItem>
                  <SelectItem value="DIRECTORS_ONLY">Directors only</SelectItem>
                  <SelectItem value="PRIVATE">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit">Upload</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
