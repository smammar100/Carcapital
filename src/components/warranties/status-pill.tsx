"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ClaimStatus,
  WarrantyPurchaseStatus,
  WarrantyStatus,
} from "@/lib/types";

/**
 * Visual pill for any warranty- or claim-related status value. Uses the app's
 * Badge primitive so it inherits the global theme — never hard-codes hex.
 */

type AnyStatus = WarrantyStatus | ClaimStatus | WarrantyPurchaseStatus;

interface VariantSpec {
  /** Maps to the shadcn Badge variants the app already uses. */
  variant: "default" | "secondary" | "destructive" | "outline";
  /** Optional dot colour (Tailwind class). Falls back to currentColor. */
  dotClass?: string;
  /** Optional extra classes to tint the badge — kept token-driven. */
  extraClass?: string;
  /** Human label override if the raw status isn't presentable. */
  label?: string;
}

const SPECS: Record<AnyStatus, VariantSpec> = {
  // Warranty lifecycle
  active: { variant: "secondary", extraClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200", dotClass: "bg-emerald-500" },
  expired: { variant: "outline", dotClass: "bg-muted-foreground" },
  cancelled: { variant: "outline", extraClass: "text-muted-foreground", dotClass: "bg-muted-foreground" },

  // Claim lifecycle
  open: { variant: "destructive", dotClass: "bg-current", label: "Open" },
  under_review: { variant: "secondary", extraClass: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200", dotClass: "bg-amber-500", label: "Under review" },
  approved: { variant: "secondary", extraClass: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200", dotClass: "bg-blue-500", label: "Approved" },
  resolved: { variant: "secondary", extraClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200", dotClass: "bg-emerald-500", label: "Resolved" },
  rejected: { variant: "outline", extraClass: "text-muted-foreground", dotClass: "bg-muted-foreground", label: "Rejected" },

  // Purchase tracker
  pending: { variant: "secondary", extraClass: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200", dotClass: "bg-amber-500", label: "Pending purchase" },
  purchased: { variant: "secondary", extraClass: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200", dotClass: "bg-emerald-500", label: "Purchased" },
  n_a: { variant: "outline", extraClass: "text-muted-foreground", label: "—" },
};

interface StatusPillProps {
  status: AnyStatus;
  withDot?: boolean;
  className?: string;
}

export function StatusPill({ status, withDot = true, className }: StatusPillProps) {
  const spec = SPECS[status];
  if (!spec) return null;
  const label = spec.label ?? status.replace(/_/g, " ");
  return (
    <Badge
      variant={spec.variant}
      className={cn(
        "inline-flex items-center gap-1.5 capitalize",
        spec.extraClass,
        className,
      )}
    >
      {withDot && spec.dotClass && (
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", spec.dotClass)}
        />
      )}
      {label}
    </Badge>
  );
}
