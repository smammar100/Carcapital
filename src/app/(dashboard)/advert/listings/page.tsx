"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { listingService } from "@/lib/services/listing-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Listing, Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { RegPlate } from "@/components/shared/reg-plate";
import { formatCurrency } from "@/lib/utils";

export default function ListingsPage() {
  const { company } = useAuth();
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      listingService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([l, v]) => {
      setListings(l.filter((x) => x.status === "live"));
      setVehicles(v);
    });
  }, [company]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Live Listings</h1>
        <p className="text-sm text-muted-foreground">
          Every vehicle currently advertised across your channels. Manage drafts
          and archive from the{" "}
          <Link href="/advert/work-list" className="text-primary hover:underline">
            Work List
          </Link>
          .
        </p>
      </div>

      {!listings ? (
        <Skeleton className="h-72" />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No live listings"
          description="Publish a draft from the Work List to advertise it."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => {
            const v = vehicles.find((x) => x.id === l.vehicleId);
            return (
              <Card key={l.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  {v && <RegPlate registration={v.registration} size="sm" />}
                  <Badge variant="secondary" className="text-xs">
                    {l.atPriceIndicator.replace("_", " ")}
                  </Badge>
                </div>
                <div className="text-sm font-medium">{l.title}</div>
                <div className="text-xs text-muted-foreground">
                  {v ? `${v.make} ${v.model} · ${v.stockId}` : "—"}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold">{formatCurrency(l.price)}</span>
                  <span className="text-muted-foreground">
                    {l.enquiriesCount} enquir{l.enquiriesCount === 1 ? "y" : "ies"}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
