import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
