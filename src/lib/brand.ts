// Deployment branding. Defaults are Quorum, the Side Quest Strategies board
// reporting product; override via env for a client-branded deployment:
//   NEXT_PUBLIC_BRAND_NAME="Acme"  NEXT_PUBLIC_BRAND_PRODUCT="Board Reporting"
export const brand = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Quorum",
  product: process.env.NEXT_PUBLIC_BRAND_PRODUCT ?? "Board Reporting",
  tagline:
    process.env.NEXT_PUBLIC_BRAND_TAGLINE ??
    "One place for monthly reporting, board packs, and decisions.",
  company: process.env.NEXT_PUBLIC_BRAND_COMPANY ?? "Side Quest Strategies",
  get full() {
    return `${this.name} ${this.product}`;
  },
};
