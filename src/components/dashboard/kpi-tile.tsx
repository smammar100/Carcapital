"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface KpiTileProps {
  label: string;
  value: number | null;
  href: string;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "warning" | "success";
}

export function KpiTile({
  label,
  value,
  href,
  icon: Icon,
  hint,
  tone = "default",
}: KpiTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col gap-2 rounded-xl border bg-card p-4 transition-colors hover:border-primary/50 hover:shadow-sm",
        tone === "warning" && "border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10",
        tone === "success" && "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/10",
      )}
    >
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {Icon && <Icon className="h-3.5 w-3.5" />}
      </div>
      <div className="text-3xl font-semibold tracking-tight">
        {value === null ? <Skeleton className="h-9 w-16" /> : value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Link>
  );
}
