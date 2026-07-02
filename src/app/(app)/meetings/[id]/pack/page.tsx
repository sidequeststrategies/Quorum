import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { db } from "@/lib/db";
import {
  actionItems,
  agendaItems,
  financialPlans,
  financialScenarios,
  meetings,
  reports,
  resolutions,
  users,
} from "@/db/schema";
import { canManage, requireMembership } from "@/lib/session";
import { cycleChecklist } from "@/lib/board-pack";
import { getMeetingCompare } from "@/lib/meeting-compare";
import { captureForecast } from "@/lib/actions/forecasts";
import { financialSummaryLines, fmtUSD } from "@/lib/finance";
import { CashChart } from "@/components/cash-chart";
import { DeltaStat, Transition } from "@/components/delta";
import {
  CustomerStatusBadge,
  HealthDot,
  MilestoneStatusBadge,
  ProjectStatusBadge,
  RiskSeverityBadge,
  RiskStatusBadge,
} from "@/components/report-badges";
import {
  CUSTOMER_HEALTH_LABELS,
  PROJECT_STATUS_LABELS,
  RESOLUTION_STATUS_LABELS,
  RISK_CATEGORY_LABELS,
} from "@/lib/enums";
import { formatDate, formatDateOnly, formatPeriod } from "@/lib/utils";

