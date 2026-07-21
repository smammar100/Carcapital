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
  Hammer,
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

interface ActivityTabProps {
  vehicleId: string;
}

type Tone = "violet" | "amber" | "emerald" | "rose" | "sky" | "slate";
type FilterKey = "all" | "status" | "costs" | "photos" | "listing" | "enquiries";
type Cat = Exclude<FilterKey, "all"> | "other";

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "All",
  status: "Status",
  costs: "Costs",
  photos: "Photos",
  listing: "Listing",
  enquiries: "Enquiries",
};

const FILTER_MATCH: Record<Exclude<FilterKey, "all">, (a: ActivityActionType) => boolean> = {
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
    a === "invoice_sent" ||
    a === "external_invoice_created" ||
    a === "external_invoice_updated" ||
    a === "external_invoice_deleted",
  photos: (a) => a === "photo_uploaded" || a === "photo_processed",
  listing: (a) =>
    a === "listing_created" ||
    a === "listing_published" ||
    a === "listing_deleted",
  enquiries: (a) =>
    a === "lead_created" ||
    a === "lead_converted" ||
    a === "lead_status_changed" ||
    a === "appointment_booked" ||
    a === "appointment_completed" ||
    a === "appointment_updated",
};

const CAT_LABEL: Record<Cat, string> = {
  status: "Status",
  costs: "Costs",
  photos: "Photos",
  listing: "Listing",
  enquiries: "Enquiries",
  other: "Workshop",
};

const CAT_PILL: Record<Cat, string> = {
  status: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
  costs: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  photos: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  listing: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  enquiries: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  other: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};

const TONE_BUBBLE: Record<Tone, string> = {
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};

/**
 * Per-action-type icon + tone. Tone families:
 *   emerald = success / completion        amber = change / pending
 *   rose    = warning / return / claim     violet = create / arrival
 *   sky     = informational (location)     slate  = settings / migration
 */
const ACTION_VISUAL: Record<ActivityActionType, { icon: LucideIcon; tone: Tone }> = {
  vehicle_arrived: { icon: Car, tone: "violet" },
  vehicle_status_changed: { icon: ArrowRight, tone: "amber" },
  vehicle_returned: { icon: Undo2, tone: "rose" },
  return_resolved: { icon: Undo2, tone: "emerald" },
  return_rejected: { icon: Undo2, tone: "amber" },
  vehicle_moved: { icon: MapPin, tone: "sky" },
  inspection_started: { icon: ClipboardList, tone: "amber" },
  inspection_completed: { icon: ClipboardCheck, tone: "emerald" },
  todo_added: { icon: CheckSquare, tone: "amber" },
  todo_completed: { icon: CheckCircle2, tone: "emerald" },
  prep_assigned: { icon: Hammer, tone: "amber" },
  maintenance_job_created: { icon: Wrench, tone: "amber" },
  maintenance_job_completed: { icon: Wrench, tone: "emerald" },
  workshop_job_created: { icon: Briefcase, tone: "amber" },
  photo_uploaded: { icon: ImageIcon, tone: "emerald" },
  photo_processed: { icon: ImageIcon, tone: "emerald" },
  listing_created: { icon: Megaphone, tone: "amber" },
  listing_published: { icon: Megaphone, tone: "emerald" },
  listing_deleted: { icon: Megaphone, tone: "rose" },
  lead_created: { icon: UserPlus, tone: "violet" },
  lead_converted: { icon: ArrowRight, tone: "emerald" },
  lead_status_changed: { icon: UserPlus, tone: "violet" },
  appointment_booked: { icon: CalendarCheck, tone: "emerald" },
  appointment_updated: { icon: Calendar, tone: "amber" },
  appointment_completed: { icon: CheckCircle2, tone: "emerald" },
  sale_stage_changed: { icon: TrendingUp, tone: "amber" },
  sale_completed: { icon: Trophy, tone: "emerald" },
  warranty_created: { icon: Shield, tone: "emerald" },
  warranty_purchased: { icon: Shield, tone: "emerald" },
  warranty_cancelled: { icon: Shield, tone: "rose" },
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

function categoryOf(a: ActivityActionType): Cat {
  for (const cat of ["status", "costs", "photos", "listing", "enquiries"] as const) {
    if (FILTER_MATCH[cat](a)) return cat;
  }
  return "other";
}

/**
 * Activity tab (Variation B — verb-badge feed). Every action on this vehicle as
 * clean feed rows grouped by day: a tone-coloured icon tile, the actor + what
 * they did, a colour-coded category tag, and the timestamp. Filter chips (with
 * live counts) scope to one category.
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

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: 0, status: 0, costs: 0, photos: 0, listing: 0, enquiries: 0 };
    if (entries) {
      c.all = entries.length;
      for (const e of entries) {
        const cat = categoryOf(e.actionType);
        if (cat !== "other") c[cat] += 1;
      }
    }
    return c;
  }, [entries]);

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

  const filtered =
    filter === "all" ? entries : entries.filter((e) => FILTER_MATCH[filter](e.actionType));
  const grouped = groupByDay(filtered);

  return (
    <Panel
      title="Activity"
      subtitle={`Every action taken on this vehicle since arrival · ${entries.length} events`}
      action={
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FILTER_LABELS) as FilterKey[]).map((k) => (
            <FilterChip key={k} active={filter === k} count={counts[k]} onClick={() => setFilter(k)}>
              {FILTER_LABELS[k]}
            </FilterChip>
          ))}
        </div>
      }
      flush
    >
      {filtered.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">
          No events match this filter.
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {grouped.map(([day, dayEntries]) => (
            <div key={day}>
              <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                {day}
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                {dayEntries.map((e) => {
                  const visual = ACTION_VISUAL[e.actionType] ?? { icon: History, tone: "slate" as Tone };
                  const Icon = visual.icon;
                  const cat = categoryOf(e.actionType);
                  const actorName = userById.get(e.userId)?.name ?? "Someone";
                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-muted/40"
                    >
                      <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", TONE_BUBBLE[visual.tone])}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">
                          <span className="font-medium text-foreground">{actorName}</span>{" "}
                          <span className="text-muted-foreground">· {e.description}</span>
                        </div>
                      </div>
                      <span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-2xs font-medium sm:inline", CAT_PILL[cat])}>
                        {CAT_LABEL[cat]}
                      </span>
                      <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                        {formatDateTime(e.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function FilterChip({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {children}
      <span className={cn("rounded-full px-1.5 text-2xs tabular-nums", active ? "bg-background/20" : "bg-muted")}>
        {count}
      </span>
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
