"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Thin wrapper around next-themes, mounted in the root layout.
 *
 * Since the Genaro migration the app is light-only — the brand defines one
 * light system and no dark variants — so the layout mounts this with
 * `forcedTheme="light"`. The provider is kept rather than deleted for one
 * concrete reason: users who chose dark before the migration still have
 * `theme=dark` in localStorage, and forcing the value is what stops that stale
 * preference from putting a `.dark` class back on <html>.
 *
 * If a dark palette is ever supplied, drop `forcedTheme` and add the token
 * block back to globals.css; nothing else here needs to change.
 */
export function ThemeProvider(
  props: ComponentProps<typeof NextThemesProvider>,
): React.ReactElement {
  return <NextThemesProvider {...props} />;
}
