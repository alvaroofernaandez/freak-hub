import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Emits a self-contained server bundle so the Docker runtime image only needs
  // Node and the files Next actually uses.
  output: "standalone",
  // The repo root, so Next traces files across the pnpm workspace correctly.
  outputFileTracingRoot: new URL("../..", import.meta.url).pathname,
  images: {
    remotePatterns: [
      // Clerk avatars.
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  experimental: {
    serverActions: {
      // Profile photos are accepted up to 5 MB by the API, and Server Actions
      // default to a 1 MB body. Without this, anything larger fails with
      // "Body exceeded 1 MB limit" before our own validation can answer.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
