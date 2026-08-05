import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['mqtt-contract'],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
