"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Calendar,
  Car,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  History,
  Image as ImageIcon,
  Mail,
  Megaphone,
  Receipt,
  Settings,
  Shield,
  TrendingUp,
  Undo2,
  UserPlus,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { activityService } from "@/lib/services/activity-service";
import { authService } from "@/lib/services/auth-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { vehicleDetailHref } from "@/lib/vehicle-nav";
import type {
  ActivityActionType,
  ActivityLogEntry,
  User,
  Vehicle,
} from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FilterBar,
  matchesFilterState,
  useFilterState,
  type SelectFilter,
} from "@/components/filters/filter-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, formatRelativeTime } from "@/lib/utils";

const ACTION_TYPES: ActivityActionType[] = [
  "vehicle_arrived",
  "vehicle_status_changed",
  "vehicle_returned",
  "inspection_started",
  "inspection_completed",
  "todo_added",
  "todo_completed",
  "maintenance_job_created",
  "maintenance_job_completed",
  "workshop_job_created",
  "photo_uploaded",
  "photo_processed",
  "listing_created",
  "listing_published",
  "lead_created",
  "lead_converted",
  "appointment_booked",
  "appointment_completed",
  "sale_stage_changed",
  "sale_completed",
  "warranty_created",
  "warranty_claim_opened",
  "invoice_created",
  "invoice_sent",
  "invoice_paid",
  "cost_updated",
  "user_invited",
  "company_setting_changed",
];

// Each action type maps to an icon + a soft color tint for its timeline node.
const TINT = {
  blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  sky: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  teal: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300",
  indigo: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
  orange: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  slate: "bg-muted text-muted-foreground",
} as const;

const ACTION_META: Partial<
  Record<ActivityActionType, { icon: LucideIcon; tint: string }>
> = {
  vehicle_arrived: { icon: Car, tint: TINT.blue },
  vehicle_status_changed: { icon: Car, tint: TINT.sky },
  vehicle_returned: { icon: Undo2, tint: TINT.rose },
  inspection_started: { icon: ClipboardCheck, tint: TINT.amber },
  inspection_completed: { icon: ClipboardCheck, tint: TINT.amber },
  todo_added: { icon: CheckSquare, tint: TINT.slate },
  todo_completed: { icon: CheckSquare, tint: TINT.slate },
  maintenance_job_created: { icon: Wrench, tint: TINT.amber },
  maintenance_job_completed: { icon: Wrench, tint: TINT.amber },
  workshop_job_created: { icon: Wrench, tint: TINT.amber },
  photo_uploaded: { icon: ImageIcon, tint: TINT.violet },
  photo_processed: { icon: ImageIcon, tint: TINT.violet },
  listing_created: { icon: Megaphone, tint: TINT.indigo },
  listing_published: { icon: Megaphone, tint: TINT.indigo },
  listing_deleted: { icon: Megaphone, tint: TINT.rose },
  lead_created: { icon: UserPlus, tint: TINT.teal },
  lead_converted: { icon: UserPlus, tint: TINT.teal },
  lead_status_changed: { icon: UserPlus, tint: TINT.teal },
  appointment_booked: { icon: Calendar, tint: TINT.teal },
  appointment_completed: { icon: Calendar, tint: TINT.teal },
  sale_stage_changed: { icon: TrendingUp, tint: TINT.blue },
  sale_completed: { icon: CheckCircle2, tint: TINT.emerald },
  warranty_created: { icon: Shield, tint: TINT.orange },
  warranty_claim_opened: { icon: Shield, tint: TINT.orange },
  invoice_created: { icon: Receipt, tint: TINT.violet },
  invoice_sent: { icon: Mail, tint: TINT.violet },
  invoice_paid: { icon: Banknote, tint: TINT.emerald },
  cost_updated: { icon: Banknote, tint: TINT.amber },
  user_invited: { icon: UserPlus, tint: TINT.slate },
  company_setting_changed: { icon: Settings, tint: TINT.slate },
};

function actionMeta(a: ActivityActionType) {
  return ACTION_META[a] ?? { icon: History, tint: TINT.slate };
}

