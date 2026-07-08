# Pipeline Report prototype (`/pipelinereport`)

`public/pipelinereport/index.html` is a **self-contained static prototype** of an
investor/board pipeline dashboard, built 2026-07-06 for look-and-feel review
before wiring real HubSpot data. It is served at `/pipelinereport` via a rewrite
in `next.config.mjs`.

What it shows: funnel by stage (value / count / priority / weighted), flower
visuals for deal age (fresh → wilting → wilted), time-in-stage momentum vs
benchmarks, adjustable stage weightings with rationale, a quarterly projection
with downside→upside scenario bands, sliders for headcount / COGS / CAC, and
click-through stage and deal detail modals. Fonts (Montserrat) are embedded as
base64, so the file also works offline — a shareable copy lives outside the
repo at `C:\Users\nydel\Claude\AssetCool\AssetCool-Pipeline-Report-OFFLINE.html`.

## Data — entirely fabricated

Every deal is fake (~$100M funnel, 16 deals, NA/EU/SA). The demo block is
fenced inside the inline script between `>>> DEMO DATA — START <<<` and
`>>> DEMO DATA — END <<<`. To feed real data, delete that block and assign
`window.PIPELINE = { source: 'hubspot', deals: [...] }` — any source other
than `'demo'` hides the yellow DEMO badge. Field shape is documented in the
comment at the top of the demo block.

## Status / caveats

- **Not auth-gated.** It lives in `public/`, so `requireMembership()` does not
  apply. That is acceptable only while the data is fabricated. If real pipeline
  data ever goes in, move it behind the `(app)` route group (or retire it in
  favor of the live HubSpot funnel on `/financials`).
- **Unlinked.** Nothing in the app navigation points to it.
- **Branding.** Uses the literal assetcool.com palette (Montserrat, #008BCA
  blue, #0F314D navy, #FDCD0B yellow) — intentionally punchier than the portal
  palette in `BRAND.md` (Inter, #1A3569 navy, teal). Reconcile whenever one of
  the two is declared canonical.
- The live HubSpot funnel integration (PR #11) is the production path for real
  pipeline reporting; this prototype is the interactive/scenario mock the live
  pages can borrow from (weighting sliders, scenario bands, age visuals).
