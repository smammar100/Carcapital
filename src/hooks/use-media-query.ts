"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query from React.
 *
 * Needed where a responsive decision cannot be expressed in CSS alone. The
 * vehicle grid is the motivating case: hiding a `<td>` with `display: none`
 * does not collapse its column, because the matching `<col>` in the colgroup
 * still reserves its width — the table stays 1740px wide with blank space
 * where the hidden columns were. Dropping those columns from the array before
 * render is the only thing that actually narrows the table.
 *
 * Built on `useSyncExternalStore` rather than useState + useEffect. A media
 * query list is exactly the external store that hook exists for, and reading
 * it during render avoids the cascading re-render that setting state inside
 * an effect causes.
 *
 * The server snapshot is `false`, so SSR and the first paint assume the wide
 * layout — degrading to the desktop rendering rather than a broken narrow one.
 */
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True below Tailwind's `lg` breakpoint (1024px). */
export function useIsNarrow(): boolean {
  return useMediaQuery("(max-width: 1023px)");
}
