// Deployment branding. Defaults are the AssetCool board-reporting portal;
// override via env for the generic / white-label version:
//   NEXT_PUBLIC_BRAND_NAME="Acme"  NEXT_PUBLIC_BRAND_PRODUCT="Board Reporting"
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "AssetCool",
  product: process.env.NEXT_PUBLIC_BRAND_PRODUCT ?? "Board Reporting",
  tagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE ??
    "One place for monthly reporting, board packs, and decisions.",
  get full() {
    return `${this.name} ${this.product}`;
  },
};
