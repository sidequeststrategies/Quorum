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

// ── Pipeline report (deal-level export for /pipelinereport) ────────────────
//
// The interactive pipeline report renders individual deals, not monthly
// aggregates, so it fetches its own richer deal list (with company
// associations for customer/region) and maps to the shape the report's
// embedded script expects. Fields the CRM can't provide degrade to em-dashes.

export type PipelineReportDeal = {
  id: string;
  name: string;
  customer: string;
  region: string;
  country: string;
  flag: string; // emoji
  value: number; // portal home currency (GBP for AssetCool)
  stage: string; // HubSpot stage id — matches the report's STAGES keys
  priority: "high" | "medium" | "low";
  enteredFunnel: string; // ISO date
  stageEntered: string; // ISO date
  closeQuarter: number; // 0 = current quarter
  probability: number | null; // per-deal close probability, 0–1 (stage default unless overridden in HubSpot)
  product: string;
  scope: string;
  contact: { name: string; title: string };
  hubspotUrl: string;
  notes: string;
};

// AssetCool's HubSpot portal; override per client.
const DEFAULT_PORTAL_ID = "147939934";
const DEFAULT_UI_DOMAIN = "app-eu1.hubspot.com";

// Company `country` (free text, lowercased) → region bucket + ISO code for
// the flag emoji. Unknown countries land in "Other" with a globe.
const COUNTRY_INFO: Record<string, { iso: string; region: string }> = {
  "united states": { iso: "US", region: "North America" },
  usa: { iso: "US", region: "North America" },
  us: { iso: "US", region: "North America" },
  canada: { iso: "CA", region: "North America" },
  mexico: { iso: "MX", region: "North America" },
  "united kingdom": { iso: "GB", region: "Europe" },
  uk: { iso: "GB", region: "Europe" },
  england: { iso: "GB", region: "Europe" },
  scotland: { iso: "GB", region: "Europe" },
  ireland: { iso: "IE", region: "Europe" },
  spain: { iso: "ES", region: "Europe" },
  france: { iso: "FR", region: "Europe" },
  germany: { iso: "DE", region: "Europe" },
  italy: { iso: "IT", region: "Europe" },
  portugal: { iso: "PT", region: "Europe" },
  netherlands: { iso: "NL", region: "Europe" },
  belgium: { iso: "BE", region: "Europe" },
  sweden: { iso: "SE", region: "Europe" },
  norway: { iso: "NO", region: "Europe" },
  denmark: { iso: "DK", region: "Europe" },
  finland: { iso: "FI", region: "Europe" },
  estonia: { iso: "EE", region: "Europe" },
  latvia: { iso: "LV", region: "Europe" },
  lithuania: { iso: "LT", region: "Europe" },
  poland: { iso: "PL", region: "Europe" },
  switzerland: { iso: "CH", region: "Europe" },
  austria: { iso: "AT", region: "Europe" },
  greece: { iso: "GR", region: "Europe" },
  brazil: { iso: "BR", region: "South America" },
  chile: { iso: "CL", region: "South America" },
  argentina: { iso: "AR", region: "South America" },
  colombia: { iso: "CO", region: "South America" },
  peru: { iso: "PE", region: "South America" },
  uruguay: { iso: "UY", region: "South America" },
  ecuador: { iso: "EC", region: "South America" },
  india: { iso: "IN", region: "Asia Pacific" },
  china: { iso: "CN", region: "Asia Pacific" },
  japan: { iso: "JP", region: "Asia Pacific" },
  "south korea": { iso: "KR", region: "Asia Pacific" },
  australia: { iso: "AU", region: "Asia Pacific" },
  "new zealand": { iso: "NZ", region: "Asia Pacific" },
  singapore: { iso: "SG", region: "Asia Pacific" },
  indonesia: { iso: "ID", region: "Asia Pacific" },
  vietnam: { iso: "VN", region: "Asia Pacific" },
  thailand: { iso: "TH", region: "Asia Pacific" },
  philippines: { iso: "PH", region: "Asia Pacific" },
  malaysia: { iso: "MY", region: "Asia Pacific" },
  "united arab emirates": { iso: "AE", region: "Middle East & Africa" },
  "saudi arabia": { iso: "SA", region: "Middle East & Africa" },
  qatar: { iso: "QA", region: "Middle East & Africa" },
  "south africa": { iso: "ZA", region: "Middle East & Africa" },
  egypt: { iso: "EG", region: "Middle East & Africa" },
  nigeria: { iso: "NG", region: "Middle East & Africa" },
  kenya: { iso: "KE", region: "Middle East & Africa" },
  morocco: { iso: "MA", region: "Middle East & Africa" },
  israel: { iso: "IL", region: "Middle East & Africa" },
  turkey: { iso: "TR", region: "Middle East & Africa" },
};

