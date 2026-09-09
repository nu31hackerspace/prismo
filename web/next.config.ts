import type { NextConfig } from "next";
const path = require("path");

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../"),
  experimental: {
    serverActions: {
      allowedOrigins: ["app.prismo.local.nu31.space", "localhost:3000"]
    }
  }
};

export default nextConfig;
