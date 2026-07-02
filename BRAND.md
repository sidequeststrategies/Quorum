# AssetCool Brand Guide — Board Reporting Portal

Derived from [assetcool.com](https://www.assetcool.com) and existing AssetCool digital properties. AssetCool is a UK robotics company (Leeds, founded 2018) whose robots apply photonic coatings to overhead power lines, cooling conductors and unlocking up to 30% more grid capacity. The brand should read as: **engineered, trustworthy, quietly confident — infrastructure-grade, with a current of energy.**

## 1. Logo

- Primary mark: the AssetCool **droplet** (a nod to coating + cooling). In this app it is rendered as an inline SVG (`src/components/brand-logo.tsx`) with a navy→teal gradient.
- Wordmark: "AssetCool" set in Inter SemiBold, with the product descriptor ("Board Reporting") in regular weight, muted color.
- Clear space: keep at least the droplet's width around the mark. Don't recolor the droplet outside the brand palette.

## 2. Color

| Token | Hex | HSL | Usage |
|---|---|---|---|
| Navy (primary) | `#1A3569` | `220 60% 26%` | Primary buttons, headings, logomark base |
| Deep navy | `#0F1F3D` | `219 61% 15%` | Dark surfaces, footer, dark mode background |
| Teal | `#3FABBD` | `189 50% 49%` | Accents, focus rings, chart series 1 |
| Bright teal | `#4FC1D4` | `189 61% 57%` | Highlights, gradients, dark-mode primary |
| Mid blue | `#285FAF` | `216 63% 42%` | Secondary chart series, links on white |
| Ink | `#1F2937` | `215 28% 17%` | Body text |
| Surface | `#EEF3F9` | `213 48% 95%` | Panels, muted backgrounds |
| Rule | `#D5DDE8` | `215 29% 87%` | Borders, dividers |
| Amber (warn) | `#B45309` | — | "At risk" statuses |
| Green (ok) | `#0F766E` | — | "On track" / healthy statuses |

Chart palette order: teal → mid blue → navy → bright teal → amber. Red is reserved for genuinely negative states (off track, churned, cash-out).

## 3. Typography

- **Typeface:** Inter (Google Fonts), fallback `system-ui, -apple-system, "Segoe UI", sans-serif`.
- Headings: 600–800 weight, tight tracking. Hero headings may use navy with a teal highlight line.
- Body: 400–500, ink on white. Muted text uses the muted-foreground token, never pure grey on grey.
- Numbers in tables/KPIs: tabular where possible, no more precision than the board needs (round to $k/$M).

## 4. Shape & elevation

- Generous radii: cards ~12–18px (`--radius: 0.75rem` here).
- Soft, low shadows (`0 10px 30px rgba(15,31,61,.10)`); never hard drop shadows.
- Cards on white or Surface; avoid heavy fills — the palette carries the brand.

## 5. Motion

- Purposeful and brief: chart lines draw in (~1.4s ease-out), bars grow up (~0.7s spring). Nothing loops.
- Respect `prefers-reduced-motion` (already handled by the `.chart-*-animate` utilities).

## 6. Voice & tone

- Plain, direct, engineering-literate. "Runway: 19 months" beats "Our capital position remains robust."
- Board content leads with the number or the status, then the narrative.
- Statuses are honest: On track / At risk / Off track — never euphemisms.

## 7. White-label note

All branding is env-driven with AssetCool defaults (`src/lib/brand.ts`):
`NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_PRODUCT`, `NEXT_PUBLIC_BRAND_TAGLINE`.
To re-skin for another client: set those vars and swap the palette HSL values in `src/app/globals.css` (`:root` and `.dark`) — every component reads from the tokens.
