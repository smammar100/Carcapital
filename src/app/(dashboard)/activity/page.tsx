"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { History } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { formatRelativeTime, getInitials } from "@/lib/utils";

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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground">
          {filtered ? `${filtered.length} entries` : "Loading…"}
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

      {!filtered ? (
        <Skeleton className="h-72" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity"
          description="Once people start using the system, every action lands here."
        />
      ) : (
        <Card className="p-5">
          <ol className="relative ms-3 space-y-4 border-l pl-5">
            {filtered.map((e) => {
              const user = users.find((u) => u.id === e.userId);
              const vehicle = vehicles.find((v) => v.id === e.vehicleId);
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[27px] top-1 grid h-5 w-5 place-items-center rounded-full bg-background ring-2 ring-border">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[8px]">
                        {user ? getInitials(user.name) : "?"}
                      </AvatarFallback>
                    </Avatar>
                  </span>
                  <div className="text-sm">
                    <span className="font-medium">{user?.name ?? "—"}</span>{" "}
                    <span className="text-muted-foreground">
                      · {formatRelativeTime(e.createdAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
                    <span>{e.description}</span>
                    {vehicle && (
                      <Link
                        href={`/vehicles/${vehicle.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {vehicle.registration}
                      </Link>
                    )}
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize"
                    >
                      {e.actionType.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}
