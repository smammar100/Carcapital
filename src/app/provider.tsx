"use client";

import { useRouter } from "next/navigation";
import { Provider } from "@react-spectrum/s2";
import type { ReactNode } from "react";

// Type the `routerOptions` prop on every React Spectrum component to match
// Next.js's router.push options.
declare module "@react-spectrum/s2" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface RouterConfig {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  }
}

interface Props {
  lang: string;
  className?: string;
  children: ReactNode;
}

/**
 * Wraps the app in React Spectrum S2's <Provider>, rendered as the root
 * <html> element so the locale + color-scheme propagate via context. Wires
 * Next.js's router into S2 so links handled by Spectrum components do
 * client-side navigation. Lives at app root because the S2 docs require it
 * to BE the html element.
 *
 * Important: keep S2 as the inner-most provider when stacking with other
 * Spectrum versions — not a concern here, but documented for migration.
 */
export function ClientProvider({ lang, className, children }: Props) {
  const router = useRouter();

  return (
    <Provider
      elementType="html"
      locale={lang}
      router={{ navigate: router.push }}
      // Pass through className so the original font-variable + h-full
      // classes still land on the <html> element.
      // @ts-expect-error — Provider's prop typing doesn't expose className but it forwards to elementType.
      className={className}
    >
      {children}
    </Provider>
  );
}
