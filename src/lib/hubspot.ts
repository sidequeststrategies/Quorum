// HubSpot → funnel sync. Pulls the live deal pipeline from HubSpot's CRM API
// and turns it into the same shapes the Excel importer produces: monthly
// FunnelSnapshot rows (stage counts + pipeline value, source='hubspot') and
// per-stage time-in-stage metrics (FunnelStageMetric) that the Excel path
// can't provide — actual velocity from stage-entry/exit timestamps.
//
// Configuration (all server-side env):
//   HUBSPOT_ACCESS_TOKEN — private-app token, scope crm.objects.deals.read.
//     Unset → the integration is off; UI falls back to Excel-imported funnel.
//   HUBSPOT_PIPELINE_ID  — pipeline to read (default "default").
//   HUBSPOT_STAGE_MAP    — optional JSON { "<hubspot stage id>": "<FunnelStage>" }
//     overriding DEFAULT_STAGE_MAP below (which matches AssetCool's pipeline).
//
// Monetary values use HubSpot's amount_in_home_currency (the portal's home
// currency — GBP for AssetCool), so multi-currency deals aggregate correctly.

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { funnelSnapshots, funnelStageMetrics } from "@/db/schema";
import { FUNNEL_PATH, FUNNEL_STAGES, type FunnelStage } from "@/lib/funnel";

export function hubspotConfigured(): boolean {
  return !!process.env.HUBSPOT_ACCESS_TOKEN;
}

// AssetCool's Sales Pipeline squashed onto the app's funnel path, preserving
// stage order: Qualified Lead → LEAD; Discovery + Technical Due Diligence →
// QUALIFIED; Proposal → PROPOSAL; Negotiation + Procurement/Contracting →
// NEGOTIATION. "On Hold" (5131910381) is deliberately unmapped: parked deals
// are neither progressing nor lost, so they don't belong on the funnel.
const DEFAULT_STAGE_MAP: Record<string, FunnelStage> = {
  appointmentscheduled: "LEAD",
  qualifiedtobuy: "QUALIFIED",
  presentationscheduled: "QUALIFIED",
  decisionmakerboughtin: "PROPOSAL",
  contractsent: "NEGOTIATION",
  "5131910380": "NEGOTIATION",
  closedwon: "CLOSED_WON",
  closedlost: "CLOSED_LOST",
};

export function getStageMap(): Record<string, FunnelStage> {
  const raw = process.env.HUBSPOT_STAGE_MAP;
  if (!raw) return DEFAULT_STAGE_MAP;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const map: Record<string, FunnelStage> = {};
    for (const [hs, stage] of Object.entries(parsed)) {
      if ((FUNNEL_STAGES as readonly string[]).includes(stage)) map[hs] = stage as FunnelStage;
    }
    if (Object.keys(map).length > 0) return map;
  } catch (e) {
    console.error("HUBSPOT_STAGE_MAP is not valid JSON; using default map:", (e as Error).message);
  }
  return DEFAULT_STAGE_MAP;
}

// ── Fetch ────────────────────────────────────────────────────────────────────

export type HubSpotDeal = {
  id: string;
  pipeline: string | null;
  dealstage: string | null;
  amountHome: number | null; // amount_in_home_currency
  createdAt: Date | null;
  // Latest entry/exit per HubSpot stage id (hs_v2_date_entered_* / _exited_*).
  enteredByStage: Record<string, Date>;
  exitedByStage: Record<string, Date>;
};

const HS_BASE = "https://api.hubapi.com";

