import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Turbopack rooted at this app instead of the unrelated parent lockfile.
  turbopack: {
    root: __dirname,
  },
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      // GPS is required by the visitor navigation feature; camera and
      // microphone are not used by GraveNav.
      { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
    ];

    // Do not send HSTS during localhost development or an HTTP preview. Only
    // enable it when the configured deployment origin explicitly uses HTTPS.
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_APP_ORIGIN?.startsWith("https://")) {
      headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
    }

    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