export default async function MeetingHubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership } = await requireMembership();
  const manager = canManage(membership.role);

  const meetingRows = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.organizationId, membership.organizationId)))
    .limit(1);
  const meeting = meetingRows[0];
  if (!meeting) notFound();

  const period = new Date(meeting.scheduledAt);
  const [cmp, agenda, meetingResolutions, meetingActions, meetingReports, scenarios] = await Promise.all([
    getMeetingCompare(membership.organizationId, meeting),
    db.select().from(agendaItems).where(eq(agendaItems.meetingId, id)).orderBy(asc(agendaItems.order)),
    db.select().from(resolutions).where(eq(resolutions.meetingId, id)),
    db
      .select({ a: actionItems, assigneeName: users.name, assigneeEmail: users.email })
      .from(actionItems)
      .leftJoin(users, eq(actionItems.assigneeId, users.id))
      .where(eq(actionItems.meetingId, id)),
    db.select().from(reports).where(and(eq(reports.meetingId, id), eq(reports.status, "PUBLISHED"))),
    db
      .select({ s: financialScenarios, planName: financialPlans.name })
      .from(financialScenarios)
      .innerJoin(financialPlans, eq(financialScenarios.planId, financialPlans.id))
      .where(eq(financialPlans.organizationId, membership.organizationId))
      .orderBy(desc(financialPlans.updatedAt), asc(financialScenarios.name)),
  ]);

  const { pack, prevMeeting } = cmp;
  const checklist = cycleChecklist(pack);
  const missing = checklist.filter((c) => !c.done);
  const summary = pack.snapshot ? financialSummaryLines(pack.snapshots) : [];
  const trailing = pack.snapshots.slice(-12);
  const fc = cmp.forecast;

  let n = 0;
  const next = () => ++n;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {meeting.title} — {formatPeriod(period)}
          </h1>
          <p className="text-muted-foreground">
            {formatDate(meeting.scheduledAt)}
            {prevMeeting
              ? ` · changes shown vs ${prevMeeting.title} (${formatDateOnly(prevMeeting.scheduledAt)})`
              : " · first meeting on record — no comparison baseline yet"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/meetings/${meeting.id}`}>Logistics & agenda</Link>
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

      {/* Financials */}
      <PackSection n={next()} title="Financials">
        {pack.snapshot ? (
          <div className="space-y-4">
            {!pack.snapshotIsCurrent ? (
              <p className="text-sm text-amber-700">
                No snapshot for {formatPeriod(period)} yet — showing the latest available (
                {formatPeriod(pack.snapshot.period)}).
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {cmp.financialDeltas.map((d) => (
                <DeltaStat key={d.key} d={d} />
              ))}
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
              </div>
            ) : null}
          </div>
        ) : (
          <Empty text="No financial snapshots yet." href="/financials" cta="Add financials" />
        )}
      </PackSection>

      {/* Forecast vs last meeting */}
      <PackSection n={next()} title="Forecast — how the forward view moved">
        <div className="space-y-4">
          {fc.current && fc.previous ? (
            <>
              <div>
                <h4 className="mb-1 text-sm font-medium">
                  Projected cash: this meeting vs {prevMeeting ? formatDateOnly(prevMeeting.scheduledAt) : "prior"}
                </h4>
                <CashChart
                  curves={[
                    {
                      name: `Now (${fc.current.name})`,
                      color: "#3FABBD",
                      values: fc.current.projection.rows.map((r) => r.endingCash),
                    },
                    {
                      name: `Last meeting (${fc.previous.name})`,
                      color: "#B45309",
                      values: fc.previous.projection.rows.map((r) => r.endingCash),
                    },
                  ]}
                  height={200}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full max-w-2xl text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4">Headline</th>
                      <th className="py-2 pr-4">Last meeting</th>
                      <th className="py-2 pr-4">This meeting</th>
                      <th className="py-2">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ForecastRow
                      label="Runway"
                      prev={fc.previous.runwayMonths != null ? `${fc.previous.runwayMonths} mo` : "CF positive"}
                      cur={fc.current.runwayMonths != null ? `${fc.current.runwayMonths} mo` : "CF positive"}
                      change={
                        fc.current.runwayMonths != null && fc.previous.runwayMonths != null
                          ? fc.current.runwayMonths - fc.previous.runwayMonths
                          : null
                      }
                      unit=" mo"
                    />
                    <ForecastRow
                      label={`Ending ARR (M${fc.current.horizonMonths})`}
                      prev={fmtUSD(fc.previous.endingArr, { compact: true })}
                      cur={fmtUSD(fc.current.endingArr, { compact: true })}
                      change={fc.current.endingArr - fc.previous.endingArr}
                      money
                    />
                    <ForecastRow
                      label="Ending cash"
                      prev={fmtUSD(fc.previous.endingCash, { compact: true })}
                      cur={fmtUSD(fc.current.endingCash, { compact: true })}
                      change={fc.current.endingCash - fc.previous.endingCash}
                      money
                    />
                    <ForecastRow
                      label="Breakeven month"
                      prev={fc.previous.breakevenMonth != null ? `M${fc.previous.breakevenMonth}` : "beyond horizon"}
                      cur={fc.current.breakevenMonth != null ? `M${fc.current.breakevenMonth}` : "beyond horizon"}
                      change={
                        fc.current.breakevenMonth != null && fc.previous.breakevenMonth != null
                          ? fc.previous.breakevenMonth - fc.current.breakevenMonth // earlier is better
                          : null
                      }
                      unit=" mo earlier"
                    />
                  </tbody>
                </table>
              </div>
            </>
          ) : fc.current ? (
            <p className="text-sm text-muted-foreground">
              Forecast captured for this meeting ({fc.current.name}, {formatDateOnly(fc.current.createdAt)}).{" "}
              {prevMeeting
                ? "No forecast was captured at the previous meeting, so there's nothing to compare against yet — the comparison starts next meeting."
                : "Comparisons begin once a second meeting has a captured forecast."}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No forecast captured for this meeting yet.
              {manager && scenarios.length === 0 ? (
                <>
                  {" "}
                  Create a scenario plan under{" "}
                  <Link href="/financials" className="text-primary hover:underline">
                    Financials
                  </Link>{" "}
                  first.
                </>
              ) : null}
            </p>
          )}

          {manager && scenarios.length > 0 ? (
            <form action={captureForecast} className="flex flex-wrap items-end gap-2 border-t pt-4">
              <input type="hidden" name="meetingId" value={meeting.id} />
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {fc.current ? "Re-capture the forecast for this meeting" : "Capture the current forecast for this meeting"}
                </p>
                <Select name="scenarioId" defaultValue={fc.current?.sourceScenarioId ?? scenarios[0].s.id}>
                  <SelectTrigger className="w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios.map(({ s, planName }) => (
                      <SelectItem key={s.id} value={s.id}>
                        {planName} — {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit">Capture forecast</Button>
            </form>
          ) : null}
        </div>
      </PackSection>

      {/* Key projects */}
      <PackSection n={next()} title="Key projects & initiatives">
        {pack.projects.length === 0 ? (
          <Empty text="No active projects tracked." href="/projects" cta="Add projects" />
        ) : (
          <div className="space-y-4">
            {pack.projects.map((p) => {
              const update = pack.projectUpdates.find((x) => x.u.projectId === p.id);
              const ms = pack.milestones.filter((x) => x.projectId === p.id);
              const done = ms.filter((x) => x.m.status === "DONE").length;
              const change = cmp.projectChanges.find((x) => x.projectId === p.id);
              return (
                <div key={p.id} className="rounded-md border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/projects/${p.id}`} className="font-semibold text-primary hover:underline">
                      {p.name}
                    </Link>
                    <ProjectStatusBadge status={change?.currentStatus ?? p.status} />
                    {change?.isNew ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                        New since last meeting
                      </span>
                    ) : (
                      <Transition
                        from={change?.previousStatus ?? null}
                        to={change?.currentStatus ?? null}
                        labels={PROJECT_STATUS_LABELS}
                        quiet
                      />
                    )}
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

      {/* Challenges & risks */}
      <PackSection
        n={next()}
        title="Challenges & risks"
        subtitle={
          prevMeeting
            ? `${cmp.newRisks.length} new and ${cmp.closedRiskCount} closed since last meeting`
            : undefined
        }
      >
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
                {pack.risks.map((r) => {
                  const isNew = cmp.newRisks.some((x) => x.id === r.id);
                  return (
                    <tr key={r.id} className="border-b align-top last:border-0">
                      <td className="py-2.5 pr-4">
                        <Link href={`/risks/${r.id}`} className="font-medium text-primary hover:underline">
                          {r.title}
                        </Link>
                        {isNew ? (
                          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                            new
                          </span>
                        ) : null}
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PackSection>

      {/* Team */}
      <PackSection
        n={next()}
        title="Team"
        subtitle={
          cmp.headcountDelta != null && cmp.headcountDelta !== 0
            ? `headcount ${cmp.headcountDelta > 0 ? "+" : ""}${cmp.headcountDelta} since last meeting`
            : undefined
        }
      >
        {pack.teamUpdate ? (
          <div className="space-y-2 text-sm">
            {pack.teamUpdate.headline ? <p className="font-medium">{pack.teamUpdate.headline}</p> : null}
            {pack.teamUpdate.body ? (
              <p className="whitespace-pre-wrap text-muted-foreground">{pack.teamUpdate.body}</p>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-4">
              {pack.teamUpdate.headcount != null ? (
                <MiniFact label="Headcount" value={String(pack.teamUpdate.headcount)} />
              ) : null}
              {pack.teamUpdate.hires ? <MiniFact label="Hires" value={pack.teamUpdate.hires} /> : null}
              {pack.teamUpdate.departures ? <MiniFact label="Departures" value={pack.teamUpdate.departures} /> : null}
              {pack.teamUpdate.openRoles ? <MiniFact label="Open roles" value={pack.teamUpdate.openRoles} /> : null}
            </div>
          </div>
        ) : (
          <Empty text={`No team update for ${formatPeriod(period)}.`} href="/team" cta="Write team update" />
        )}
      </PackSection>

      {/* Key customers */}
      <PackSection n={next()} title="Key customers">
        {pack.customers.length === 0 ? (
          <Empty text="No customers tracked." href="/customers" cta="Add customers" />
        ) : (
          <ul className="space-y-2">
            {pack.customers.map((c) => {
              const u = pack.customerUpdates.find((x) => x.u.customerId === c.id);
              const change = cmp.customerChanges.find((x) => x.customerId === c.id);
              return (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border p-3 text-sm">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/customers/${c.id}`} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                      <CustomerStatusBadge status={c.status} />
                      {c.arr ? (
                        <span className="text-xs text-muted-foreground">{fmtUSD(c.arr, { compact: true })} ARR</span>
                      ) : null}
                      <Transition
                        from={change?.previousHealth ?? null}
                        to={change?.currentHealth ?? null}
                        labels={CUSTOMER_HEALTH_LABELS}
                        quiet
                      />
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

      {/* Sales & GTM */}
      <PackSection n={next()} title="Sales & go-to-market">
        {pack.gtmUpdate ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-3 sm:grid-cols-4">
              {cmp.gtmDeltas.map((d) => (
                <DeltaStat key={d.key} d={d} />
              ))}
            </div>
            {pack.gtmUpdate.headline ? <p className="font-medium">{pack.gtmUpdate.headline}</p> : null}
            {pack.gtmUpdate.body ? <p className="whitespace-pre-wrap text-muted-foreground">{pack.gtmUpdate.body}</p> : null}
          </div>
        ) : (
          <Empty text={`No GTM update for ${formatPeriod(period)}.`} href="/sales" cta="Write GTM update" />
        )}
      </PackSection>

      {/* Narrative reports */}
      {meetingReports.length > 0 ? (
        <PackSection n={next()} title="Narrative reports">
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

      {/* Agenda, decisions, actions, minutes */}
      <PackSection n={next()} title="Meeting: agenda, decisions & minutes">
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

function PackSection({
  n,
  title,
  subtitle,
  children,
}: {
  n: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
            {n}
          </span>
          {title}
          {subtitle ? <span className="text-sm font-normal text-muted-foreground">· {subtitle}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ForecastRow({
  label,
  prev,
  cur,
  change,
  money,
  unit = "",
}: {
  label: string;
  prev: string;
  cur: string;
  change: number | null;
  money?: boolean;
  unit?: string;
}) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4 font-medium">{label}</td>
      <td className="py-2 pr-4 text-muted-foreground">{prev}</td>
      <td className="py-2 pr-4">{cur}</td>
      <td className={`py-2 text-xs font-medium ${change == null || change === 0 ? "text-muted-foreground" : change > 0 ? "text-emerald-700" : "text-red-700"}`}>
        {change == null
          ? "—"
          : change === 0
            ? "unchanged"
            : `${change > 0 ? "+" : "−"}${money ? fmtUSD(Math.abs(change), { compact: true }) : Math.abs(change)}${money ? "" : unit}`}
      </td>
    </tr>
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
