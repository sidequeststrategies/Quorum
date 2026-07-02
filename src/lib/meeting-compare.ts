// Meeting-over-meeting comparison. The meeting is the top of the org tree:
// this module assembles the current meeting's pack, the previous meeting's
// pack, and computed deltas for every section — so the hub can show "what
// changed since the board last met" without any manual bookkeeping.

import { and, desc, eq, lt, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { forecastSnapshots, meetings, type Meeting, type ForecastSnapshot } from "@/db/schema";
import { getBoardPackData, type BoardPackData } from "@/lib/board-pack";
import { projectScenario, type ProjectionSummary, type ScenarioAssumptions } from "@/lib/finance";

export type MetricDelta = {
  key: string;
  label: string;
  current: number | null;
  previous: number | null;
  delta: number | null; // current - previous
  goodWhenUp: boolean; // burn is good when down
  money: boolean;
  pct?: boolean;
};

export type ProjectChange = {
  projectId: string;
  name: string;
  currentStatus: string;
  previousStatus: string | null; // null = new since last meeting
  isNew: boolean;
};

export type CustomerChange = {
  customerId: string;
  name: string;
  currentHealth: string | null;
  previousHealth: string | null;
};

export type ForecastComparison = {
  current: (ForecastSnapshot & { projection: ProjectionSummary }) | null;
  previous: (ForecastSnapshot & { projection: ProjectionSummary }) | null;
};

export type MeetingCompare = {
  meeting: Meeting;
  prevMeeting: Meeting | null;
  pack: BoardPackData;
  prevPack: BoardPackData | null;
  financialDeltas: MetricDelta[];
  projectChanges: ProjectChange[];
  customerChanges: CustomerChange[];
  newRisks: BoardPackData["risks"];
  closedRiskCount: number;
  gtmDeltas: MetricDelta[];
  headcountDelta: number | null;
  forecast: ForecastComparison;
};

function delta(
  key: string,
  label: string,
  current: number | null | undefined,
  previous: number | null | undefined,
  opts: { goodWhenUp?: boolean; money?: boolean; pct?: boolean } = {}
): MetricDelta {
  const c = current ?? null;
  const p = previous ?? null;
  return {
    key,
    label,
    current: c,
    previous: p,
    delta: c != null && p != null ? c - p : null,
    goodWhenUp: opts.goodWhenUp ?? true,
    money: opts.money ?? true,
    pct: opts.pct,
  };
}

function withProjection(f: ForecastSnapshot): ForecastSnapshot & { projection: ProjectionSummary } {
  const assumptions = JSON.parse(f.assumptions) as ScenarioAssumptions;
  return { ...f, projection: projectScenario(f.startingCash, f.startMonth, f.horizonMonths, assumptions) };
}

export async function getMeetingCompare(organizationId: string, meeting: Meeting): Promise<MeetingCompare> {
  const prevRows = await db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.organizationId, organizationId),
        lt(meetings.scheduledAt, meeting.scheduledAt),
        ne(meetings.status, "CANCELLED")
      )
    )
    .orderBy(desc(meetings.scheduledAt))
    .limit(1);
  const prevMeeting = prevRows[0] ?? null;

  const [pack, prevPack, meetingForecasts, prevForecasts] = await Promise.all([
    getBoardPackData(organizationId, new Date(meeting.scheduledAt)),
    prevMeeting
      ? getBoardPackData(organizationId, new Date(prevMeeting.scheduledAt))
      : Promise.resolve(null),
    db.select().from(forecastSnapshots).where(eq(forecastSnapshots.meetingId, meeting.id)).orderBy(desc(forecastSnapshots.createdAt)),
    prevMeeting
      ? db
          .select()
          .from(forecastSnapshots)
          .where(eq(forecastSnapshots.meetingId, prevMeeting.id))
          .orderBy(desc(forecastSnapshots.createdAt))
      : Promise.resolve([]),
  ]);

  // ── Financial deltas ──
  const cur = pack.snapshot;
  const prev = prevPack?.snapshot ?? null;
  const runway = (s: typeof cur) => (s && s.burn > 0 ? Math.floor(s.cash / s.burn) : null);
  const financialDeltas: MetricDelta[] = cur
    ? [
        delta("cash", "Cash", cur.cash, prev?.cash),
        delta("arr", "ARR", cur.arr, prev?.arr),
        delta("revenue", "Revenue / mo", cur.revenue, prev?.revenue),
        delta("burn", "Net burn / mo", cur.burn, prev?.burn, { goodWhenUp: false }),
        delta("runway", "Runway (months)", runway(cur), prev ? runway(prev) : null, { money: false }),
        delta("grossMargin", "Gross margin %", cur.grossMargin, prev?.grossMargin, { money: false, pct: true }),
        delta("headcount", "Headcount", cur.headcount, prev?.headcount, { money: false }),
      ]
    : [];

  // ── Project changes: current status vs status reported at the previous meeting ──
  const prevProjectStatus = new Map<string, string>();
  for (const p of prevPack?.projects ?? []) prevProjectStatus.set(p.id, p.status);
  for (const u of prevPack?.projectUpdates ?? []) prevProjectStatus.set(u.u.projectId, u.u.status);
  const prevDate = prevMeeting ? new Date(prevMeeting.scheduledAt) : null;
  const projectChanges: ProjectChange[] = pack.projects.map((p) => {
    const currentStatus = pack.projectUpdates.find((x) => x.u.projectId === p.id)?.u.status ?? p.status;
    const previousStatus = prevProjectStatus.get(p.id) ?? null;
    return {
      projectId: p.id,
      name: p.name,
      currentStatus,
      previousStatus,
      isNew: !previousStatus && !!prevDate && new Date(p.createdAt) > prevDate,
    };
  });

  // ── Customer health movement ──
  const prevHealth = new Map<string, string>();
  for (const u of prevPack?.customerUpdates ?? []) prevHealth.set(u.u.customerId, u.u.health);
  const customerChanges: CustomerChange[] = pack.customers.map((c) => ({
    customerId: c.id,
    name: c.name,
    currentHealth: pack.customerUpdates.find((x) => x.u.customerId === c.id)?.u.health ?? null,
    previousHealth: prevHealth.get(c.id) ?? null,
  }));

  // ── Risks: new since the previous meeting; closed since it ──
  const newRisks = prevDate ? pack.risks.filter((r) => new Date(r.createdAt) > prevDate) : [];
  const prevOpenIds = new Set((prevPack?.risks ?? []).map((r) => r.id));
  const currentOpenIds = new Set(pack.risks.map((r) => r.id));
  const closedRiskCount = prevDate ? [...prevOpenIds].filter((id) => !currentOpenIds.has(id)).length : 0;

  // ── Sales & GTM deltas ──
  const g = pack.gtmUpdate;
  const pg = prevPack?.gtmUpdate ?? null;
  const gtmDeltas: MetricDelta[] = g
    ? [
        delta("pipeline", "Pipeline", g.pipelineValue, pg?.pipelineValue),
        delta("leads", "Qualified leads", g.qualifiedLeads, pg?.qualifiedLeads, { money: false }),
        delta("wins", "New wins", g.newWins, pg?.newWins, { money: false }),
        delta("newArr", "New ARR", g.newArr, pg?.newArr),
      ]
    : [];

  const headcountDelta =
    pack.teamUpdate?.headcount != null && prevPack?.teamUpdate?.headcount != null
      ? pack.teamUpdate.headcount - prevPack.teamUpdate.headcount
      : null;

  // ── Forecast comparison: prefer same-named snapshots (e.g. "Base case") ──
  const currentForecast = meetingForecasts[0] ?? null;
  const previousForecast = currentForecast
    ? (prevForecasts.find((f) => f.name === currentForecast.name) ?? prevForecasts[0] ?? null)
    : (prevForecasts[0] ?? null);

  return {
    meeting,
    prevMeeting,
    pack,
    prevPack,
    financialDeltas,
    projectChanges,
    customerChanges,
    newRisks,
    closedRiskCount,
    gtmDeltas,
    headcountDelta,
    forecast: {
      current: currentForecast ? withProjection(currentForecast) : null,
      previous: previousForecast ? withProjection(previousForecast) : null,
    },
  };
}
