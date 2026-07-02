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
  // node:sqlite is a Node built-in. Next 15's bundler doesn't externalize
  // node: prefixed built-ins on its own; without this the server bundle
  // tries to bundle the module and fails at runtime with
  // "no such built-in module: node:sqlite".
  serverExternalPackages: ["node:sqlite"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({ "node:sqlite": "commonjs node:sqlite" });
    }
    return config;
  },
};

export default nextConfig;
