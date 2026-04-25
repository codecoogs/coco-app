import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /** Profile photo uploads (see lib/avatar/constants.ts). */
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
