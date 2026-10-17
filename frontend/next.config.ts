import type { NextConfig } from "next";

// The browser only ever talks to this app's own origin; /api/v1/* is proxied
// to the backend. Calling the backend's origin directly made its auth cookies
// third-party, and Safari/iOS (every iOS browser is WebKit) drops those — login
// "worked" for a second, then the first /auth/me came back 401.
// NEXT_PUBLIC_API_URL is the old name, kept so existing deploys don't break.
const backendApiUrl = (
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000/api/v1"
).replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendApiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
