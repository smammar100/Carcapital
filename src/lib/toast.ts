/**
 * Thin wrapper around `sonner` so every CRUD action across the app fires a
 * consistently-styled toast. `error` accepts a `retry` callback that surfaces
 * an action button in the toast itself — used for network failures so users
 * can recover without rebuilding form state.
 *
 * Why not call `toast` directly? Consistency — duration, action shape, and
 * the success-vs-info distinction were drifting across pages. One place to
 * change them.
 */
import { toast } from "sonner";

interface ErrorOptions {
  retry?: () => void;
  duration?: number;
}

interface InfoOptions {
  duration?: number;
}

export const notify = {
  success: (message: string, opts: InfoOptions = {}) =>
    toast.success(message, { duration: opts.duration ?? 4000 }),

  error: (message: string, opts: ErrorOptions = {}) =>
    toast.error(message, {
      duration: opts.duration ?? 6000,
      action: opts.retry
        ? { label: "Retry", onClick: opts.retry }
        : undefined,
    }),

  info: (message: string, opts: InfoOptions = {}) =>
    toast.info(message, { duration: opts.duration ?? 4000 }),

  warning: (message: string, opts: InfoOptions = {}) =>
    toast.warning(message, { duration: opts.duration ?? 5000 }),
};
