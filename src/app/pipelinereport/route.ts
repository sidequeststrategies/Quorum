// Auth-gated interactive pipeline report. Serves the self-contained
// report.html with the live HubSpot deal list injected server-side in place
// of the /*__PIPELINE_DATA__*/ marker — the browser never talks to HubSpot
// and the HTML never sits in public/ (see PIPELINE_REPORT.md for history).

import fs from "node:fs";
import path from "node:path";
import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/session";
import { pipelineReportGuest } from "@/lib/access";
import { fetchPipelineReportDeals, hubspotConfigured, type PipelineReportDeal } from "@/lib/hubspot";

export const dynamic = "force-dynamic";

const MARKER = "/*__PIPELINE_DATA__*/{ source:'unconfigured', deals:[] }";

export async function GET() {
  // Members see the report as part of the portal. PIPELINE_REPORT_GUEST_EMAILS
  // may additionally view this one page after Google sign-in — nothing else.
  const { user, membership } = await getCurrentMembership(); // redirects signed-out visitors to /login
  if (!membership && !pipelineReportGuest(user.email)) redirect("/onboarding");

  let payload: { source: string; deals: PipelineReportDeal[] };
  if (!hubspotConfigured()) {
    // Look-and-feel work without a token: point PIPELINE_REPORT_FIXTURE at a
    // JSON deal array (e.g. scripts/fixtures/pipeline-report-fixture.json).
    // Renders with the DEMO badge; ignored whenever a real token is set.
    const fixture = process.env.PIPELINE_REPORT_FIXTURE;
    payload = fixture
      ? { source: "demo", deals: JSON.parse(fs.readFileSync(path.join(process.cwd(), fixture), "utf8")) }
      : { source: "unconfigured", deals: [] };
  } else {
    try {
      payload = { source: "hubspot", deals: await fetchPipelineReportDeals() };
    } catch (e) {
      console.error("pipeline report: HubSpot fetch failed:", (e as Error).message);
      payload = { source: "error", deals: [] };
    }
  }

  const template = fs.readFileSync(path.join(process.cwd(), "src", "app", "pipelinereport", "report.html"), "utf8");
  if (!template.includes(MARKER)) throw new Error("report.html injection marker missing");
  // <-escape so no deal field (names, notes) can close the script tag.
  const html = template.replace(MARKER, JSON.stringify(payload).replace(/</g, "\\u003c"));

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
