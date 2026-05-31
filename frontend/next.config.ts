import type { NextConfig } from "next";
import { resolvePublicApiOrigin } from "./src/lib/api-origin";

const nextConfig: NextConfig = {
  /** Dev: proxy to local FastAPI. Vercel: proxy to Render (127.0.0.1 is blocked in production). */
  async rewrites() {
    const target = resolvePublicApiOrigin();
    return [
      {
        source: "/nrgs-api/:path*",
        destination: `${target}/:path*`,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      { protocol: "http", hostname: "127.0.0.1", port: "8000", pathname: "/uploads/**" },
      { protocol: "http", hostname: "localhost", port: "8000", pathname: "/uploads/**" },
      { protocol: "https", hostname: "localhost", port: "8000", pathname: "/uploads/**" },
      { protocol: "https", hostname: "tatsat.onrender.com", pathname: "/uploads/**" },
    ],
  },
};

export default nextConfig;