function parseDate(s: unknown): Date | null {
  if (typeof s !== "string" || !s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchAllDeals(stageIds: string[]): Promise<HubSpotDeal[]> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN is not set");

  const properties = [
    "pipeline",
    "dealstage",
    "amount_in_home_currency",
    "createdate",
    ...stageIds.flatMap((s) => [`hs_v2_date_entered_${s}`, `hs_v2_date_exited_${s}`]),
  ].join(",");

  const deals: HubSpotDeal[] = [];
  let after: string | undefined;
  // 100 per page; hard stop well above any realistic deal count so a bad
  // paging cursor can never loop forever.
  for (let page = 0; page < 200; page++) {
    const url = new URL(`${HS_BASE}/crm/v3/objects/deals`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("archived", "false");
    url.searchParams.set("properties", properties);
    if (after) url.searchParams.set("after", after);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HubSpot deals fetch failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      results: { id: string; properties: Record<string, string | null> }[];
      paging?: { next?: { after?: string } };
    };

    for (const r of json.results) {
      const p = r.properties ?? {};
      const enteredByStage: Record<string, Date> = {};
      const exitedByStage: Record<string, Date> = {};
      for (const s of stageIds) {
        const entered = parseDate(p[`hs_v2_date_entered_${s}`]);
        const exited = parseDate(p[`hs_v2_date_exited_${s}`]);
        if (entered) enteredByStage[s] = entered;
        if (exited) exitedByStage[s] = exited;
      }
      const amount = p.amount_in_home_currency != null ? Number(p.amount_in_home_currency) : null;
      deals.push({
        id: r.id,
        pipeline: p.pipeline ?? null,
        dealstage: p.dealstage ?? null,
        amountHome: amount != null && isFinite(amount) ? amount : null,
        createdAt: parseDate(p.createdate),
        enteredByStage,
        exitedByStage,
      });
    }

    after = json.paging?.next?.after;
    if (!after) break;
  }
  return deals;
}

// ── Compute ──────────────────────────────────────────────────────────────────

export type ComputedFunnel = {
  // One entry per (YYYY-MM, stage) covering every month in range.
  snapshots: { month: string; stage: FunnelStage; count: number; value: number }[];
  // Per app stage: actual time-in-stage from HubSpot's entry/exit timestamps.
  metrics: {
    stage: FunnelStage;
    avgDaysInStage: number | null; // completed visits (entered and exited)
    avgOpenAgeDays: number | null; // deals currently sitting in the stage
    completedCount: number;
    openCount: number;
  }[];
};

const DAY_MS = 24 * 3600 * 1000;
const MAX_HISTORY_MONTHS = 24;

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthStartUTC(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}
function nextMonthStartUTC(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1));
}

// Effective stage interval, tolerant of re-entry: HubSpot's v2 properties hold
// the LATEST entry/exit, so an exit timestamp at or before the entry means the
// deal came back and is in the stage from `entered` onward.
function stageInterval(deal: HubSpotDeal, hsStage: string): { entered: Date; exited: Date | null } | null {
  const entered = deal.enteredByStage[hsStage];
  if (!entered) return null;
  const exited = deal.exitedByStage[hsStage] ?? null;
  return { entered, exited: exited && exited.getTime() > entered.getTime() ? exited : null };
}

export function computeFunnelFromDeals(
  deals: HubSpotDeal[],
  opts: { stageMap: Record<string, FunnelStage>; pipelineId: string; now?: Date }
): ComputedFunnel {
  const now = opts.now ?? new Date();
  const inPipeline = deals.filter((d) => (d.pipeline ?? "default") === opts.pipelineId);

  const hsStages = Object.keys(opts.stageMap);
  const openHsStages = hsStages.filter((s) => !["CLOSED_WON", "CLOSED_LOST"].includes(opts.stageMap[s]));
  const closedHsStages = hsStages.filter((s) => ["CLOSED_WON", "CLOSED_LOST"].includes(opts.stageMap[s]));

  // Month range: first stage-entry (or deal creation) → current month.
  let earliest = now;
  for (const d of inPipeline) {
    for (const t of Object.values(d.enteredByStage)) if (t < earliest) earliest = t;
    if (d.createdAt && d.createdAt < earliest) earliest = d.createdAt;
  }
  const floor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MAX_HISTORY_MONTHS - 1), 1));
  if (earliest < floor) earliest = floor;

  const months: string[] = [];
  for (let cur = new Date(Date.UTC(earliest.getUTCFullYear(), earliest.getUTCMonth(), 1)); cur <= now; cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1))) {
    months.push(monthKey(cur));
  }

  const snapshots: ComputedFunnel["snapshots"] = [];
  for (const month of months) {
    // Point-in-time instant for open stages: end of month, or "now" for the
    // month in progress.
    const monthEnd = new Date(Math.min(nextMonthStartUTC(month).getTime() - 1, now.getTime()));
    const mStart = monthStartUTC(month).getTime();
    const mNext = nextMonthStartUTC(month).getTime();

    const counts = new Map<FunnelStage, number>();
    const values = new Map<FunnelStage, number>();
    for (const s of FUNNEL_STAGES) {
      counts.set(s, 0);
      values.set(s, 0);
    }

    for (const deal of inPipeline) {
      const value = Math.round(deal.amountHome ?? 0);
      // Open stages: which stage was the deal sitting in at month end?
      for (const hs of openHsStages) {
        const iv = stageInterval(deal, hs);
        if (!iv) continue;
        if (iv.entered <= monthEnd && (!iv.exited || iv.exited > monthEnd)) {
          const stage = opts.stageMap[hs];
          counts.set(stage, counts.get(stage)! + 1);
          values.set(stage, values.get(stage)! + value);
          break; // a deal occupies one stage at a time
        }
      }
      // Closed stages: movement during the month (wins/losses this month).
      for (const hs of closedHsStages) {
        const entered = deal.enteredByStage[hs];
        if (!entered) continue;
        const t = entered.getTime();
        if (t >= mStart && t < mNext) {
          const stage = opts.stageMap[hs];
          counts.set(stage, counts.get(stage)! + 1);
          values.set(stage, values.get(stage)! + value);
        }
      }
    }

    for (const stage of FUNNEL_STAGES) {
      snapshots.push({ month, stage, count: counts.get(stage)!, value: values.get(stage)! });
    }
  }

  // Time-in-stage: completed visits + current dwell time, per app stage.
  const completed = new Map<FunnelStage, number[]>();
  const open = new Map<FunnelStage, number[]>();
  for (const s of FUNNEL_STAGES) {
    completed.set(s, []);
    open.set(s, []);
  }
  for (const deal of inPipeline) {
    for (const hs of openHsStages) {
      const iv = stageInterval(deal, hs);
      if (!iv) continue;
      const stage = opts.stageMap[hs];
      if (iv.exited) {
        completed.get(stage)!.push((iv.exited.getTime() - iv.entered.getTime()) / DAY_MS);
      } else if (deal.dealstage === hs) {
        open.get(stage)!.push((now.getTime() - iv.entered.getTime()) / DAY_MS);
      }
    }
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const metrics = FUNNEL_PATH.filter((s) => s !== "CLOSED_WON").map((stage) => ({
    stage,
    avgDaysInStage: avg(completed.get(stage)!),
    avgOpenAgeDays: avg(open.get(stage)!),
    completedCount: completed.get(stage)!.length,
    openCount: open.get(stage)!.length,
  }));

  return { snapshots, metrics };
}

