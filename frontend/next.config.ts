import type { NextConfig } from "next";
import path from "path";
// @ts-ignore
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.BACKEND_API_URL || 'https://chainbudget-api.fly.dev/api/:path*', // Proxy to Backend
      },
    ];
  },
};

export default withPWA(nextConfig);
