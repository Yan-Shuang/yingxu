import type { NextConfig } from "next";
import path from "node:path";
const backendApiUrl = (
  process.env.BACKEND_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  turbopack: { root: path.resolve(__dirname, "..") },
  async rewrites() {
    return [
      { source: "/code/:path*", destination: `${backendApiUrl}/code/:path*` },
    ];
  },
};
export default nextConfig;
