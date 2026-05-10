/**
 * v4.5 §25 — toast wrapper shim.
 *
 * Surfaces the same `toast.success() / toast.error() / toast.info() / toast.warning()`
 * API used today (via sonner) so consumer code can be migrated to import from
 * `@/lib/toast` without rewriting every call site.
 *
 * Initial implementation: pass-through re-export of `sonner`'s `toast` API.
 *
 * A later commit (v4.5 §26 commit 14 — strip Tailwind / replace sonner) swaps
 * the implementation to Spectrum 2's `ToastQueue`, mapping:
 *   - toast.success → ToastQueue.positive(...)
 *   - toast.error   → ToastQueue.negative(...)
 *   - toast.warning → ToastQueue.notice(...)
 *   - toast.info    → ToastQueue.info(...)
 *
 * That swap will be invisible to consumers because the export shape stays the same.
 */
export { toast } from "sonner";
export type { ExternalToast } from "sonner";
