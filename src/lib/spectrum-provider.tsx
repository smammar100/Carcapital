"use client";

import { Provider } from "@react-spectrum/s2";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Adobe Spectrum 2 Provider wrapper for Next.js App Router.
 *
 * - Provides `colorScheme="auto"` so the theme follows the user's OS preference
 * - Sets `locale="en-GB"` so dates render `DD/MM/YYYY` and currency uses £
 * - Adapts Next.js routing so Spectrum's `<Link>` components do client-side navigation
 *
 * Usage: wrap the dashboard layout (NOT root layout — root must stay a server
 * component for metadata/font preload). The Provider is intentionally inside
 * the dashboard tree so the auth route can opt out if needed.
 *
 * v4.5 §25 — first commit of the Spectrum 2 migration. Subsequent commits will
 * progressively replace shadcn primitives with Spectrum components.
 */
export function SpectrumProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <Provider
      colorScheme="auto"
      locale="en-GB"
      router={{ navigate: (href, opts) => router.push(href, opts) }}
    >
      {children}
    </Provider>
  );
}
