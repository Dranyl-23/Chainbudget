import type { NextConfig } from "next";
import path from "path";
// @ts-expect-error next-pwa lacks official TypeScript type definitions
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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://chainbudget-api.fly.dev wss://chainbudget-api.fly.dev https://api.asgardeo.io https://gateway.pinata.cloud https://*.pinata.cloud https://ipfs.io https://polygon-amoy.drpc.org https://*.drpc.org https://rpc-amoy.polygon.technology https://*.polygon.technology https://rpc.ankr.com https://api.amoy.polygonscan.com https://amoy.polygonscan.com https://*.walletconnect.com wss://*.walletconnect.org wss://*.walletconnect.com http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*",
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
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
