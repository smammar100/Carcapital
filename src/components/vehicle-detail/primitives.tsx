"use client";

import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * v5 vehicle-detail primitives. Thin wrappers around shadcn so the
 * vehicle-detail surface looks and feels exactly like the rest of the
 * app — same Card chrome, same Badge tones, same typography. The "v5
 * layout" lives in how these pieces are arranged inside each tab; the
 * pieces themselves are stock app components.
 */

// ============================================================
// PILL — wraps shadcn Badge so the status tones are app-wide
// consistent (mirrors the warranty StatusPill pattern).
// ============================================================

type PillTone = "good" | "warn" | "bad" | "info" | "purple" | "neutral";

const PILL_CLASSES: Record<PillTone, string> = {
  good: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  bad: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-200",
  info: "bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-200",
  purple: "bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200",
  neutral: "bg-muted text-muted-foreground",
};

const DOT_CLASSES: Record<PillTone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-rose-500",
  info: "bg-blue-500",
  purple: "bg-violet-500",
  neutral: "bg-muted-foreground",
};

interface PillProps {
  tone?: PillTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Pill({ tone = "neutral", dot = true, className, children }: PillProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex items-center gap-1.5 capitalize",
        PILL_CLASSES[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", DOT_CLASSES[tone])}
        />
      )}
      {children}
    </Badge>
  );
}

// ============================================================
// KPI CARD — mirrors the warranty KpiCard pattern (icon + label
// + value + hint + amber/destructive accent).
// ============================================================

interface KpiCardProps {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Surface accent for "needs attention" / "problem" KPIs. */
  accent?: "amber" | "destructive";
}

export function KpiCard({ icon: Icon, label, value, hint, accent }: KpiCardProps) {
  return (
    <Card
      size="sm"
      className={cn(
        "gap-2 transition-colors",
        accent === "amber" &&
          "border-amber-400/60 bg-amber-50 ring-amber-400/30 dark:border-amber-500/40 dark:bg-amber-500/5",
        accent === "destructive" &&
          "border-destructive/40 bg-destructive/5 ring-destructive/30",
      )}
    >
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
          {Icon && (
            <Icon
              className={cn(
                "h-4 w-4",
                accent === "amber" && "text-amber-600",
                accent === "destructive" && "text-destructive",
                !accent && "text-muted-foreground",
              )}
            />
          )}
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// SECTION DIVIDER — labelled hairline used between sub-sections
// in a single tab.
// ============================================================

interface SectionDividerProps {
  label: string;
  trailing?: ReactNode;
}

export function SectionDivider({ label, trailing }: SectionDividerProps) {
  return (
    <div className="mt-6 mb-3 flex items-center gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
      {trailing}
    </div>
  );
}

// ============================================================
// PANEL — Card wrapper with optional header (title / subtitle /
// trailing action). Centralises the "title + content" layout we
// repeat in every tab.
// ============================================================

interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** When true, drop the inner content padding (for tables / lists). */
  flush?: boolean;
  className?: string;
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  flush,
  className,
}: PanelProps) {
  return (
    <Card size="sm" className={cn("gap-3", className)}>
      {(title || action) && (
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {title && <CardTitle>{title}</CardTitle>}
            {subtitle && <CardDescription>{subtitle}</CardDescription>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </CardHeader>
      )}
      <CardContent className={cn(flush && "px-0")}>{children}</CardContent>
    </Card>
  );
}

// ============================================================
// INFO CARD — soft accent card used at the top of tabs to
// explain what the tab tracks.
// ============================================================

interface InfoCardProps {
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
}

export function InfoCard({ icon, title, children }: InfoCardProps) {
  return (
    <Card
      size="sm"
      className="gap-3 border-violet-200/70 bg-violet-50/70 ring-violet-300/20 dark:border-violet-500/20 dark:bg-violet-500/5"
    >
      <CardContent className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-card text-violet-600 dark:text-violet-300">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          <div className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {children}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// FIELD GRID — labelled key/value list used in Overview, Listing,
// Purchase Information, etc.
// ============================================================

interface FieldGridProps {
  children: ReactNode;
  cols?: 2 | 3 | 4;
  className?: string;
}

export function FieldGrid({ children, cols = 2, className }: FieldGridProps) {
  return (
    <div
      className={cn(
        "grid gap-x-8 gap-y-5",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  /** True for currency / numbers — applies tabular-nums for clean column alignment. */
  numeric?: boolean;
  muted?: boolean;
  className?: string;
}

export function Field({ label, children, numeric, muted, className }: FieldProps) {
  return (
    <div className={className}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm",
          numeric && "tabular-nums",
          muted && "text-muted-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}
