"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { vehicleDetailHref } from "@/lib/vehicle-nav";

/**
 * Icon, category label and tint for one activity row.
 *
 * The tint used to vary by category — green for warranty, amber for workshop,
 * blue for sales. Genaro's rule 4 reserves red, amber and green for status, and
 * a category is not a status: a workshop entry is not a warning. The category
 * is carried by the icon and the tag text, which say it unambiguously, so the
 * tint is now one neutral brand tone throughout.
 */
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
    return { Icon: TrendingUp, tag: "Sales", tint: "text-[var(--color-navy-500)]" };
  if (type.startsWith("inspection"))
    return {
      Icon: ClipboardCheck,
      tag: "Inspection",
      tint: "text-[var(--color-navy-500)]",
    };
  if (type.startsWith("maintenance") || type.startsWith("workshop"))
    return {
      Icon: Wrench,
      tag: "Workshop",
      tint: "text-[var(--color-navy-500)]",
    };
  if (type.startsWith("photo") || type.startsWith("listing"))
    return { Icon: Camera, tag: "Advert", tint: "text-[var(--color-navy-500)]" };
  if (type.startsWith("warranty"))
    return {
      Icon: ShieldCheck,
      tag: "Warranty",
      tint: "text-[var(--color-navy-500)]",
    };
  if (type.includes("invoice") || type === "cost_updated")
    return {
      Icon: Receipt,
      tag: "Finance",
      tint: "text-[var(--color-navy-500)]",
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
  const pathname = usePathname();
  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(null);

  useEffect(() => {
    if (!company) return;
    void activityService
      .getAll(company.id)
      .then((e) => setEntries(e.slice(0, 5)));
  }, [company]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">
            Latest news
          </h2>
          <span className="text-[12px] text-muted-text">today</span>
        </div>
        <Link
          className="text-[12px] text-accent-navy no-underline hover:underline"
          href="/admin/activity"
        >
          View all
        </Link>
      </div>

      {entries === null ? (
        <div className="p-4">
          <Skeleton className="h-40" />
        </div>
      ) : entries.length === 0 ? (
        <p className="px-6 py-10 text-center text-[13px] leading-[1.55] text-body-text">
          Nothing has happened today. Every sale, inspection, workshop job and
          listing change lands here as it is recorded.
        </p>
      ) : (
        <ul className="flex flex-1 list-none flex-col justify-between py-2 pb-2.5">
          {entries.map((e) => {
            const { Icon, tag, tint } = categorize(e.actionType);
            const href = e.vehicleId
              ? vehicleDetailHref(e.vehicleId, pathname)
              : "/admin/activity";
            return (
              <li key={e.id}>
                <Link
                  className="flex gap-2.5 px-4 py-[5px] no-underline"
                  href={href}
                >
                  {/* The design puts a 54x40 photo here. Activity entries carry
                      no image, so the category icon fills the same slot at the
                      same size rather than leaving a hole or inventing art. */}
                  <span className="grid h-10 w-[54px] shrink-0 place-items-center rounded-[5px] bg-line-soft">
                    <Icon className={cn("h-4 w-4", tint)} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-accent-navy">
                        {tag}
                      </span>
                      <span className="block size-[3px] rounded-full bg-[#D4D4D8]" />
                      <span className="text-[11px] text-faint">
                        {timeAgo(e.createdAt)}
                      </span>
                    </span>
                    <span className="line-clamp-2 text-[12.5px] font-medium leading-[1.34] text-pretty">
                      {e.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
