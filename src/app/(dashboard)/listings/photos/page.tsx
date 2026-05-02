"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Image as ImageIcon, Wand2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RegPlate } from "@/components/shared/reg-plate";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const BACKGROUNDS = [
  { id: "white", label: "White Studio", swatch: "bg-zinc-50" },
  { id: "grey", label: "Grey Studio", swatch: "bg-zinc-300" },
  { id: "showroom", label: "Showroom Floor", swatch: "bg-amber-100" },
  { id: "driveway", label: "Outdoor Driveway", swatch: "bg-stone-300" },
  { id: "luxury", label: "Luxury Gradient", swatch: "bg-gradient-to-br from-violet-200 to-rose-200" },
  { id: "sunset", label: "Sunset", swatch: "bg-gradient-to-br from-orange-300 to-rose-400" },
  { id: "mountain", label: "Mountain", swatch: "bg-gradient-to-br from-sky-300 to-emerald-300" },
  { id: "beach", label: "Beach", swatch: "bg-gradient-to-br from-sky-200 to-amber-100" },
  { id: "garage", label: "Garage", swatch: "bg-zinc-700" },
  { id: "black", label: "Plain Black", swatch: "bg-black" },
];

export default function PhotoProcessingPage() {
  const { company } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [bg, setBg] = useState("white");

  useEffect(() => {
    if (!company) return;
    void vehicleService.getAll(company.id).then((v) => {
      const withImages = v.filter((x) => x.imagesCount > 0);
      setVehicles(withImages);
      if (withImages.length > 0 && !selected) setSelected(withImages[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const vehicle = vehicles?.find((v) => v.id === selected) ?? null;
  const swatch = BACKGROUNDS.find((b) => b.id === bg)!;

  function handleProcess() {
    setBgRemoved(true);
    toast.success("Background removed (mock)");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Photo Processing
        </h1>
        <p className="text-sm text-muted-foreground">
          Mock background removal + 10 replacement backgrounds.
        </p>
      </div>
      {!vehicles ? (
        <Skeleton className="h-72" />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No vehicles with photos"
          description="Once a vehicle has uploaded photos, manage them here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Card className="flex flex-col gap-1 p-2 max-h-[70vh] overflow-y-auto">
            {vehicles.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setSelected(v.id);
                  setBgRemoved(false);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-md p-2 text-left transition-colors",
                  selected === v.id
                    ? "bg-muted"
                    : "hover:bg-muted/60",
                )}
              >
                <RegPlate registration={v.registration} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    {v.make} {v.model}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {v.imagesCount} photos
                  </div>
                </div>
              </button>
            ))}
          </Card>

          <Card className="flex flex-col gap-4 p-4">
            {vehicle && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">
                      {vehicle.make} {vehicle.model}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {vehicle.imagesCount} photos · {vehicle.stockId}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/vehicles/${vehicle.id}`}>Open vehicle</Link>
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <PhotoTile label="Original" badge="Raw" tone="bg-zinc-100" />
                  <PhotoTile
                    label="Processed"
                    badge={bgRemoved ? "BG removed" : "Pending"}
                    tone="bg-zinc-50"
                    overlay={
                      bgRemoved ? null : (
                        <Button size="sm" onClick={handleProcess}>
                          <Wand2 className="mr-1.5 h-4 w-4" />
                          Process Background
                        </Button>
                      )
                    }
                  />
                  <PhotoTile
                    label="Composed"
                    badge={swatch.label}
                    tone={swatch.swatch}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Label className="text-xs">Background processing</Label>
                  <Switch
                    checked={bgRemoved}
                    onCheckedChange={setBgRemoved}
                  />
                  <span className="text-xs text-muted-foreground">
                    {bgRemoved ? "On" : "Off"}
                  </span>
                </div>

                <div>
                  <Label className="mb-2 block text-xs">
                    Replacement background
                  </Label>
                  <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                    {BACKGROUNDS.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBg(b.id)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-md p-1 text-[10px] transition",
                          bg === b.id
                            ? "ring-2 ring-primary"
                            : "ring-1 ring-border hover:ring-primary/50",
                        )}
                        title={b.label}
                      >
                        <span
                          className={cn(
                            "h-12 w-full rounded",
                            b.swatch,
                          )}
                        />
                        <span className="line-clamp-1 text-center">
                          {b.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function PhotoTile({
  label,
  badge,
  tone,
  overlay,
}: {
  label: string;
  badge: string;
  tone: string;
  overlay?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border">
      <div
        className={cn(
          "flex h-44 w-full items-center justify-center",
          tone,
        )}
      >
        <ImageIcon className="h-10 w-10 text-zinc-400" />
        {overlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 backdrop-blur-[1px]">
            {overlay}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between border-t bg-background px-2 py-1.5 text-xs">
        <span className="font-medium">{label}</span>
        <Badge variant="secondary" className="text-[10px]">
          {badge}
        </Badge>
      </div>
    </div>
  );
}
