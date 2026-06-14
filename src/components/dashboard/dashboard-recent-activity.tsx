"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Car,
  ClipboardCheck,
  Receipt,
  ShieldCheck,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { activityService } from "@/lib/services/activity-service";
import type { ActivityActionType, ActivityLogEntry } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function categorize(type: ActivityActionType): {
  Icon: LucideIcon;
  tag: string;
  tint: string;
} {
  if (
    type.startsWith("sale") ||
    type.startsWith("lead") ||
    type.startsWith("appointment")
  )
    return { Icon: TrendingUp, tag: "Sales", tint: "text-[var(--n-color-status-info)]" };
  if (type.startsWith("inspection"))
    return {
      Icon: ClipboardCheck,
      tag: "Inspection",
      tint: "text-[var(--n-color-status-info)]",
    };
  if (type.startsWith("maintenance") || type.startsWith("workshop"))
    return {
      Icon: Wrench,
      tag: "Workshop",
      tint: "text-[var(--n-color-status-warning)]",
    };
  if (type.startsWith("photo") || type.startsWith("listing"))
    return { Icon: Camera, tag: "Advert", tint: "text-[var(--n-color-accent)]" };
  if (type.startsWith("warranty"))
    return {
      Icon: ShieldCheck,
      tag: "Warranty",
      tint: "text-[var(--n-color-status-success)]",
    };
  if (type.includes("invoice") || type === "cost_updated")
    return {
      Icon: Receipt,
      tag: "Finance",
      tint: "text-[var(--n-color-status-success)]",
    };
  if (
    type.startsWith("user") ||
    type.includes("setting") ||
    type.includes("channel") ||
    type === "data_migrated"
  )
    return { Icon: Users, tag: "Admin", tint: "text-muted-foreground" };
  return { Icon: Car, tag: "Inventory", tint: "text-muted-foreground" };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DashboardRecentActivity() {
  const { company } = useAuth();
  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(null);

  useEffect(() => {
    if (!company) return;
    void activityService
      .getAll(company.id)
      .then((e) => setEntries(e.slice(0, 5)));
  }, [company]);

  return (
    <Card className="h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Latest news</h2>
        <Link
          href="/admin/activity"
          className="text-xs text-link underline-offset-4 hover:underline"
        >
          View all
        </Link>
      </div>
      {entries === null ? (
        <div className="p-4">
          <Skeleton className="h-40" />
        </div>
      ) : entries.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          No recent activity.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((e) => {
            const { Icon, tag, tint } = categorize(e.actionType);
            const href = e.vehicleId
              ? `/vehicles/${e.vehicleId}`
              : "/admin/activity";
            return (
              <li key={e.id}>
                <Link
                  href={href}
                  className="flex gap-3 px-4 py-3 no-underline transition-colors hover:bg-accent/40"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-muted">
                    <Icon className={cn("h-5 w-5", tint)} />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-medium">{tag}</span>
                      <span>· {timeAgo(e.createdAt)}</span>
                    </div>
                    <p className="line-clamp-2 text-sm leading-snug text-foreground">
                      {e.description}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
