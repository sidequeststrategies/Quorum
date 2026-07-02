/** @type {import('next').NextConfig} */

// Serve the whole app under a path prefix (e.g. /boardreporting) so it can be
// proxied from assetcool.sidequeststrategies.com/boardreporting. Leave unset
// for root-path deployments (quorum.sidequeststrategies.com, local dev).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  ...(basePath ? { basePath } : {}),
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  // Database drivers stay external: postgres-js uses dynamic requires and
  // PGlite ships wasm assets — neither survives bundling.
  serverExternalPackages: ["postgres", "@electric-sql/pglite"],
};

export default nextConfig;
