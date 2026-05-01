"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Car,
  Inbox,
  CheckCircle2,
  MessageCircle,
  Boxes,
  ShoppingCart,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { leadService } from "@/lib/services/lead-service";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiTile } from "./kpi-tile";

interface KpiState {
  newEnquiries: number | null;
  vehiclesAdded: number | null;
  soldStock: number | null;
  liveEnquiries: number | null;
  liveStock: number | null;
  liveOrders: number | null;
}

const initial: KpiState = {
  newEnquiries: null,
  vehiclesAdded: null,
  soldStock: null,
  liveEnquiries: null,
  liveStock: null,
  liveOrders: null,
};

export function YourStockCard() {
  const { company } = useAuth();
  const [kpis, setKpis] = useState<KpiState>(initial);

  useEffect(() => {
    if (!company) return;
    void (async () => {
      const [
        newEnquiries,
        vehiclesAdded,
        soldStock,
        liveEnquiries,
        allVehicles,
      ] = await Promise.all([
        leadService.getRecent(company.id, 7),
        vehicleService.getRecent(company.id, 7),
        vehicleService.getSoldRecently(company.id, 7),
        leadService.getByStatus(company.id, ["new", "contacted"]),
        vehicleService.getAll(company.id),
      ]);
      const liveStock = allVehicles.filter(
        (v) => v.status !== "sold" && v.status !== "returned",
      ).length;
      const liveOrders = allVehicles.filter((v) => v.status === "reserved").length;
      setKpis({
        newEnquiries: newEnquiries.length,
        vehiclesAdded: vehiclesAdded.length,
        soldStock: soldStock.length,
        liveEnquiries: liveEnquiries.length,
        liveStock,
        liveOrders,
      });
    })();
  }, [company]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Your Stock</h2>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/vehicles">Manage Stock</Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiTile
          label="New Enquiries (7d)"
          value={kpis.newEnquiries}
          href="/leads"
          icon={Inbox}
        />
        <KpiTile
          label="Vehicles Added (7d)"
          value={kpis.vehiclesAdded}
          href="/vehicles"
          icon={Car}
        />
        <KpiTile
          label="Sold Stock (7d)"
          value={kpis.soldStock}
          href="/vehicles"
          icon={CheckCircle2}
          tone="success"
        />
        <KpiTile
          label="Live Enquiries"
          value={kpis.liveEnquiries}
          href="/leads"
          icon={MessageCircle}
        />
        <KpiTile
          label="Live Stock"
          value={kpis.liveStock}
          href="/vehicles"
          icon={Boxes}
        />
        <KpiTile
          label="Live Orders"
          value={kpis.liveOrders}
          href="/sales"
          icon={ShoppingCart}
        />
      </div>
    </Card>
  );
}
