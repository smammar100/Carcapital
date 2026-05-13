"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * v5 vehicle-detail primitives. These are tiny building blocks that the
 * v5 demo HTML uses across multiple tabs (pills, KPI cards, section
 * dividers, valuation cells, ledger rows, etc.). Keeping them here means
 * each tab file stays focused on layout + data, not styling.
 *
 * Design language is mapped to the existing Tailwind tokens so the
 * module fits the rest of the app — no new fonts or colour scales.
 */

// ============================================================
// PILL (status + tonal)
// ============================================================

type PillTone = "good" | "warn" | "bad" | "info" | "purple" | "neutral";

const PILL_CLASSES: Record<PillTone, string> = {
  good: "bg-emerald-100 text-emerald-800",
  warn: "bg-orange-100 text-orange-800",
  bad: "bg-rose-100 text-rose-800",
  info: "bg-sky-100 text-sky-800",
  purple: "bg-violet-100 text-violet-800",
  neutral: "bg-muted text-foreground",
};

interface PillProps {
  tone?: PillTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Pill({ tone = "neutral", dot = true, className, children }: PillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium leading-snug",
        PILL_CLASSES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// ============================================================
// KPI CARD
// ============================================================

interface KpiCardProps {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  /** Highlights metadata in a tone-coloured class. */
  metaTone?: "good" | "warn" | "bad" | "neutral";
  /** Renders the dark "featured" variant — used for headline metrics. */
  featured?: boolean;
  /** Overrides the value colour (e.g. `text-rose-600` for over-budget). */
  valueClassName?: string;
}

const KPI_META_TONE: Record<NonNullable<KpiCardProps["metaTone"]>, string> = {
  good: "text-emerald-700",
  warn: "text-orange-700",
  bad: "text-rose-700",
  neutral: "text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  meta,
  metaTone = "neutral",
  featured,
  valueClassName,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all",
        "hover:-translate-y-px hover:shadow-md",
        featured && "border-foreground bg-foreground text-background",
      )}
    >
      {featured && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_20%,rgba(245,197,24,0.15),transparent_50%)]"
        />
      )}
      <div
        className={cn(
          "relative text-[11px] font-medium tracking-wide",
          featured ? "text-white/60" : "text-muted-foreground",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "relative mt-1 font-mono text-[24px] font-semibold leading-tight tracking-tight",
          featured ? "text-[#F5C518]" : "text-foreground",
          valueClassName,
        )}
      >
        {value}
      </div>
      {meta && (
        <div
          className={cn(
            "relative mt-1 text-[11.5px]",
            featured ? "text-white/50" : KPI_META_TONE[metaTone],
          )}
        >
          {meta}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SECTION DIVIDER — "VEHICLE DETAILS" style header within a tab
// ============================================================

interface SectionDividerProps {
  label: string;
  trailing?: ReactNode;
}

export function SectionDivider({ label, trailing }: SectionDividerProps) {
  return (
    <div className="mt-7 mb-3 flex items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
      {trailing}
    </div>
  );
}

// ============================================================
// PANEL CARD — single source of truth for the tab cards
// ============================================================

interface PanelCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  /** Skip the head if you only want a body. */
  noHead?: boolean;
  /** Body padding override (default = 20px / "p-5"). */
  bodyClassName?: string;
  /** Outer container className override. */
  className?: string;
}

export function PanelCard({
  title,
  subtitle,
  trailing,
  children,
  noHead,
  bodyClassName,
  className,
}: PanelCardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        className,
      )}
    >
      {!noHead && (title || trailing) && (
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            {title && (
              <div className="text-[14.5px] font-semibold tracking-tight">
                {title}
              </div>
            )}
            {subtitle && (
              <div className="mt-0.5 text-[12px] text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>
          {trailing && <div className="shrink-0">{trailing}</div>}
        </div>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </div>
  );
}

// ============================================================
// INFO CARD — the gradient "what this tab tracks" intro card
// ============================================================

interface InfoCardProps {
  icon: ReactNode;
  title: ReactNode;
  children: ReactNode;
}

export function InfoCard({ icon, title, children }: InfoCardProps) {
  return (
    <div className="mb-3.5 flex items-start gap-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-sky-50 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-card text-violet-600">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold">{title}</div>
        <div className="mt-1 max-w-[760px] text-[12.5px] leading-relaxed text-foreground/80">
          {children}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FIELD GRID — two-column key/value list used in Overview + others
// ============================================================

interface FieldGridProps {
  children: ReactNode;
  /** Columns (default 2). */
  cols?: 2 | 3 | 4;
  className?: string;
}

export function FieldGrid({ children, cols = 2, className }: FieldGridProps) {
  return (
    <div
      className={cn(
        "grid gap-x-12 gap-y-6",
        cols === 2 && "grid-cols-1 sm:grid-cols-2",
        cols === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
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
  mono?: boolean;
  muted?: boolean;
  className?: string;
}

export function Field({ label, children, mono, muted, className }: FieldProps) {
  return (
    <div className={className}>
      <div className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-sm font-medium",
          mono && "font-mono",
          muted && "text-muted-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

// ============================================================
// GAP MARKER — "+ v4.2 ___" purple dashed badge
// ============================================================

export function GapMarker({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-[3px] border border-dashed border-violet-300 bg-violet-50 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.05em] text-violet-700">
      + {children}
    </span>
  );
}
