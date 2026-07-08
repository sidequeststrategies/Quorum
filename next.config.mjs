/** @type {import('next').NextConfig} */

// Serve the whole app under a path prefix (e.g. /boardreporting) so it can be
// proxied from assetcool.sidequeststrategies.com/boardreporting. Leave unset
// for root-path deployments (quorum.sidequeststrategies.com, local dev).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Content-Security-Policy. Sources the app actually uses: Google Fonts CSS +
// files, Supabase Auth from the browser, Google avatar images, and legacy
// Vercel Blob images. script-src still needs 'unsafe-inline' (Next bootstrap
// scripts; tightening to nonces is a future step) and 'unsafe-eval' in dev
// (webpack HMR). frame-ancestors 'none' is the load-bearing directive: the
// board portal must never render inside someone else's frame.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : "*.supabase.co";
  } catch {
    return "*.supabase.co";
  }
})();
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.public.blob.vercel-storage.com",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  // Database drivers stay external: postgres-js uses dynamic requires and
  // PGlite ships wasm assets — neither survives bundling.
  serverExternalPackages: ["postgres", "@electric-sql/pglite"],
  // The pipeline report is a static HTML template read at request time; make
  // sure Vercel's output tracing ships it with the route's function.
  outputFileTracingIncludes: {
    "/pipelinereport": ["./src/app/pipelinereport/report.html"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
