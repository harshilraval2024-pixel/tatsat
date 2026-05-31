import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Same-origin proxy so the browser never hits cross-origin CORS to FastAPI in dev. */
  async rewrites() {
    return [
      {
        source: "/nrgs-api/:path*",
        destination: "http://127.0.0.1:8000/:path*",
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
