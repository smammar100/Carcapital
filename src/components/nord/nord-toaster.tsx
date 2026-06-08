"use client";

import { useEffect, useRef } from "react";
import type { ToastGroup } from "@nordhealth/components";

// Nord toasts only ship two variants. Status nuance (success/info/warning) is
// carried by the message text + an optional leading icon; `danger` is reserved
// for errors. See src/lib/toast.ts for the mapping from our notify.* API.
export type NordToastVariant = "default" | "danger";

export interface NordToastInput {
  message: string;
  variant?: NordToastVariant;
  autoDismiss?: number;
}

// Module singleton wired up once the <nord-toast-group> mounts. Toasts fired
// before mount (rare) are buffered and flushed on mount.
let pushToast: ((t: NordToastInput) => void) | null = null;
const pending: NordToastInput[] = [];

/** Imperatively show a toast from anywhere (used by src/lib/toast.ts). */
export function addToast(input: NordToastInput): void {
  if (pushToast) pushToast(input);
  else pending.push(input);
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
      if (!group) return;
      const fire = () =>
        group.addToast(t.message, {
          variant: t.variant ?? "default",
          autoDismiss: t.autoDismiss,
        });
      // The element may not be upgraded yet (registration is lazy) — wait if so.
      if (typeof group.addToast === "function") fire();
      else void customElements.whenDefined("nord-toast-group").then(fire);
    };
    if (pending.length) pending.splice(0).forEach((t) => pushToast?.(t));
    return () => {
      pushToast = null;
    };
  }, []);

  return <nord-toast-group ref={ref} />;
}
