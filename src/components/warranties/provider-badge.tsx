"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PROVIDER_TINTS: Record<string, string> = {
  "Car Capital": "bg-primary/10 text-primary dark:bg-primary/20",
  "Warranty First": "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200",
  "AA Warranty": "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  "RAC Warranty": "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200",
  MotorEasy: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200",
};

interface ProviderBadgeProps {
  provider: string | null;
  className?: string;
}

export function ProviderBadge({ provider, className }: ProviderBadgeProps) {
  if (!provider) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        —
      </Badge>
    );
  }
  const tint = PROVIDER_TINTS[provider];
  return (
    <Badge
      variant="secondary"
      className={cn(
        tint ?? "bg-muted text-foreground",
        "font-medium",
        className,
      )}
    >
      {provider}
    </Badge>
  );
}