function flagFromIso(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function isoDate(s: string | null | undefined): string {
  const d = parseDate(s);
  return d ? d.toISOString().slice(0, 10) : "";
}

// Quarter offset of a close date vs now: 0 = current quarter, clamped to the
// report's 8-quarter horizon. Missing/past dates clamp to the near edge.
export function quarterOffset(closeDate: Date | null, now: Date): number {
  if (!closeDate) return 7;
  const off =
    (closeDate.getUTCFullYear() - now.getUTCFullYear()) * 4 +
    (Math.floor(closeDate.getUTCMonth() / 3) - Math.floor(now.getUTCMonth() / 3));
  return Math.max(0, Math.min(7, off));
}

type RawDeal = {
  id: string;
  properties: Record<string, string | null>;
  associations?: { companies?: { results: { id: string }[] } };
};

// Company names/countries for customer + region columns. Missing scope or an
// API error must not break the report — return an empty map and fall back to
// deal-name prefixes.
async function fetchCompanies(ids: string[]): Promise<Map<string, { name: string | null; country: string | null }>> {
  const map = new Map<string, { name: string | null; country: string | null }>();
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  try {
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      const res = await fetch(`${HS_BASE}/crm/v3/objects/companies/batch/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ properties: ["name", "country"], inputs: batch.map((id) => ({ id })) }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`companies batch read failed (${res.status})`);
      const json = (await res.json()) as { results: { id: string; properties: Record<string, string | null> }[] };
      for (const r of json.results) map.set(r.id, { name: r.properties.name ?? null, country: r.properties.country ?? null });
    }
  } catch (e) {
    console.error("HubSpot company lookup unavailable (falling back to deal names):", (e as Error).message);
  }
  return map;
}

export async function fetchPipelineReportDeals(now = new Date()): Promise<PipelineReportDeal[]> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN is not set");
  const stageMap = getStageMap();
  const pipelineId = process.env.HUBSPOT_PIPELINE_ID ?? "default";
  const openStageIds = Object.keys(stageMap).filter(
    (k) => stageMap[k] !== "CLOSED_WON" && stageMap[k] !== "CLOSED_LOST"
  );

  const properties = [
    "dealname",
    "pipeline",
    "dealstage",
    "amount_in_home_currency",
    "createdate",
    "closedate",
    "description",
    "hs_priority",
    "hs_deal_stage_probability",
    "hs_v2_date_entered_current_stage",
  ].join(",");

  const raw: RawDeal[] = [];
  let after: string | undefined;
  for (let page = 0; page < 200; page++) {
    const url = new URL(`${HS_BASE}/crm/v3/objects/deals`);
    url.searchParams.set("limit", "100");
    url.searchParams.set("archived", "false");
    url.searchParams.set("properties", properties);
    url.searchParams.set("associations", "companies");
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HubSpot deals fetch failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { results: RawDeal[]; paging?: { next?: { after?: string } } };
    raw.push(...json.results);
    after = json.paging?.next?.after;
    if (!after) break;
  }

  const open = raw.filter(
    (r) => (r.properties.pipeline ?? "default") === pipelineId && openStageIds.includes(r.properties.dealstage ?? "")
  );

  const companyIds = [...new Set(open.map((r) => r.associations?.companies?.results?.[0]?.id).filter(Boolean))] as string[];
  const companies = companyIds.length
    ? await fetchCompanies(companyIds)
    : new Map<string, { name: string | null; country: string | null }>();

  const portalId = process.env.HUBSPOT_PORTAL_ID ?? DEFAULT_PORTAL_ID;
  const uiDomain = process.env.HUBSPOT_UI_DOMAIN ?? DEFAULT_UI_DOMAIN;

  return open.map((r) => {
    const p = r.properties;
    const companyId = r.associations?.companies?.results?.[0]?.id;
    const company = companyId ? companies.get(companyId) : undefined;
    const countryRaw = company?.country?.trim() ?? "";
    const info = COUNTRY_INFO[countryRaw.toLowerCase()];
    const amount = p.amount_in_home_currency != null ? Number(p.amount_in_home_currency) : 0;
    const value = isFinite(amount) ? Math.round(amount) : 0;
    const hsPriority = (p.hs_priority ?? "").toLowerCase();
    const priority: PipelineReportDeal["priority"] =
      hsPriority === "high" || hsPriority === "medium" || hsPriority === "low"
        ? (hsPriority as PipelineReportDeal["priority"])
        : value >= 1_000_000
          ? "high"
          : value >= 250_000
            ? "medium"
            : "low";
    const entered = isoDate(p.createdate) || now.toISOString().slice(0, 10);

    return {
      id: r.id,
      name: p.dealname ?? `Deal ${r.id}`,
      customer: company?.name ?? ((p.dealname ?? "").split(/[-–—]/)[0].trim() || "—"),
      region: info?.region ?? "Other",
      country: countryRaw || "—",
      flag: info ? flagFromIso(info.iso) : "🌐",
      value,
      stage: p.dealstage!,
      priority,
      enteredFunnel: entered,
      stageEntered: isoDate(p.hs_v2_date_entered_current_stage) || entered,
      closeQuarter: quarterOffset(parseDate(p.closedate), now),
      probability:
        p.hs_deal_stage_probability != null && isFinite(Number(p.hs_deal_stage_probability))
          ? Number(p.hs_deal_stage_probability)
          : null,
      product: "—",
      scope: "—",
      contact: { name: "—", title: "" },
      hubspotUrl: `https://${uiDomain}/contacts/${portalId}/record/0-3/${r.id}`,
      notes: p.description ?? "",
    };
  });
}

