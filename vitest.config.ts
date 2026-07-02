import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Two projects:
 *  - unit:      node env, pure logic + services (src/lib/**, src/app/api/**)
 *  - component: jsdom env, React components (src/components/**)
 *
 * The legacy node:test file (src/lib/autotrader/*.test.mts) is excluded —
 * it runs under `pnpm test:node` until ported.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Server-only guard is a no-op outside Next's bundler.
      "server-only": path.resolve(__dirname, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/lib/**/*.test.ts", "src/app/api/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          include: ["src/components/**/*.test.tsx"],
          setupFiles: ["src/test/setup-component.ts"],
        },
      },
    ],
  },
});
