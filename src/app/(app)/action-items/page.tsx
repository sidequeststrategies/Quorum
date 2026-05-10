import { asc, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { db } from "@/lib/db";
import { actionItems, meetings, memberships, users } from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { formatDateOnly, initials } from "@/lib/utils";
import { ACTION_ITEM_STATUSES } from "@/lib/enums";
import { createActionItem, updateActionItemStatus } from "@/lib/actions/action-items";

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export default async function ActionItemsPage() {
  const { user, membership } = await requireMembership();
  const orgId = membership.organizationId;

  const [items, members, meetingRows] = await Promise.all([
    db
      .select({
        id: actionItems.id,
        title: actionItems.title,
        description: actionItems.description,
        dueDate: actionItems.dueDate,
        status: actionItems.status,
        assigneeId: actionItems.assigneeId,
        assigneeName: users.name,
        assigneeEmail: users.email,
        meetingId: meetings.id,
        meetingTitle: meetings.title,
      })
      .from(actionItems)
      .leftJoin(users, eq(actionItems.assigneeId, users.id))
      .leftJoin(meetings, eq(actionItems.meetingId, meetings.id))
      .where(eq(actionItems.organizationId, orgId))
      .orderBy(asc(actionItems.status), asc(actionItems.dueDate), desc(actionItems.createdAt)),
    db
      .select({ userId: memberships.userId, userName: users.name, userEmail: users.email })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.organizationId, orgId)),
    db
      .select({ id: meetings.id, title: meetings.title })
      .from(meetings)
      .where(eq(meetings.organizationId, orgId))
      .orderBy(desc(meetings.scheduledAt))
      .limit(20),
  ]);

  const isManager = canManage(membership.role);
  const open = items.filter((i) => i.status === "OPEN" || i.status === "IN_PROGRESS");
  const closed = items.filter((i) => i.status === "DONE" || i.status === "CANCELLED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Action items</h1>
        <p className="text-muted-foreground">Follow-ups assigned at board meetings.</p>
      </div>

      {isManager ? (
        <Card>
          <CardHeader>
            <CardTitle>Add action item</CardTitle>
            <CardDescription>Captured from a meeting or stand-alone.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createActionItem} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required placeholder="Send updated cap table to investors" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assigneeId">Assignee</Label>
                <Select name="assigneeId" defaultValue="none">
                  <SelectTrigger id="assigneeId">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Unassigned —</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.userName ?? m.userEmail}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meetingId">From meeting</Label>
                <Select name="meetingId" defaultValue="none">
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
              <div className="space-y-1.5">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit">Add</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Open</CardTitle>
          <CardDescription>{open.length} active</CardDescription>
        </CardHeader>
        <CardContent>
          {open.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing outstanding.</p>
          ) : (
            <ul className="divide-y">
              {open.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {i.assigneeName || i.assigneeEmail ? initials(i.assigneeName ?? i.assigneeEmail) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{i.title}</div>
                      {i.description ? <div className="text-sm text-muted-foreground">{i.description}</div> : null}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{i.assigneeName ?? i.assigneeEmail ?? "Unassigned"}</span>
                        {i.dueDate ? <Badge variant="outline">Due {formatDateOnly(i.dueDate)}</Badge> : null}
                        {i.meetingTitle ? <span>· from {i.meetingTitle}</span> : null}
                      </div>
                    </div>
                  </div>
                  {isManager || i.assigneeId === user.id ? (
                    <form action={updateActionItemStatus} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={i.id} />
                      <Select name="status" defaultValue={i.status}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ACTION_ITEM_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="submit" size="sm" variant="outline">
                        Update
                      </Button>
                    </form>
                  ) : (
                    <Badge variant={i.status === "IN_PROGRESS" ? "warning" : "secondary"}>{STATUS_LABEL[i.status]}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {closed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Closed</CardTitle>
            <CardDescription>{closed.length} completed or cancelled</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {closed.map((i) => (
                <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-muted-foreground line-through">{i.title}</span>
                  <Badge variant={i.status === "DONE" ? "success" : "outline"}>{STATUS_LABEL[i.status]}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
