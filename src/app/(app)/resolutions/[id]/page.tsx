import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/db";
import { meetings, memberships, resolutions, users, votes } from "@/db/schema";
import { canManage, canVote, requireMembership } from "@/lib/session";
import { formatDate, initials } from "@/lib/utils";
import { RESOLUTION_STATUS_LABELS } from "@/lib/enums";
import { castVote, closeResolution, openResolution } from "@/lib/actions/resolutions";

export default async function ResolutionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, membership } = await requireMembership();

  const resRows = await db
    .select({
      r: resolutions,
      meetingId: meetings.id,
      meetingTitle: meetings.title,
    })
    .from(resolutions)
    .leftJoin(meetings, eq(resolutions.meetingId, meetings.id))
    .where(and(eq(resolutions.id, id), eq(resolutions.organizationId, membership.organizationId)))
    .limit(1);
  const resRow = resRows[0];
  if (!resRow) notFound();
  const r = resRow.r;

  const [voteRows, voterRows] = await Promise.all([
    db
      .select({
        id: votes.id,
        userId: votes.userId,
        choice: votes.choice,
        comment: votes.comment,
        castAt: votes.castAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(votes)
      .innerJoin(users, eq(votes.userId, users.id))
      .where(eq(votes.resolutionId, r.id))
      .orderBy(asc(votes.castAt)),
    db
      .select({
        userId: memberships.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(
        and(
          eq(memberships.organizationId, membership.organizationId),
          eq(memberships.votingRights, true),
          inArray(memberships.role, ["OWNER", "DIRECTOR"])
        )
      ),
  ]);

  const tally = {
    FOR: voteRows.filter((v) => v.choice === "FOR").length,
    AGAINST: voteRows.filter((v) => v.choice === "AGAINST").length,
    ABSTAIN: voteRows.filter((v) => v.choice === "ABSTAIN").length,
  };
  const totalVoters = voterRows.length;
  const cast = voteRows.length;
  const myVote = voteRows.find((v) => v.userId === user.id);
  const isManager = canManage(membership.role);
  const userCanVote = canVote(membership.role, membership.votingRights);

  const requiredForUnanimous = totalVoters;
  const requiredForMajority = Math.floor(totalVoters / 2) + 1;
  const wouldPass = r.requiresUnanimous ? tally.FOR === requiredForUnanimous : tally.FOR >= requiredForMajority;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                r.status === "PASSED"
                  ? "success"
                  : r.status === "FAILED"
                  ? "destructive"
                  : r.status === "OPEN"
                  ? "default"
                  : "secondary"
              }
            >
              {RESOLUTION_STATUS_LABELS[r.status as keyof typeof RESOLUTION_STATUS_LABELS] ?? r.status}
            </Badge>
            <Badge variant="outline">{r.kind === "WRITTEN_CONSENT" ? "Written consent" : "Meeting vote"}</Badge>
            {r.requiresUnanimous ? <Badge variant="outline">Unanimous required</Badge> : null}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{r.title}</h1>
          {resRow.meetingId ? (
            <p className="mt-1 text-sm text-muted-foreground">
              For meeting:{" "}
              <Link href={`/meetings/${resRow.meetingId}`} className="text-primary hover:underline">
                {resRow.meetingTitle}
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resolution text</CardTitle>
            {r.openedAt ? <CardDescription>Opened {formatDate(r.openedAt)}</CardDescription> : null}
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-4 text-sm leading-relaxed">{r.body}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tally</CardTitle>
            <CardDescription>
              {cast} of {totalVoters} voting members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="For" value={tally.FOR} accent="bg-emerald-500" total={totalVoters} />
            <Row label="Against" value={tally.AGAINST} accent="bg-rose-500" total={totalVoters} />
            <Row label="Abstain" value={tally.ABSTAIN} accent="bg-zinc-400" total={totalVoters} />
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">
              {r.requiresUnanimous
                ? `Needs all ${requiredForUnanimous} voting members to approve.`
                : `Needs ${requiredForMajority} of ${totalVoters} to pass.`}{" "}
              <span className={wouldPass ? "text-emerald-600" : "text-muted-foreground"}>
                {r.status === "PASSED" || r.status === "FAILED"
                  ? ""
                  : `Currently would ${wouldPass ? "pass" : "fail"}.`}
              </span>
            </p>
          </CardContent>
        </Card>

        {r.status === "OPEN" && userCanVote ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{myVote ? "Your vote" : "Cast your vote"}</CardTitle>
              <CardDescription>
                {myVote
                  ? "You can change your vote until this resolution is closed."
                  : "Pick how you'd like to vote on this resolution."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={castVote} className="space-y-4">
                <input type="hidden" name="resolutionId" value={r.id} />
                <div className="grid grid-cols-3 gap-2">
                  {(["FOR", "AGAINST", "ABSTAIN"] as const).map((choice) => (
                    <Button
                      key={choice}
                      name="choice"
                      value={choice}
                      type="submit"
                      variant={myVote?.choice === choice ? "default" : "outline"}
                    >
                      {choice.charAt(0) + choice.slice(1).toLowerCase()}
                    </Button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="comment">Comment (optional, recorded with your vote)</Label>
                  <Textarea id="comment" name="comment" defaultValue={myVote?.comment ?? ""} />
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card className={r.status === "OPEN" && userCanVote ? "" : "lg:col-span-2"}>
          <CardHeader>
            <CardTitle>Voters</CardTitle>
            <CardDescription>Who&apos;s voted, and how.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {voterRows.map((v) => {
                const vote = voteRows.find((x) => x.userId === v.userId);
                return (
                  <li key={v.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">{initials(v.userName ?? v.userEmail)}</AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{v.userName ?? v.userEmail}</span>
                    </div>
                    {vote ? (
                      <Badge
                        variant={
                          vote.choice === "FOR"
                            ? "success"
                            : vote.choice === "AGAINST"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {vote.choice.charAt(0) + vote.choice.slice(1).toLowerCase()}
                      </Badge>
                    ) : (
                      <Badge variant="outline">No vote yet</Badge>
                    )}
                  </li>
                );
              })}
            </ul>

            {voteRows.some((v) => v.comment) ? (
              <>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <p className="text-sm font-medium">Comments</p>
                  {voteRows
                    .filter((v) => v.comment)
                    .map((v) => (
                      <div key={v.id} className="rounded-md border p-3">
                        <div className="text-xs text-muted-foreground">
                          {v.userName ?? v.userEmail} · {v.choice.toLowerCase()} · {formatDate(v.castAt)}
                        </div>
                        <div className="mt-1 text-sm">{v.comment}</div>
                      </div>
                    ))}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {isManager ? (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Manage</CardTitle>
              <CardDescription>Open this for voting or record the outcome.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {r.status === "DRAFT" ? (
                  <form action={openResolution}>
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit">Open for voting</Button>
                  </form>
                ) : null}

                {r.status === "OPEN" ? (
                  <>
                    <form action={closeResolution}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="outcome" value="PASSED" />
                      <Button type="submit" variant="default">
                        Mark as passed
                      </Button>
                    </form>
                    <form action={closeResolution}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="outcome" value="FAILED" />
                      <Button type="submit" variant="destructive">
                        Mark as failed
                      </Button>
                    </form>
                    <form action={closeResolution}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="outcome" value="WITHDRAWN" />
                      <Button type="submit" variant="outline">
                        Withdraw
                      </Button>
                    </form>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value, total, accent }: { label: string; value: number; total: number; accent: string }) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${accent}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
