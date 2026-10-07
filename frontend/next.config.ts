import type { NextConfig } from "next";
import development from "../config/development.json";

const developmentBackend = `http://${development.backend.host}:${development.backend.port}`;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_API_URL ?? developmentBackend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
