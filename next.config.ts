import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: {
    // Strict mode is the point. Never let a broken build through.
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ["@prisma/client", "mathjs"],
  // The prompt files and the demo fixture are read from disk at runtime, so
  // they have to be traced into the serverless bundle or they vanish on
  // Vercel while working perfectly in local dev.
  outputFileTracingIncludes: {
    "/**": ["./prompts/**", "./seed/**"],
  },
};

export default nextConfig;
