import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Silencia o erro de Turbopack/Webpack (necessário com plugins legados) ──
  turbopack: {},

  // ── Segurança HTTP Headers para LGPD ─────────────────────────────────────
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key:   "Permissions-Policy",
            value: "camera=self, microphone=self, geolocation=self",
          },
        ],
      },
    ];
  },

  // ── Imagens externas (avatar Google + Firebase Storage) ───────────────────
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

export default nextConfig;