// Stage close-probabilities as configured on the HubSpot pipeline, as integer
// percents keyed by stage id. These drive the report's default weightings so
// its weighted pipeline matches HubSpot's to the pound.
export async function fetchPipelineStageProbabilities(pipelineId: string): Promise<Record<string, number> | null> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  try {
    const res = await fetch(`${HS_BASE}/crm/v3/pipelines/deals/${encodeURIComponent(pipelineId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`pipeline read failed (${res.status})`);
    const json = (await res.json()) as { stages: { id: string; metadata?: { probability?: string } }[] };
    const out: Record<string, number> = {};
    for (const s of json.stages) {
      const p = Number(s.metadata?.probability);
      if (isFinite(p)) out[s.id] = Math.round(p * 100);
    }
    return Object.keys(out).length ? out : null;
  } catch (e) {
    console.error("HubSpot pipeline config unavailable (deriving weights from deals):", (e as Error).message);
    return null;
  }
}

// Fallback when the pipelines endpoint is unavailable: the most common
// per-deal probability in each stage (per-deal overrides are the minority,
// so the mode recovers the stage default).
export function deriveStageWeights(deals: { stage: string; probability: number | null }[]): Record<string, number> {
  const byStage = new Map<string, Map<number, number>>();
  for (const d of deals) {
    if (d.probability == null) continue;
    const pct = Math.round(d.probability * 100);
    const counts = byStage.get(d.stage) ?? new Map<number, number>();
    counts.set(pct, (counts.get(pct) ?? 0) + 1);
    byStage.set(d.stage, counts);
  }
  const out: Record<string, number> = {};
  for (const [stage, counts] of byStage) {
    let best = -1;
    let bestN = 0;
    for (const [pct, n] of counts) {
      if (n > bestN || (n === bestN && pct > best)) {
        best = pct;
        bestN = n;
      }
    }
    if (best >= 0) out[stage] = best;
  }
  return out;
}

// Everything the pipeline report page needs in one call.
export async function fetchPipelineReport(now = new Date()): Promise<{
  deals: PipelineReportDeal[];
  stageWeights: Record<string, number>;
}> {
  const pipelineId = process.env.HUBSPOT_PIPELINE_ID ?? "default";
  const [deals, configured] = await Promise.all([
    fetchPipelineReportDeals(now),
    fetchPipelineStageProbabilities(pipelineId),
  ]);
  return { deals, stageWeights: configured ?? deriveStageWeights(deals) };
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
