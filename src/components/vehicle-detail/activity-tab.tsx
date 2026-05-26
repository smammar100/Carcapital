"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Calendar,
  CalendarCheck,
  Car,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Database,
  History,
  Image as ImageIcon,
  MapPin,
  Megaphone,
  PoundSterling,
  Receipt,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  Tag,
  TrendingUp,
  Trophy,
  Undo2,
  UserPlus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { ActivityActionType, ActivityLogEntry, User } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { activityService } from "@/lib/services/activity-service";
import { teamService } from "@/lib/services/team-service";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime } from "@/lib/utils";
import { Panel } from "./primitives";
import { cn } from "@/lib/utils";
import {
  Timeline,
  TimelineDayHeader,
  TimelineItem,
  type TimelineTone,
} from "@/components/shared/timeline";

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
    a === "vehicle_moved" ||
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
 * Per-action-type icon + tone for the shared `<Timeline>`. Tone families:
 *   emerald = success / completion        amber = change / pending
 *   rose    = warning / return / claim    violet = create / arrival
 *   sky     = informational (location)    slate  = settings / migration
 */
const ACTION_VISUAL: Record<ActivityActionType, { icon: LucideIcon; tone: TimelineTone }> = {
  vehicle_arrived: { icon: Car, tone: "violet" },
  vehicle_status_changed: { icon: ArrowRight, tone: "amber" },
  vehicle_returned: { icon: Undo2, tone: "rose" },
  vehicle_moved: { icon: MapPin, tone: "sky" },
  inspection_started: { icon: ClipboardList, tone: "amber" },
  inspection_completed: { icon: ClipboardCheck, tone: "emerald" },
  todo_added: { icon: CheckSquare, tone: "amber" },
  todo_completed: { icon: CheckCircle2, tone: "emerald" },
  maintenance_job_created: { icon: Wrench, tone: "amber" },
  maintenance_job_completed: { icon: Wrench, tone: "emerald" },
  workshop_job_created: { icon: Briefcase, tone: "amber" },
  photo_uploaded: { icon: ImageIcon, tone: "emerald" },
  photo_processed: { icon: ImageIcon, tone: "emerald" },
  listing_created: { icon: Megaphone, tone: "amber" },
  listing_published: { icon: Megaphone, tone: "emerald" },
  lead_created: { icon: UserPlus, tone: "violet" },
  lead_converted: { icon: ArrowRight, tone: "emerald" },
  appointment_booked: { icon: CalendarCheck, tone: "emerald" },
  appointment_updated: { icon: Calendar, tone: "amber" },
  appointment_completed: { icon: CheckCircle2, tone: "emerald" },
  sale_stage_changed: { icon: TrendingUp, tone: "amber" },
  sale_completed: { icon: Trophy, tone: "emerald" },
  warranty_created: { icon: Shield, tone: "emerald" },
  warranty_claim_opened: { icon: ShieldAlert, tone: "rose" },
  invoice_created: { icon: Receipt, tone: "amber" },
  invoice_sent: { icon: Send, tone: "emerald" },
  invoice_paid: { icon: BadgeCheck, tone: "emerald" },
  cost_updated: { icon: PoundSterling, tone: "amber" },
  user_invited: { icon: UserPlus, tone: "emerald" },
  company_setting_changed: { icon: Settings, tone: "slate" },
  channel_changed: { icon: Tag, tone: "violet" },
  data_migrated: { icon: Database, tone: "slate" },
  external_invoice_created: { icon: Receipt, tone: "violet" },
  external_invoice_updated: { icon: Receipt, tone: "amber" },
  external_invoice_deleted: { icon: Receipt, tone: "rose" },
};

/**
 * Activity tab — every action taken on this vehicle since arrival, rendered
 * through the shared GitHub-style `<Timeline>`. Filter chips scope to one
 * category; day separators group events.
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

  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  if (entries === null) {
    return (
      <Panel title="Activity" subtitle="Loading…">
        <Skeleton className="h-48 w-full" />
      </Panel>
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
  const grouped = groupByDay(filtered);

  return (
    <Panel
      title="Activity"
      subtitle={`Every action taken on this vehicle since arrival · ${entries.length} events`}
      action={
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((k) => (
            <FilterChip
              key={k}
              active={filter === k}
              onClick={() => setFilter(k)}
            >
              {FILTER_LABELS[k]}
            </FilterChip>
          ))}
        </div>
      }
      flush
    >
      {filtered.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
          No events match this filter.
        </div>
      ) : (
        <div className="px-6 py-5">
          <Timeline>
            {grouped.flatMap(([day, dayEntries]) => [
              <TimelineDayHeader key={`day-${day}`}>{day}</TimelineDayHeader>,
              ...dayEntries.map((e) => {
                const visual =
                  ACTION_VISUAL[e.actionType] ?? {
                    icon: History,
                    tone: "slate" as TimelineTone,
                  };
                const actorName = userById.get(e.userId)?.name ?? "Someone";
                return (
                  <TimelineItem
                    key={e.id}
                    icon={visual.icon}
                    tone={visual.tone}
                    timestamp={formatDateTime(e.createdAt)}
                  >
                    <span className="font-medium text-foreground">{actorName}</span>{" "}
                    <span className="text-muted-foreground">·</span>{" "}
                    <span>{e.description}</span>
                  </TimelineItem>
                );
              }),
            ])}
          </Timeline>
        </div>
      )}
    </Panel>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
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
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
