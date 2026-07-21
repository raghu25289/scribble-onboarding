import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The analyze route does outbound fetches + LLM calls; keep it on the Node runtime.
  experimental: {},
};

export default nextConfig;
