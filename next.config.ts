import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent capturing binary deps in the bundle
  serverExternalPackages: ['canvas', 'face-api.js'],
};

export default nextConfig;
