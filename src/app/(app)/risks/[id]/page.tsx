import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import { meetings, risks, riskReviews, users } from "@/db/schema";
import { canManage, listOrgMembers, requireMembership } from "@/lib/session";
import { deleteRisk, reviewRisk, updateRisk } from "@/lib/actions/risks";
import { RiskForm } from "@/components/risk-form";
import { RiskSeverityBadge, RiskStatusBadge } from "@/components/report-badges";
import { RISK_STATUSES, RISK_STATUS_LABELS } from "@/lib/enums";
import { formatDate, formatDateOnly } from "@/lib/utils";

export default async function RiskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();

  const rows = await db
    .select()
    .from(risks)
    .where(and(eq(risks.id, id), eq(risks.organizationId, membership.organizationId)))
    .limit(1);
  const risk = rows[0];
  if (!risk) notFound();

  const [members, reviews, upcomingMeetings] = await Promise.all([
    listOrgMembers(membership.organizationId),
    db
      .select({ rv: riskReviews, reviewerName: users.name, reviewerEmail: users.email, meetingTitle: meetings.title })
      .from(riskReviews)
      .leftJoin(users, eq(riskReviews.reviewedById, users.id))
      .leftJoin(meetings, eq(riskReviews.meetingId, meetings.id))
      .where(eq(riskReviews.riskId, id))
      .orderBy(desc(riskReviews.createdAt)),
    db
      .select({ id: meetings.id, title: meetings.title, scheduledAt: meetings.scheduledAt })
      .from(meetings)
      .where(eq(meetings.organizationId, membership.organizationId))
      .orderBy(desc(meetings.scheduledAt))
      .limit(12),
  ]);

  const manager = canManage(membership.role);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{risk.title}</h1>
            <RiskStatusBadge status={risk.status} />
            <RiskSeverityBadge likelihood={risk.likelihood} impact={risk.impact} />
          </div>
          <p className="mt-1 text-muted-foreground">
            On the register since {formatDateOnly(risk.createdAt)}
            {risk.closedAt ? ` · closed ${formatDateOnly(risk.closedAt)}` : ""}
          </p>
        </div>
        {manager ? (
          <form action={deleteRisk}>
            <input type="hidden" name="id" value={risk.id} />
            <Button type="submit" variant="ghost" size="sm" className="text-destructive">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {manager ? (
          <Card>
            <CardHeader>
              <CardTitle>Edit risk</CardTitle>
            </CardHeader>
            <CardContent>
              <RiskForm action={updateRisk} risk={risk} members={members} submitLabel="Save changes" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>{risk.description ?? "No description."}</p>
              <div>
                <p className="font-medium">Mitigation</p>
                <p className="text-muted-foreground">{risk.mitigation ?? "None recorded."}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {manager ? (
            <Card>
              <CardHeader>
                <CardTitle>Board review</CardTitle>
                <CardDescription>
                  Record the board&rsquo;s read at a meeting — the register rolls forward and the history stays.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={reviewRisk} className="space-y-4">
                  <input type="hidden" name="riskId" value={risk.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="rv-likelihood">Likelihood (1–5)</Label>
                      <Input id="rv-likelihood" name="likelihood" type="number" min={1} max={5} defaultValue={risk.likelihood} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rv-impact">Impact (1–5)</Label>
                      <Input id="rv-impact" name="impact" type="number" min={1} max={5} defaultValue={risk.impact} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rv-status">Status after review</Label>
                      <Select name="status" defaultValue={risk.status}>
                        <SelectTrigger id="rv-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RISK_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {RISK_STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rv-meeting">Meeting (optional)</Label>
                      <Select name="meetingId">
                        <SelectTrigger id="rv-meeting">
                          <SelectValue placeholder="Not tied to a meeting" />
                        </SelectTrigger>
                        <SelectContent>
                          {upcomingMeetings.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.title} — {formatDateOnly(m.scheduledAt)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rv-note">Review note</Label>
                    <Textarea id="rv-note" name="note" rows={2} placeholder="What changed since last review?" />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit">Record review</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Review history</CardTitle>
              <CardDescription>The carry-over trail across board meetings.</CardDescription>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not reviewed yet — it will appear in the next board pack.</p>
              ) : (
                <ol className="space-y-4">
                  {reviews.map(({ rv, reviewerName, reviewerEmail, meetingTitle }) => (
                    <li key={rv.id} className="border-l-2 border-brand-teal/40 pl-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <RiskStatusBadge status={rv.status} />
                        <RiskSeverityBadge likelihood={rv.likelihood} impact={rv.impact} />
                        <span className="text-muted-foreground">
                          {formatDate(rv.createdAt)} · {reviewerName ?? reviewerEmail}
                          {meetingTitle ? ` · ${meetingTitle}` : ""}
                        </span>
                      </div>
                      {rv.note ? <p className="mt-1 text-sm">{rv.note}</p> : null}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