/** Group label for a timestamp: Today / Yesterday / N days ago / date. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const PAGE_SIZE = 100;

export default function ActivityLogPage() {
  const pathname = usePathname();
  const { company } = useAuth();
  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  // Shared FilterBar (GEN-22) replaces the page's bespoke Action/User/From/To
  // row so the audit page filters like Invoicing & Closed Deals — with date
  // presets, a search box, and labelled selects (GEN-47).
  const { state: filters, setState: setFilters } = useFilterState();

  // Depend on the stable id, NOT the company object: auth revalidation mints
  // a new company object identity, and re-running this effect would clobber
  // pages the user has already loaded back to page 1.
  const companyId = company?.id ?? null;
  useEffect(() => {
    if (!companyId) return;
    // A4: keyset pagination — the audit trail grows unboundedly, so the page
    // loads the newest PAGE_SIZE entries and appends older ones on demand.
    void Promise.all([
      activityService.getPage(companyId, { limit: PAGE_SIZE }),
      authService.getUsersForCompany(companyId),
      vehicleService.getAll(companyId),
    ]).then(([page, u, v]) => {
      setEntries(page.rows);
      setNextCursor(page.nextCursor);
      setUsers(u);
      setVehicles(v);
    });
  }, [companyId]);

  // Ref (not state) guards the in-flight fetch: two rapid clicks land before
  // the state update flushes, and appending the same page twice duplicates
  // every entry. The ref flips synchronously.
  const loadingRef = useRef(false);
  const loadMore = async () => {
    if (!company || !nextCursor || loadingRef.current) return;
    loadingRef.current = true;
    setLoadingMore(true);
    try {
      const page = await activityService.getPage(company.id, {
        limit: PAGE_SIZE,
        cursor: nextCursor,
      });
      setEntries((prev) => {
        const seen = new Set((prev ?? []).map((e) => e.id));
        return [...(prev ?? []), ...page.rows.filter((e) => !seen.has(e.id))];
      });
      setNextCursor(page.nextCursor);
    } finally {
      loadingRef.current = false;
      setLoadingMore(false);
    }
  };

  const selectFilters: SelectFilter[] = useMemo(
    () => [
      {
        key: "action",
        label: "Action",
        allLabel: "Any action",
        options: ACTION_TYPES.map((a) => ({
          value: a,
          label: a
            .replace(/_/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase()),
        })),
      },
      {
        key: "user",
        label: "User",
        allLabel: "Any user",
        options: users.map((u) => ({ value: u.id, label: u.name })),
      },
    ],
    [users],
  );

  const filtered = useMemo(() => {
    if (!entries) return null;
    return entries.filter((e) =>
      matchesFilterState(e, filters, {
        searchText: (row) => {
          const user = users.find((u) => u.id === row.userId);
          const vehicle = vehicles.find((v) => v.id === row.vehicleId);
          return [
            row.description,
            row.actionType.replace(/_/g, " "),
            user?.name,
            vehicle?.registration,
          ]
            .filter(Boolean)
            .join(" ");
        },
        date: (row) => row.createdAt,
        selectValue: (row, key) =>
          key === "action" ? row.actionType : key === "user" ? row.userId : null,
      }),
    );
  }, [entries, filters, users, vehicles]);

  // Group the (already date-sorted) entries by day for the timeline.
  const groups = useMemo(() => {
    if (!filtered) return null;
    const map = new Map<string, ActivityLogEntry[]>();
    for (const e of filtered) {
      const label = dayLabel(e.createdAt);
      const bucket = map.get(label);
      if (bucket) bucket.push(e);
      else map.set(label, [e]);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground">
          A company-wide audit trail of every action taken across the system.
          Filter by category, user, or date.
        </p>
      </div>

      <FilterBar
        state={filters}
        onChange={setFilters}
        searchPlaceholder="Search description, reg, user…"
        dateLabel="Activity"
        selects={selectFilters}
      />

      {!groups ? (
        <Skeleton className="h-72" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity"
          description="Once people start using the system, every action lands here."
        />
      ) : (
        <Card className="flex flex-col gap-6 p-5">
          {groups.map(([label, items]) => (
            <div key={label}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </h2>
              <ol className="flex flex-col">
                {items.map((e, i) => {
                  const user = users.find((u) => u.id === e.userId);
                  const vehicle = vehicles.find((v) => v.id === e.vehicleId);
                  const meta = actionMeta(e.actionType);
                  const Icon = meta.icon;
                  const last = i === items.length - 1;
                  return (
                    <li key={e.id} className="flex gap-3">
                      {/* icon node + connecting rail */}
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-card",
                            meta.tint,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {!last && <span className="w-px flex-1 bg-border" />}
                      </div>
                      <div
                        className={cn(
                          "flex flex-1 items-start justify-between gap-3 pt-1",
                          last ? "pb-0" : "pb-5",
                        )}
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium">{e.description}</span>
                            {vehicle && (
                              <Link
                                href={vehicleDetailHref(vehicle.id, pathname)}
                                className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground/80 hover:text-primary"
                              >
                                {vehicle.registration}
                              </Link>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                            {e.actionType.replace(/_/g, " ")} ·{" "}
                            <span className="normal-case">
                              {user?.name ?? "—"}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatRelativeTime(e.createdAt)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          {nextCursor && (
            <div className="flex justify-center border-t pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load older activity"}
              </Button>
            </div>
          )}
        </Card>
      )}
      {nextCursor &&
        (filters.search.trim() !== "" ||
          filters.date.from !== null ||
          filters.date.to !== null ||
          Object.values(filters.selects).some((v) => v !== "")) && (
          <p className="text-center text-xs text-muted-foreground">
            Filters apply to the {entries?.length ?? 0} loaded entries; load
            older activity to search further back.
          </p>
        )}
    </div>
  );
}
