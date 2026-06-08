/**
 * App-wide toast helper. Backed by the Nord <nord-toast-group> via the
 * imperative bridge in `@/components/nord/nord-toaster`.
 *
 * The `notify.*` API (and durations) is kept identical to the previous sonner
 * implementation so existing call sites don't change. A `toast` object is also
 * exported as a drop-in for the files that imported `toast` directly from
 * `sonner` — swap `from "sonner"` to `from "@/lib/toast"` per section.
 *
 * Nord toasts ship only two variants (`default`, `danger`), and Nord guidance
 * is to keep toasts non-interactive. So success/info/warning all render as the
 * default variant (nuance carried by the message), errors render as `danger`,
 * and the legacy `retry` action is accepted but not rendered as a toast button.
 */
import { addToast } from "@/components/nord/nord-toaster";

interface ErrorOptions {
  retry?: () => void;
  duration?: number;
}

interface InfoOptions {
  duration?: number;
}

export const notify = {
  success: (message: string, opts: InfoOptions = {}) =>
    addToast({
      message,
      variant: "default",
      autoDismiss: opts.duration ?? 4000,
    }),

  error: (message: string, opts: ErrorOptions = {}) =>
    addToast({
      message,
      variant: "danger",
      autoDismiss: opts.duration ?? 6000,
    }),

  info: (message: string, opts: InfoOptions = {}) =>
    addToast({
      message,
      variant: "default",
      autoDismiss: opts.duration ?? 4000,
    }),

  warning: (message: string, opts: InfoOptions = {}) =>
    addToast({
      message,
      variant: "default",
      autoDismiss: opts.duration ?? 5000,
    }),
};

/**
 * Drop-in compat shim for the ~57 files that import `toast` from `sonner`.
 * Covers the surface those call sites use (callable + success/error/info/
 * warning/message/dismiss). Migrate imports per section, then remove `sonner`.
 */
function baseToast(message: string, opts: InfoOptions = {}): void {
  notify.info(message, opts);
}

export const toast = Object.assign(baseToast, {
  success: (message: string, opts: InfoOptions = {}) =>
    notify.success(message, opts),
  error: (message: string, opts: ErrorOptions = {}) =>
    notify.error(message, opts),
  info: (message: string, opts: InfoOptions = {}) => notify.info(message, opts),
  warning: (message: string, opts: InfoOptions = {}) =>
    notify.warning(message, opts),
  message: (message: string, opts: InfoOptions = {}) =>
    notify.info(message, opts),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dismiss: (_id?: string | number): void => {},
});
