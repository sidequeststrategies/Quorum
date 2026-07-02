import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { actionItems, agendaItems, meetings, reports, resolutions, users } from "@/db/schema";
import { requireMembership } from "@/lib/session";
import { cycleChecklist, getBoardPackData } from "@/lib/board-pack";
import { financialSummaryLines, fmtUSD } from "@/lib/finance";
import { CashChart } from "@/components/cash-chart";
import {
  CustomerStatusBadge,
  HealthDot,
  MilestoneStatusBadge,
  ProjectStatusBadge,
  RiskSeverityBadge,
  RiskStatusBadge,
} from "@/components/report-badges";
import { RESOLUTION_STATUS_LABELS, RISK_CATEGORY_LABELS } from "@/lib/enums";
import { formatDate, formatDateOnly, formatPeriod } from "@/lib/utils";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function BoardPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();

  const meetingRows = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.organizationId, membership.organizationId)))
    .limit(1);
  const meeting = meetingRows[0];
  if (!meeting) notFound();

  const period = new Date(meeting.scheduledAt);
  const [pack, agenda, meetingResolutions, meetingActions, meetingReports] = await Promise.all([
    getBoardPackData(membership.organizationId, period),
    db.select().from(agendaItems).where(eq(agendaItems.meetingId, id)).orderBy(asc(agendaItems.order)),
    db.select().from(resolutions).where(eq(resolutions.meetingId, id)),
    db
      .select({ a: actionItems, assigneeName: users.name, assigneeEmail: users.email })
      .from(actionItems)
      .leftJoin(users, eq(actionItems.assigneeId, users.id))
      .where(eq(actionItems.meetingId, id)),
    db.select().from(reports).where(and(eq(reports.meetingId, id), eq(reports.status, "PUBLISHED"))),
  ]);

  const checklist = cycleChecklist(pack);
  const missing = checklist.filter((c) => !c.done);
  const summary = pack.snapshot ? financialSummaryLines(pack.snapshots) : [];
  const trailing = pack.snapshots.slice(-12);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Board pack — {formatPeriod(period)}</h1>
          <p className="text-muted-foreground">
            {meeting.title} · {formatDate(meeting.scheduledAt)}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/meetings/${meeting.id}`}>Back to meeting</Link>
        </Button>
      </div>

      {missing.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 print:hidden">
          <CardContent className="p-4 text-sm">
            <span className="font-medium">Before the meeting:</span>{" "}
            {missing.map((m, i) => (
              <span key={m.key}>
                {i > 0 ? " · " : ""}
                <Link href={m.href} className="text-primary underline-offset-4 hover:underline">
                  {m.label}
                </Link>
              </span>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* 1. Financials */}
      <PackSection n={1} title="Financials">
        {pack.snapshot ? (
          <div className="space-y-4">
            {!pack.snapshotIsCurrent ? (
              <p className="text-sm text-amber-700">
                No snapshot for {formatPeriod(period)} yet — showing the latest available (
                {formatPeriod(pack.snapshot.period)}).
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Cash" value={fmtUSD(pack.snapshot.cash, { compact: true })} />
              <Kpi label="ARR" value={fmtUSD(pack.snapshot.arr, { compact: true })} />
              <Kpi label="Net burn / mo" value={fmtUSD(pack.snapshot.burn, { compact: true })} />
              <Kpi label="Headcount" value={String(pack.snapshot.headcount)} />
            </div>
            {summary.length > 0 ? (
              <ul className="space-y-0.5 rounded-md border-l-4 border-brand-teal bg-muted/40 p-4 text-sm">
                {summary.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            ) : null}
            {trailing.length >= 2 ? (
              <div>
                <h4 className="mb-1 text-sm font-medium">Cash & ARR, trailing {trailing.length} months</h4>
                <CashChart
                  curves={[
                    { name: "Cash", color: "#3FABBD", values: trailing.map((s) => s.cash) },
                    { name: "ARR", color: "#285FAF", values: trailing.map((s) => s.arr) },
                  ]}
                  height={200}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {MONTH_SHORT[trailing[0].period.getMonth()]} {trailing[0].period.getFullYear()} →{" "}
                  {MONTH_SHORT[trailing[trailing.length - 1].period.getMonth()]}{" "}
                  {trailing[trailing.length - 1].period.getFullYear()}
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <Empty text="No financial snapshots yet." href="/financials" cta="Add financials" />
        )}
      </PackSection>

      {/* 2. Key projects */}
      <PackSection n={2} title="Key projects & initiatives">
        {pack.projects.length === 0 ? (
          <Empty text="No active projects tracked." href="/projects" cta="Add projects" />
        ) : (
          <div className="space-y-4">
            {pack.projects.map((p) => {
              const update = pack.projectUpdates.find((x) => x.u.projectId === p.id);
              const ms = pack.milestones.filter((x) => x.projectId === p.id);
              const done = ms.filter((x) => x.m.status === "DONE").length;
              return (
                <div key={p.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/projects/${p.id}`} className="font-semibold text-primary hover:underline">
                      {p.name}
                    </Link>
                    <ProjectStatusBadge status={update?.u.status ?? p.status} />
                    {ms.length > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {done}/{ms.length} milestones
                      </span>
                    ) : null}
                  </div>
                  {update ? (
                    <>
                      <p className="mt-2 text-sm font-medium">{update.u.headline}</p>
                      {update.u.body ? (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{update.u.body}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-amber-700">No write-up for {formatPeriod(period)} yet.</p>
                  )}
                  {ms.filter((x) => x.m.status !== "DONE").slice(0, 3).length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {ms
                        .filter((x) => x.m.status !== "DONE")
                        .slice(0, 3)
                        .map(({ m }) => (
                          <li key={m.id} className="flex items-center gap-2">
                            <MilestoneStatusBadge status={m.status} />
                            {m.title}
                            {m.dueDate ? ` — due ${formatDateOnly(m.dueDate)}` : ""}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </PackSection>

      {/* 3. Challenges & risks */}
      <PackSection n={3} title="Challenges & risks">
        {pack.risks.length === 0 ? (
          <Empty text="The risk register is empty." href="/risks" cta="Open risk register" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4">Risk</th>
                  <th className="py-2 pr-4">Category</th>
                  <th className="py-2 pr-4">Severity</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Mitigation</th>
                </tr>
              </thead>
              <tbody>
                {pack.risks.map((r) => (
                  <tr key={r.id} className="border-b align-top last:border-0">
                    <td className="py-2.5 pr-4">
                      <Link href={`/risks/${r.id}`} className="font-medium text-primary hover:underline">
                        {r.title}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">{RISK_CATEGORY_LABELS[r.category] ?? r.category}</td>
                    <td className="py-2.5 pr-4">
                      <RiskSeverityBadge likelihood={r.likelihood} impact={r.impact} />
                    </td>
                    <td className="py-2.5 pr-4">
                      <RiskStatusBadge status={r.status} />
                    </td>
                    <td className="py-2.5 text-muted-foreground">{r.mitigation ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PackSection>

      {/* 4. Team */}
      <PackSection n={4} title="Team">
        {pack.teamUpdate ? (
          <div className="space-y-2 text-sm">
            {pack.teamUpdate.headline ? <p className="font-medium">{pack.teamUpdate.headline}</p> : null}
            {pack.teamUpdate.body ? (
              <p className="whitespace-pre-wrap text-muted-foreground">{pack.teamUpdate.body}</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-4">
              {pack.teamUpdate.headcount != null ? <MiniFact label="Headcount" value={String(pack.teamUpdate.headcount)} /> : null}
              {pack.teamUpdate.hires ? <MiniFact label="Hires" value={pack.teamUpdate.hires} /> : null}
              {pack.teamUpdate.departures ? <MiniFact label="Departures" value={pack.teamUpdate.departures} /> : null}
              {pack.teamUpdate.openRoles ? <MiniFact label="Open roles" value={pack.teamUpdate.openRoles} /> : null}
            </div>
          </div>
        ) : (
          <Empty text={`No team update for ${formatPeriod(period)}.`} href="/team" cta="Write team update" />
        )}
      </PackSection>

      {/* 5. Key customers */}
      <PackSection n={5} title="Key customers">
        {pack.customers.length === 0 ? (
          <Empty text="No customers tracked." href="/customers" cta="Add customers" />
        ) : (
          <ul className="space-y-2">
            {pack.customers.map((c) => {
              const u = pack.customerUpdates.find((x) => x.u.customerId === c.id);
              return (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3 text-sm">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                      <CustomerStatusBadge status={c.status} />
                      {c.arr ? <span className="text-xs text-muted-foreground">{fmtUSD(c.arr, { compact: true })} ARR</span> : null}
                    </div>
                    {u?.u.note ? <p className="mt-1 text-muted-foreground">{u.u.note}</p> : null}
                  </div>
                  {u ? <HealthDot health={u.u.health} /> : <span className="text-xs text-amber-700">no update this month</span>}
                </li>
              );
            })}
          </ul>
        )}
      </PackSection>

      {/* 6. Sales & GTM */}
      <PackSection n={6} title="Sales & go-to-market">
        {pack.gtmUpdate ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-4 sm:grid-cols-5">
              <Kpi label="Pipeline" value={fmtUSD(pack.gtmUpdate.pipelineValue, { compact: true })} />
              <Kpi label="Qualified leads" value={String(pack.gtmUpdate.qualifiedLeads)} />
              <Kpi label="New wins" value={String(pack.gtmUpdate.newWins)} />
              <Kpi label="Lost" value={String(pack.gtmUpdate.lostDeals)} />
              <Kpi label="New ARR" value={fmtUSD(pack.gtmUpdate.newArr, { compact: true })} />
            </div>
            {pack.gtmUpdate.headline ? <p className="font-medium">{pack.gtmUpdate.headline}</p> : null}
            {pack.gtmUpdate.body ? <p className="whitespace-pre-wrap text-muted-foreground">{pack.gtmUpdate.body}</p> : null}
          </div>
        ) : (
          <Empty text={`No GTM update for ${formatPeriod(period)}.`} href="/sales" cta="Write GTM update" />
        )}
      </PackSection>

      {/* 7. Narrative reports */}
      {meetingReports.length > 0 ? (
        <PackSection n={7} title="Narrative reports">
          <ul className="space-y-2 text-sm">
            {meetingReports.map((r) => (
              <li key={r.id}>
                <Link href={`/reports/${r.id}`} className="font-medium text-primary hover:underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </PackSection>
      ) : null}

      {/* 8. Agenda, decisions, actions, minutes */}
      <PackSection n={meetingReports.length > 0 ? 8 : 7} title="Meeting: agenda, decisions & minutes">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-semibold">Agenda</h4>
            {agenda.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agenda yet.</p>
            ) : (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {agenda.map((a) => (
                  <li key={a.id}>
                    {a.title} <span className="text-xs text-muted-foreground">({a.durationMin} min)</span>
                  </li>
                ))}
              </ol>
            )}
            <h4 className="mb-2 mt-5 text-sm font-semibold">Decisions & resolutions</h4>
            {meetingResolutions.length === 0 ? (
              <p className="text-sm text-muted-foreground">None recorded for this meeting.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {meetingResolutions.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <Link href={`/resolutions/${r.id}`} className="font-medium text-primary hover:underline">
                      {r.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {RESOLUTION_STATUS_LABELS[r.status as keyof typeof RESOLUTION_STATUS_LABELS] ?? r.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <h4 className="mb-2 mt-5 text-sm font-semibold">Action items</h4>
            {meetingActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {meetingActions.map(({ a, assigneeName, assigneeEmail }) => (
                  <li key={a.id}>
                    {a.title}{" "}
                    <span className="text-xs text-muted-foreground">
                      — {assigneeName ?? assigneeEmail ?? "unassigned"}
                      {a.dueDate ? `, due ${formatDateOnly(a.dueDate)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold">Minutes</h4>
            {meeting.minutes ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{meeting.minutes}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Minutes not written yet — add them on the{" "}
                <Link href={`/meetings/${meeting.id}`} className="text-primary hover:underline">
                  meeting page
                </Link>{" "}
                after the session.
              </p>
            )}
          </div>
        </div>
      </PackSection>
    </div>
  );
}

function PackSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
            {n}
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3 text-xs">
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap font-medium">{value}</p>
    </div>
  );
}

function Empty({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {text}{" "}
      <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
        {cta} →
      </Link>
    </p>
  );
}
