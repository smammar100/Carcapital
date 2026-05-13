"use client";

import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import type { ActivityActionType, ActivityLogEntry, User } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { activityService } from "@/lib/services/activity-service";
import { teamService } from "@/lib/services/team-service";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { formatTimestamp } from "@/lib/formatters";
import { PanelCard } from "./primitives";
import { cn } from "@/lib/utils";

interface ActivityTabProps {
  vehicleId: string;
}

type FilterKey = "all" | "status" | "costs" | "photos" | "listing" | "enquiries";

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All",
  status: "Status",
  costs: "Costs",
  photos: "Photos",
  listing: "Listing",
  enquiries: "Enquiries",
};

const FILTER_MATCH: Record<FilterKey, (a: ActivityActionType) => boolean> = {
  all: () => true,
  status: (a) =>
    a === "vehicle_status_changed" ||
    a === "vehicle_arrived" ||
    a === "vehicle_returned" ||
    a === "sale_stage_changed" ||
    a === "sale_completed",
  costs: (a) =>
    a === "cost_updated" ||
    a === "invoice_created" ||
    a === "invoice_paid" ||
    a === "invoice_sent",
  photos: (a) => a === "photo_uploaded" || a === "photo_processed",
  listing: (a) => a === "listing_created" || a === "listing_published",
  enquiries: (a) =>
    a === "lead_created" ||
    a === "lead_converted" ||
    a === "appointment_booked" ||
    a === "appointment_completed" ||
    a === "appointment_updated",
};

/**
 * Activity tab — every action taken on this vehicle since arrival,
 * rendered as a vertical timeline with hollow markers. Filter chips at
 * the top scope to a single category (Status / Costs / Photos / etc.);
 * day separators group events for scanability.
 */
export function ActivityTab({ vehicleId }: ActivityTabProps) {
  const { company } = useAuth();
  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    void activityService.getForVehicle(vehicleId).then(setEntries);
    if (company?.id) {
      void teamService.getAll(company.id).then(setUsers);
    }
  }, [vehicleId, company?.id]);

  const userById = useMemo(
    () => new Map(users.map((u) => [u.id, u])),
    [users],
  );

  if (entries === null) {
    return (
      <PanelCard noHead>
        <Skeleton className="h-48 w-full" />
      </PanelCard>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No activity yet"
        description="Every action on this vehicle will appear here."
      />
    );
  }

  const filtered = entries.filter((e) => FILTER_MATCH[filter](e.actionType));

  // Group by day for the date-separator labels.
  const grouped = groupByDay(filtered);

  return (
    <PanelCard
      title="Activity"
      subtitle={`Every action taken on this vehicle since arrival · ${entries.length} events`}
      trailing={
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                filter === k
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              {FILTER_LABELS[k]}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-0"
    >
      {filtered.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">
          No events match this filter.
        </div>
      ) : (
        <div className="relative px-7 py-5">
          {/* The vertical dotted line — positioned to pass through the marker dots */}
          <div
            aria-hidden
            className="absolute bottom-7 left-[35px] top-7 border-l border-dotted border-border"
          />
          <div className="space-y-1">
            {grouped.map(([day, dayEntries]) => (
              <div key={day}>
                <div className="relative z-10 mb-1.5 mt-3 pl-8 first:mt-0">
                  <span className="inline-block rounded-full border bg-muted/30 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {day}
                  </span>
                </div>
                {dayEntries.map((e) => (
                  <TimelineEvent
                    key={e.id}
                    entry={e}
                    actorName={userById.get(e.userId)?.name ?? "Someone"}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </PanelCard>
  );
}

const MARKER_TONE: Record<ActivityActionType, string> = {
  vehicle_arrived: "border-violet-500",
  vehicle_status_changed: "border-orange-500",
  vehicle_returned: "border-rose-500",
  inspection_started: "border-emerald-600",
  inspection_completed: "border-emerald-600",
  todo_added: "border-orange-500",
  todo_completed: "border-emerald-600",
  maintenance_job_created: "border-orange-500",
  maintenance_job_completed: "border-emerald-600",
  workshop_job_created: "border-orange-500",
  photo_uploaded: "border-emerald-600",
  photo_processed: "border-emerald-600",
  listing_created: "border-emerald-600",
  listing_published: "border-emerald-600",
  lead_created: "border-violet-500",
  lead_converted: "border-emerald-600",
  appointment_booked: "border-emerald-600",
  appointment_updated: "border-orange-500",
  appointment_completed: "border-emerald-600",
  sale_stage_changed: "border-emerald-600",
  sale_completed: "border-emerald-600",
  warranty_created: "border-emerald-600",
  warranty_claim_opened: "border-rose-500",
  invoice_created: "border-emerald-600",
  invoice_sent: "border-emerald-600",
  invoice_paid: "border-emerald-600",
  cost_updated: "border-orange-500",
  user_invited: "border-emerald-600",
  company_setting_changed: "border-muted-foreground",
};

function TimelineEvent({
  entry,
  actorName,
}: {
  entry: ActivityLogEntry;
  actorName: string;
}) {
  const markerCls = MARKER_TONE[entry.actionType] ?? "border-muted-foreground";
  return (
    <div className="relative z-10 py-2 pl-8">
      <span
        className={cn(
          "absolute left-[3px] top-3 h-3 w-3 rounded-full border-2 bg-card shadow-[0_0_0_4px_var(--card)]",
          markerCls,
        )}
      />
      <div className="text-[13.5px] leading-relaxed">
        <span className="text-foreground/80">{actorName}</span>{" "}
        <span>{entry.description}</span>
      </div>
      <div className="mt-0.5 flex items-center gap-3 text-[11.5px] text-muted-foreground">
        <span className="font-mono">{formatTimestamp(entry.createdAt)}</span>
      </div>
    </div>
  );
}

function groupByDay(entries: ActivityLogEntry[]): [string, ActivityLogEntry[]][] {
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const buckets = new Map<string, ActivityLogEntry[]>();
  for (const e of entries) {
    const key = e.createdAt.slice(0, 10);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(e);
  }

  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, list]) => {
      let label: string;
      if (key === todayKey) label = `Today · ${formatDayLabel(key)}`;
      else if (key === yesterdayKey) label = `Yesterday · ${formatDayLabel(key)}`;
      else label = formatDayLabel(key);
      return [label, list] as [string, ActivityLogEntry[]];
    });
}

function formatDayLabel(iso: string): string {
  try {
    const d = new Date(`${iso}T12:00:00Z`);
    return d
      .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      .toUpperCase();
  } catch {
    return iso;
  }
}
