import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Layer-1 route guard lives in src/proxy.ts (renamed middleware). See spec FR-009 / research R6.
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
