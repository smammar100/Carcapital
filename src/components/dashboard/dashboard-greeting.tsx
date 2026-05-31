"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { AddVehicleButton } from "@/components/vehicles/add-vehicle-button";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { returnService } from "@/lib/services/return-service";

export function DashboardGreeting() {
  const { user, company } = useAuth();
  const [stats, setStats] = useState<{ prep: number; returns: number } | null>(
    null,
  );

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      maintenanceService.getAll(company.id),
      returnService.getAll(company.id),
    ]).then(([m, r]) => {
      setStats({
        prep: m.filter(
          (x) => x.status === "pending" || x.status === "in_progress",
        ).length,
        returns: r.filter(
          (x) => x.status === "pending" || x.status === "in_review",
        ).length,
      });
    });
  }, [company]);

  const firstName = user?.name.split(" ")[0] ?? "";
  const prep = stats?.prep ?? null;
  const returns = stats?.returns ?? null;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome Back, {firstName}!
        </h1>
        <p className="text-sm text-muted-foreground">
          Today you have{" "}
          <span className="font-semibold text-foreground">
            {prep ?? "—"} car{prep === 1 ? "" : "s"} to prep
          </span>
          ,{" "}
          <span className="font-semibold text-foreground">
            {returns ?? "—"} return{returns === 1 ? "" : "s"}
          </span>{" "}
          pending
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/master-sheet">
            <Download className="mr-1 h-3.5 w-3.5" />
            Export
          </Link>
        </Button>
        <AddVehicleButton size="sm">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Vehicle
        </AddVehicleButton>
      </div>
    </div>
  );
}
