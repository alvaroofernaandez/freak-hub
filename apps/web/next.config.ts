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
};

export default nextConfig;
