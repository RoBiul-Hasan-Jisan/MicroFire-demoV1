import type { NextConfig } from "next";

// Content-Security-Policy is set per request with a nonce in proxy.ts.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { "/api/strict": ["./strict/**/*"], "/fire-response": ["./strict/**/*"] },
  async redirects() {
    return [{ source: "/learn", destination: "/", permanent: false }]; // removed page: keep old links working
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
