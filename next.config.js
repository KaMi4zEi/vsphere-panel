// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["nodemailer", "@prisma/adapter-pg", "pg", "pg-connection-string", "pgpass"],
  poweredByHeader: false,
  async redirects() {
    return [{ source: "/favicon.ico", destination: "/api/favicon", permanent: false }];
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};

module.exports = nextConfig;
