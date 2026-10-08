import type { NextConfig } from "next";
import development from "../config/development.json";
import path from "node:path";

const developmentBackend = `http://${development.backend.host}:${development.backend.port}`;

function backendDestination(): string {
  try {
    const url = new URL(process.env.BACKEND_API_URL ?? developmentBackend);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/"
    ) {
      throw new Error();
    }
    return url.origin;
  } catch {
    throw new Error("BACKEND_API_URL must be an HTTP(S) origin without credentials, path, or query.");
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.dirname(process.cwd()),
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
      ],
    }];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendDestination()}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
