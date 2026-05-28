import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@phosphor-icons/react",
      "@hugeicons/react",
      "date-fns",
    ],
  },
  async headers() {
    return [
      {
        source: "/generated/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // /warranties is a landing route only — the module is split into
      // In-House / External / Claims tabs. Redirect at the Next.js routing
      // layer (works regardless of whether middleware runs; Turbopack's dev
      // server sometimes skips middleware/proxy until the .next cache warms).
      {
        source: "/warranties",
        destination: "/warranties/in-house",
        permanent: false,
      },
      // Module E.1 — the legacy Inventory > Listings route was removed
      // (duplicated Worklist). Redirect any stale bookmarks to All
      // Vehicles (the current Inventory equivalent in this codebase).
      {
        source: "/admin/inventory/listings",
        destination: "/vehicles",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
