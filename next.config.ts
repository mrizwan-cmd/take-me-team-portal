import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite", "postgres", "@aws-sdk/client-s3"],
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Content-Security-Policy", value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }];
  },
};

export default nextConfig;
