"use client";

import { useEffect, useRef } from "react";
import type { ToastGroup } from "@nordhealth/components";

// Nord toasts only ship two variants. Status nuance (success/info/warning) is
// carried by the message text + an optional leading icon; `danger` is reserved
// for errors. See src/lib/toast.ts for the mapping from our notify.* API.
export type NordToastVariant = "default" | "danger";

/**
 * Nord's own `autoDismiss` timer does not fire in this app — toasts stay up
 * indefinitely and stack (GEN-123), most likely because the same
 * `:host { all: unset }` reset that strips the group's positioning also breaks
 * the transition the component waits on before removing itself. Rather than
 * depend on that, the bridge below runs the timer and calls `dismiss()`.
 */
export interface NordToastInput {
  message: string;
  variant?: NordToastVariant;
  autoDismiss?: number;
}

// Module singleton wired up once the <nord-toast-group> mounts. Toasts fired
// before mount (rare) are buffered and flushed on mount.
type NordToast = { dismiss: () => Promise<void> } & Partial<Element>;
let pushToast: ((t: NordToastInput) => NordToast | undefined) | null = null;
const pending: { input: NordToastInput; id: string }[] = [];
// Live toast handles so `toast.dismiss(id)` can programmatically close one.
const handles = new Map<string, NordToast>();
let seq = 0;

/**
 * Close a toast without waiting on Nord.
 *
 * `dismiss()` returns a promise that never settles here — it waits on an exit
 * transition that the `:host { all: unset }` reset strips out, so the toast is
 * never removed and they pile up over the page (GEN-123). Kick off dismiss for
 * the animation if it happens to work, then take the node out ourselves.
 */
function close(handle: NordToast): void {
  try {
    void handle.dismiss()?.catch?.(() => {});
  } catch {
    // Nord threw synchronously — the removal below is what matters.
  }
  setTimeout(() => (handle as unknown as Element).remove?.(), 400);
}

function track(
  id: string,
  handle: NordToast | undefined,
  autoDismiss?: number,
): void {
  if (!handle) return;
  handles.set(id, handle);

  const timer =
    autoDismiss && autoDismiss > 0
      ? setTimeout(() => {
          handles.delete(id);
          close(handle);
        }, autoDismiss)
      : null;

  // Drop the handle once Nord finishes dismissing it (user action or timer).
  (handle as unknown as EventTarget).addEventListener?.(
    "dismiss",
    () => {
      if (timer) clearTimeout(timer);
      handles.delete(id);
    },
    { once: true },
  );
}

/**
 * Imperatively show a toast from anywhere (used by src/lib/toast.ts). Returns
 * an id that can be passed to `removeToast` to dismiss it early.
 */
export function addToast(input: NordToastInput): string {
  const id = `t${++seq}`;
  if (pushToast) track(id, pushToast(input), input.autoDismiss);
  else pending.push({ input, id });
  return id;
}

/** Programmatically dismiss a toast created via addToast. */
export function removeToast(id: string): void {
  const handle = handles.get(id);
  if (handle) {
    close(handle);
    handles.delete(id);
  }
}

/**
 * Owns the single <nord-toast-group> and exposes an imperative `addToast`
 * bridge. Mounted once near the end of <body>. Replaces the sonner <Toaster/>.
 */
export function NordToaster(): React.ReactElement {
  const ref = useRef<ToastGroup>(null);

  useEffect(() => {
    pushToast = (t) => {
      const group = ref.current;
      if (!group) return undefined;
      const fire = (): NordToast =>
        group.addToast(t.message, {
          variant: t.variant ?? "default",
          autoDismiss: t.autoDismiss,
        }) as unknown as NordToast;
      // The element may not be upgraded yet (registration is lazy) — wait if
      // so. In that (rare) deferred case there is no synchronous handle to
      // return, so early dismissal isn't supported for those.
      if (typeof group.addToast === "function") return fire();
      void customElements.whenDefined("nord-toast-group").then(fire);
      return undefined;
    };
    if (pending.length)
      pending
        .splice(0)
        .forEach(({ input, id }) =>
          track(id, pushToast?.(input), input.autoDismiss),
        );
    return () => {
      pushToast = null;
    };
  }, []);

  return <nord-toast-group ref={ref} />;
}
