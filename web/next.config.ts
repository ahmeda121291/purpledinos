import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/card/[type]": ["./assets/fonts/**"] },
};

export default nextConfig;
