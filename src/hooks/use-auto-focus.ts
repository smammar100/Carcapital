"use client";

import * as React from "react";

/**
 * Focus a field on mount — but never on a touch device.
 *
 * The plain `autoFocus` attribute can't express this. React serialises it into
 * the SSR HTML, so the BROWSER focuses the field before hydration even runs;
 * by the time any JavaScript could check the pointer type, the on-screen
 * keyboard has already shoved half the viewport out of the way. Gating the
 * attribute on a render-time `window` check doesn't work either — the server
 * has no `window`, so it renders `autofocus` and the client doesn't, which is a
 * hydration mismatch.
 *
 * Doing it from an effect sidesteps both: nothing is serialised, and the check
 * runs on the client where `matchMedia` actually exists.
 *
 * `(pointer: coarse)` is the same signal the `pointer-coarse:` Tailwind variant
 * uses elsewhere in the app (badge, select), and it beats `'ontouchstart' in
 * window` — that reports true on touch-capable laptops, where a keyboard IS
 * present and autofocus is genuinely wanted.
 *
 * Usage:
 *   const ref = useAutoFocus<HTMLInputElement>();
 *   <Input ref={ref} />
 */
export function useAutoFocus<T extends HTMLElement>(
  enabled = true,
): React.RefObject<T | null> {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    if (!enabled) return;
    if (prefersNoAutoFocus()) return;
    ref.current?.focus();
  }, [enabled]);

  return ref;
}

/**
 * Same rule, for a react-hook-form field.
 *
 * RHF fields already carry their own `ref` via `{...field}`, and overwriting it
 * breaks the library's own error-focus behaviour — so these go through
 * `setFocus(name)` instead of a second ref.
 *
 * Usage:
 *   const form = useForm(...);
 *   useAutoFocusField(form.setFocus, "email");
 */
export function useAutoFocusField<TName extends string>(
  setFocus: (name: TName) => void,
  name: TName,
  enabled = true,
): void {
  React.useEffect(() => {
    if (!enabled) return;
    if (prefersNoAutoFocus()) return;
    setFocus(name);
  }, [setFocus, name, enabled]);
}

function prefersNoAutoFocus(): boolean {
  return window.matchMedia?.("(pointer: coarse)").matches === true;
}
