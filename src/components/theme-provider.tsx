"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Thin wrapper around next-themes. Mounted in the root layout with
 * `attribute="class"` so it toggles the `.dark` class on <html> — which is what
 * both the Nord dark token block (globals.css) and the Tailwind `dark:` variant
 * key off. Previously next-themes was a dependency but no provider was mounted,
 * so dark mode never actually engaged.
 */
export function ThemeProvider(
  props: ComponentProps<typeof NextThemesProvider>,
): React.ReactElement {
  return <NextThemesProvider {...props} />;
}
