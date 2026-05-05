import type { NextConfig } from "next";
// React Spectrum S2 setup — see https://react-spectrum.adobe.com/s2/getting-started.html
// `unplugin-parcel-macros` lets style macros run at build time. Webpack only
// (Turbopack is unsupported) — start dev with `next dev --webpack`.
import macros from "unplugin-parcel-macros";

// Single shared instance across server + client builds, per S2 docs.
const macroPlugin = macros.webpack();

const nextConfig: NextConfig = {
  webpack(config) {
    config.plugins.push(macroPlugin);

    // Bundle all S2 + macro CSS into a single chunk. Atomic CSS overlaps
    // heavily across components, so loading it all up front beats per-page
    // duplication.
    config.optimization ??= {};
    config.optimization.splitChunks ||= {};
    type SplitChunks = NonNullable<typeof config.optimization.splitChunks>;
    const splitChunks = config.optimization.splitChunks as SplitChunks & {
      cacheGroups?: Record<string, unknown>;
    };
    splitChunks.cacheGroups ??= {};
    splitChunks.cacheGroups.s2 = {
      name: "s2-styles",
      test(module: { type?: string; identifier(): string }) {
        return (
          (module.type === "css/mini-extract" &&
            module.identifier().includes("@react-spectrum/s2")) ||
          /macro-(.*?)\.css/.test(module.identifier())
        );
      },
      chunks: "all",
      enforce: true,
    };

    return config;
  },
};

export default nextConfig;
