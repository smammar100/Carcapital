"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { appointmentService } from "@/lib/services/appointment-service";
import { workshopService } from "@/lib/services/workshop-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type {
  Appointment,
  MaintenanceJob,
  Vehicle,
  WorkshopJob,
} from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  BigCalendar,
  type CalendarEvent,
} from "@/components/shared/big-calendar";
import { cn } from "@/lib/utils";

const COLORS = {
  appointment: "#3b82f6",
  workshop: "#f97316",
  maintenance: "#a855f7",
};

export default function MasterCalendarPage() {
  const { company } = useAuth();
  const router = useRouter();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [shop, setShop] = useState<WorkshopJob[]>([]);
  const [maint, setMaint] = useState<MaintenanceJob[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAppt, setShowAppt] = useState(true);
  const [showShop, setShowShop] = useState(true);
  const [showMaint, setShowMaint] = useState(true);

  useEffect(() => {
    if (!company) return;
    setLoading(true);
    void Promise.all([
      appointmentService.getAll(company.id),
      workshopService.getAll(company.id),
      maintenanceService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([a, s, m, v]) => {
      setAppts(a);
      setShop(s);
      setMaint(m);
      setVehicles(v);
      setLoading(false);
    });
  }, [company]);

  const events: CalendarEvent[] = useMemo(() => {
    const out: CalendarEvent[] = [];
    if (showAppt) {
      for (const a of appts) {
        const start = new Date(`${a.date}T${a.time}:00`);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + 60);
        const v = vehicles.find((x) => x.id === a.vehicleId);
        out.push({
          id: `appt-${a.id}`,
          title: `📅 ${a.customerName} · ${v?.registration ?? "—"}`,
          start,
          end,
          resource: {
            kind: "appointment",
            href: v ? `/vehicles/${v.id}` : "/appointments",
            color: COLORS.appointment,
          },
        });
      }
    }
    if (showShop) {
      for (const j of shop) {
        const start = new Date(`${j.scheduledDate}T${j.scheduledTime}:00`);
        const end = new Date(start);
        end.setHours(end.getHours() + 2);
        out.push({
          id: `ws-${j.id}`,
          title: `🔧 ${j.customerName} · ${j.vehicleReg}`,
          start,
          end,
          resource: { kind: "workshop", href: "/workshop", color: COLORS.workshop },
        });
      }
    }
    if (showMaint) {
      for (const j of maint) {
        if (!j.dueDate) continue;
        const start = new Date(`${j.dueDate}T09:00:00`);
        const end = new Date(start);
        end.setHours(end.getHours() + (j.estimatedDurationHours ?? 2));
        const v = vehicles.find((x) => x.id === j.vehicleId);
        out.push({
          id: `maint-${j.id}`,
          title: `⚙️ ${v?.registration ?? "—"} · ${j.description}`,
          start,
          end,
          resource: {
            kind: "maintenance",
            href: v ? `/vehicles/${v.id}` : "/maintenance",
            color: COLORS.maintenance,
          },
        });
      }
    }
    return out;
  }, [appts, shop, maint, vehicles, showAppt, showShop, showMaint]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Master Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Overlay of appointments, workshop walk-ins, and maintenance dues.
        </p>
      </div>
      <Card className="flex flex-wrap items-center gap-4 p-3 text-sm">
        <Toggle
          checked={showAppt}
          onChange={setShowAppt}
          color={COLORS.appointment}
          label="Appointments"
        />
        <Toggle
          checked={showShop}
          onChange={setShowShop}
          color={COLORS.workshop}
          label="Workshop"
        />
        <Toggle
          checked={showMaint}
          onChange={setShowMaint}
          color={COLORS.maintenance}
          label="Maintenance"
        />
      </Card>
      <Card className="p-3">
        {loading ? (
          <Skeleton className="h-[600px] w-full" />
        ) : (
          <BigCalendar
            events={events}
            onSelectEvent={(e) => {
              const href = (e as CalendarEvent).resource?.href;
              if (href) router.push(href);
            }}
          />
        )}
      </Card>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  color,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  color: string;
}) {
  return (
    <Label className={cn("flex items-center gap-2 text-xs")}>
      <Switch checked={checked} onCheckedChange={onChange} />
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </Label>
  );
}
