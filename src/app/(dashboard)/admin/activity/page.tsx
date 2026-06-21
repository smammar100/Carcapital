"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { activityService } from "@/lib/services/activity-service";
import { authService } from "@/lib/services/auth-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type {
  ActivityActionType,
  ActivityLogEntry,
  User,
  Vehicle,
} from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  lead_created: { icon: UserPlus, tint: TINT.teal },
  lead_converted: { icon: UserPlus, tint: TINT.teal },
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

export default function ActivityLogPage() {
  const { company } = useAuth();
  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [actionFilter, setActionFilter] = useState<ActivityActionType | "all">(
    "all",
  );
  const [userFilter, setUserFilter] = useState<string | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      activityService.getAll(company.id),
      authService.getUsersForCompany(company.id),
      vehicleService.getAll(company.id),
    ]).then(([e, u, v]) => {
      setEntries(e);
      setUsers(u);
      setVehicles(v);
    });
  }, [company]);

  const filtered = useMemo(() => {
    if (!entries) return null;
    let out = [...entries];
    if (actionFilter !== "all")
      out = out.filter((e) => e.actionType === actionFilter);
    if (userFilter !== "all") out = out.filter((e) => e.userId === userFilter);
    if (from) out = out.filter((e) => e.createdAt >= from);
    if (to) out = out.filter((e) => e.createdAt <= `${to}T23:59:59.999Z`);
    return out;
  }, [entries, actionFilter, userFilter, from, to]);

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

      <Card className="grid gap-3 p-3 sm:grid-cols-4">
        <div>
          <Label className="text-xs">Action</Label>
          <Select
            value={actionFilter}
            onValueChange={(v) =>
              setActionFilter(v as ActivityActionType | "all")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a} value={a} className="capitalize">
                  {a.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">User</Label>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </Card>

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
                                href={`/vehicles/${vehicle.id}`}
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
        </Card>
      )}
    </div>
  );
}
