import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHelperProps {
  children: ReactNode;
  className?: string;
}

/**
 * Spec v3.0 · Module E.2 — short clarifier line sitting between a page
 * title and its first table / panel. Used to disambiguate pages that
 * look interchangeable at a glance (e.g. All Vehicles vs Worklist).
 *
 * Italic, muted, capped width so it wraps cleanly on mobile.
 */
export function PageHelper({ children, className }: PageHelperProps) {
  return (
    <p
      className={cn(
        "mt-1 mb-2 max-w-2xl text-sm italic text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}
