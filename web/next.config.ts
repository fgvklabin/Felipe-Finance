import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // PGlite (Postgres embutido para desenvolvimento) e pg rodam apenas no servidor Node.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Snapshots de mercado (web/data) e migrações (web/db) são lidos em runtime pelo servidor.
  outputFileTracingIncludes: { "/**": ["./data/**/*", "./db/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
