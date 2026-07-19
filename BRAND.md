# Quorum Brand Guide — Board Reporting

Quorum is the board-reporting product of **Side Quest Strategies** (sidequeststrategies.com). It inherits the SQS visual DNA — deep navy, electric blue, cyan accent, mist surfaces — with its own product mark. The brand should read as: **calm, exact, board-grade — a product a director trusts with the numbers.**

## 1. Logo

- Primary mark: the Quorum **seats** — seven navy dots arranged in a circle (the board around the table) plus one cyan seat whose tail completes a "Q". The cyan seat is the one that makes the quorum.
- Rendered as inline SVG in `src/components/brand-logo.tsx`; favicon variant (navy tile, white seats) in `public/favicon.svg`.
- Wordmark: "Quorum" set in Space Grotesk SemiBold, with the product descriptor ("Board Reporting") in regular weight, muted color.
- Clear space: keep at least one seat-diameter around the mark. Don't recolor the seats outside the brand palette.

## 2. Color

| Token | HSL | Usage |
|---|---|---|
| Navy (primary) | `215 70% 22%` | Primary buttons, headings, logomark seats |
| Deep navy | `215 70% 14%` | Dark surfaces, favicon tile, dark-mode base |
| Cyan (accent) | `190 85% 38%` | Accents, focus rings, the quorum seat, chart series 1 |
| Bright cyan | `190 85% 50%` | Highlights, gradients, dark-mode primary |
| Blue | `210 80% 50%` | Secondary chart series, links on white |
| Ink | `215 50% 12%` | Body text |
| Mist | `210 25% 96%` | Panels, muted backgrounds |
| Rule | `210 30% 88%` | Borders, dividers |
| Amber (warn) | `#B45309` | "At risk" statuses |
| Green (ok) | `#0F766E` | "On track" / healthy statuses |

Chart palette order: cyan → blue → navy → bright cyan → amber. Red is reserved for genuinely negative states (off track, churned, cash-out).

CSS variable names are unchanged from the original theme (`--brand-teal` is the cyan accent) so components and charts restyle from tokens alone.

## 3. Typography

- **Display:** Space Grotesk (Google Fonts) — wordmark, hero headings. Tailwind class `font-display`.
- **Body:** Inter, fallback `system-ui, -apple-system, "Segoe UI", sans-serif`.
- Headings: 600–700 weight, tight tracking.
- Numbers in tables/KPIs: tabular where possible, no more precision than the board needs (round to $k/$M).

## 4. Shape & elevation

- Generous radii: cards ~12–18px (`--radius: 0.75rem`).
- Soft, low shadows; never hard drop shadows.
- Cards on white or Mist; avoid heavy fills — the palette carries the brand.

## 5. Motion

- Purposeful and brief: chart lines draw in (~1.4s ease-out), bars grow up (~0.7s spring). Nothing loops.
- Respect `prefers-reduced-motion` (handled by the `.chart-*-animate` utilities).

## 6. Voice & tone

- Plain, direct. "Runway: 19 months" beats "Our capital position remains robust."
- Board content leads with the number or the status, then the narrative.
- Statuses are plain: On track / At risk / Off track — never euphemisms.

## 7. White-label / multi-company note

Quorum is the default brand; client deployments can re-skin without code changes. All branding is env-driven (`src/lib/brand.ts`):
`NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_PRODUCT`, `NEXT_PUBLIC_BRAND_TAGLINE`, `NEXT_PUBLIC_BRAND_COMPANY`, plus `NEXT_PUBLIC_BRAND_CURRENCY` for money formatting (`src/lib/finance.ts`).
To re-skin for a client: set those vars and swap the palette HSL values in `src/app/globals.css` (`:root` and `.dark`) — every component reads from the tokens.
