"use client";

import * as React from "react";
import { Badge as SpectrumBadge } from "@react-spectrum/s2";

/**
 * v4.5 — shadcn Badge → Spectrum Badge wrapper.
 * Maps shadcn variants to Spectrum variants:
 *   default → informative
 *   secondary → neutral
 *   destructive → negative
 *   outline → neutral (Spectrum has no outline variant — uses neutral)
 *   ghost → neutral
 *   link → neutral
 */
type ShadcnBadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "link";

type SpectrumVariant =
  | "accent"
  | "informative"
  | "neutral"
  | "positive"
  | "notice"
  | "negative"
  | "gray"
  | "red"
  | "orange"
  | "yellow"
  | "charteuse"
  | "celery"
  | "green"
  | "seafoam"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "fuchsia"
  | "magenta"
  | "pink"
  | "turquoise"
  | "brown"
  | "cinnamon"
  | "silver";

const VARIANT_MAP: Record<ShadcnBadgeVariant, SpectrumVariant> = {
  default: "informative",
  secondary: "neutral",
  destructive: "negative",
  outline: "neutral",
  ghost: "neutral",
  link: "neutral",
};

interface BadgeProps {
  className?: string;
  variant?: ShadcnBadgeVariant;
  asChild?: boolean;
  children?: React.ReactNode;
}

function Badge({ variant = "default", children, className }: BadgeProps) {
  const spectrumVariant = VARIANT_MAP[variant] ?? "informative";
  return (
    <SpectrumBadge variant={spectrumVariant} UNSAFE_className={className}>
      {children}
    </SpectrumBadge>
  );
}

// Keep the old export for any consumer that imports `badgeVariants`.
// During migration this is a no-op; later commits remove it entirely.
const badgeVariants = () => "";

export { Badge, badgeVariants };