// ── Sync (fetch + compute + upsert) ─────────────────────────────────────────

export type SyncResult = { deals: number; months: number; syncedAt: Date };

export async function syncHubSpotFunnel(orgId: string): Promise<SyncResult> {
  const stageMap = getStageMap();
  const pipelineId = process.env.HUBSPOT_PIPELINE_ID ?? "default";
  const deals = await fetchAllDeals(Object.keys(stageMap));
  const computed = computeFunnelFromDeals(deals, { stageMap, pipelineId });
  const syncedAt = new Date();
  await writeFunnel(orgId, computed, syncedAt);
  const monthCount = new Set(computed.snapshots.map((s) => s.month)).size;
  return { deals: deals.length, months: monthCount, syncedAt };
}

// The persistence half of the sync, separated so tests/fixtures can exercise
// the exact production write path without a HubSpot token.
export async function writeFunnel(orgId: string, { snapshots, metrics }: ComputedFunnel, syncedAt: Date): Promise<void> {
  for (const s of snapshots) {
    await db
      .insert(funnelSnapshots)
      .values({
        organizationId: orgId,
        period: monthStartUTC(s.month),
        stage: s.stage,
        count: s.count,
        value: s.value,
        source: "hubspot",
      })
      .onConflictDoUpdate({
        target: [funnelSnapshots.organizationId, funnelSnapshots.period, funnelSnapshots.stage],
        set: { count: s.count, value: s.value, source: "hubspot" },
      });
  }

  for (const m of metrics) {
    await db
      .insert(funnelStageMetrics)
      .values({
        organizationId: orgId,
        stage: m.stage,
        avgDaysInStage: m.avgDaysInStage,
        avgOpenAgeDays: m.avgOpenAgeDays,
        completedCount: m.completedCount,
        openCount: m.openCount,
        syncedAt,
      })
      .onConflictDoUpdate({
        target: [funnelStageMetrics.organizationId, funnelStageMetrics.stage],
        set: {
          avgDaysInStage: m.avgDaysInStage,
          avgOpenAgeDays: m.avgOpenAgeDays,
          completedCount: m.completedCount,
          openCount: m.openCount,
          syncedAt,
        },
      });
  }
}

// Refresh on page view when the last sync is stale. Never throws — a HubSpot
// outage must not take down the financials page; the stored snapshot serves.
const SYNC_TTL_MS = 12 * 3600 * 1000;

export async function maybeAutoSyncHubSpotFunnel(orgId: string): Promise<void> {
  if (!hubspotConfigured()) return;
  try {
    const last = await db
      .select({ syncedAt: funnelStageMetrics.syncedAt })
      .from(funnelStageMetrics)
      .where(and(eq(funnelStageMetrics.organizationId, orgId)))
      .orderBy(desc(funnelStageMetrics.syncedAt))
      .limit(1);
    if (last[0] && Date.now() - last[0].syncedAt.getTime() < SYNC_TTL_MS) return;
    await syncHubSpotFunnel(orgId);
  } catch (e) {
    console.error("HubSpot auto-sync failed:", (e as Error).message);
  }
}
