# Pipeline Report (`/pipelinereport`)

An interactive board/investor pipeline dashboard served **behind the portal
login** at `/pipelinereport`, showing the **live HubSpot deal pipeline**:
funnel by stage (value / count / priority / weighted), flower visuals for
deal age (fresh → aging → wilted), time-in-stage momentum vs benchmarks,
adjustable stage weightings with rationale, a quarterly projection with
downside→upside scenario bands, financial sliders (headcount / COGS / CAC),
and click-through stage & deal detail modals. All money in the portal home
currency (£ for AssetCool).

## How it works

- `src/app/pipelinereport/report.html` — self-contained template (Montserrat
  embedded as base64; no external requests; assetcool.com palette). Its
  `STAGES` array is AssetCool's actual HubSpot pipeline, keyed by HubSpot
  stage ids (`appointmentscheduled` … `5131910380`); "On Hold" and closed
  deals are excluded.
- `src/app/pipelinereport/route.ts` — auth-gated route handler: signed-in
  member **or** pipeline-report guest → fetch deals
  (`fetchPipelineReportDeals()` in `src/lib/hubspot.ts`, which pulls deals +
  associated companies for customer/country/region) → inject as
  `window.PIPELINE` at the `/*__PIPELINE_DATA__*/` marker (`<`-escaped) →
  serve with `no-store`.
- `next.config.mjs` ships the template via `outputFileTracingIncludes`.
- Company lookups degrade gracefully: without `crm.objects.companies.read`
  scope, customer names fall back to the deal-name prefix and regions to
  "Other". Contact/product/scope render as em-dashes (not in CRM yet).

## States

`window.PIPELINE.source`: `hubspot` (live), `demo` (fixture, yellow badge),
`unconfigured` / `error` (warning badge, empty report).

## Page chrome

- **Light mode** — header toggle; persisted per browser (`pr-theme`).
- **Print report** — header button → condensed two-page printout (KPIs +
  funnel on page 1; momentum, geography, projection on page 2; garden,
  scenario controls and notes are omitted; always prints light-on-white).
- **Opportunity Garden** — collapsible, default rolled up with a one-line
  summary (deal count, wilted/aging); state persisted per browser
  (`pr-garden`).

## Sharing with a guest (page-scoped access)

Set `PIPELINE_REPORT_GUEST_EMAILS="person@example.com"` (comma-separated) in
the deployment. Those emails can sign in with Google and see **only** this
page: every other portal route redirects them back here, and they cannot
create a workspace via onboarding. Remove the email and redeploy to revoke.
(Members of the org see the report as part of the portal, as before.)

## Local development without a token

Set `PIPELINE_REPORT_FIXTURE=scripts/fixtures/pipeline-report-fixture.json`
to render fixture deals with the DEMO badge. Ignored when
`HUBSPOT_ACCESS_TOKEN` is set.

## History

Originated as a static look-and-feel prototype with fabricated data on the
`claude/pipeline-report-prototype` branch (built 2026-07-06, never merged —
an offline copy lives at
`C:\Users\nydel\Claude\AssetCool\AssetCool-Pipeline-Report-OFFLINE.html`).
This live version replaced its fabricated demo block with server-injected
HubSpot data, moved it out of `public/` behind auth, retaxonomized STAGES to
the real pipeline, and switched display currency to £. The prototype branch
can be deleted once this is merged.

## Caveats

- Branding intentionally uses the punchier assetcool.com palette
  (Montserrat, #008BCA / #0F314D / #FDCD0B), not the portal palette in
  `BRAND.md`. Reconcile whenever one is declared canonical.
- Stage weightings/benchmarks in `STAGES` are editable assumptions (sliders
  at runtime, defaults in the template) — revisit once enough closed-deal
  history exists to calibrate them from actuals.
- Not linked from app navigation yet.
