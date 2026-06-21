"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Image as ImageIcon, Loader2, Wand2 } from "lucide-react";
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
import { VehicleImage } from "@/components/shared/vehicle-image";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

const BACKGROUNDS = [
  { id: "white", label: "White Studio", swatch: "bg-zinc-50", hint: "seamless white cyclorama" },
  { id: "grey", label: "Grey Studio", swatch: "bg-zinc-300", hint: "soft grey cyclorama" },
  { id: "showroom", label: "Showroom Floor", swatch: "bg-amber-100", hint: "polished marble dealership floor with overhead halogen lighting" },
  { id: "driveway", label: "Outdoor Driveway", swatch: "bg-stone-300", hint: "suburban driveway with brick paving and soft daylight" },
  { id: "luxury", label: "Luxury Gradient", swatch: "bg-gradient-to-br from-violet-200 to-rose-200", hint: "abstract violet-to-rose gradient" },
  { id: "sunset", label: "Sunset", swatch: "bg-gradient-to-br from-orange-300 to-rose-400", hint: "dramatic sunset over coastal road" },
  { id: "mountain", label: "Mountain", swatch: "bg-gradient-to-br from-sky-300 to-emerald-300", hint: "scenic mountain pass at golden hour" },
  { id: "beach", label: "Beach", swatch: "bg-gradient-to-br from-sky-200 to-amber-100", hint: "sandy beach with calm sea horizon" },
  { id: "garage", label: "Garage", swatch: "bg-zinc-700", hint: "concrete garage with directional spotlights" },
  { id: "black", label: "Plain Black", swatch: "bg-black", hint: "infinite black void with rim lighting" },
];

export default function PhotoProcessingPage() {
  const { user, company } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [bg, setBg] = useState("white");

  useEffect(() => {
    if (!company) return;
    void vehicleService.getAll(company.id).then((v) => {
      setVehicles(v);
      const withImages = v.filter((x) => x.imagesCount > 0);
      if (withImages.length > 0 && !selected) setSelected(withImages[0].id);
      else if (v.length > 0 && !selected) setSelected(v[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company]);

  const vehicle = vehicles?.find((v) => v.id === selected) ?? null;
  const swatch = BACKGROUNDS.find((b) => b.id === bg)!;

  // Processed (BG-removed white-studio) and composed (car on selected backdrop)
  // tiles: ephemeral URLs returned by /api/photo/vehicle and cached on disk.
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [processedLoading, setProcessedLoading] = useState(false);
  const [composedUrl, setComposedUrl] = useState<string | null>(null);
  const [composedLoading, setComposedLoading] = useState(false);

  // Reset tiles when the selected vehicle changes
  useEffect(() => {
    setProcessedUrl(null);
    setComposedUrl(null);
  }, [selected]);

  async function fetchAngle(
    vehicleId: string,
    angle: "processed" | "composed",
    extra?: { backdropKey: string; backdropHint: string },
  ): Promise<string> {
    const res = await fetch("/api/photo/vehicle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId, angle, ...extra }),
    });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      throw new Error(json.error ?? `HTTP ${res.status}`);
    }
    return json.url;
  }

  async function handleProcess() {
    if (!vehicle) return;
    setProcessedLoading(true);
    try {
      const url = await fetchAngle(vehicle.id, "processed");
      setProcessedUrl(url);
      setBgRemoved(true);
      toast.success("Background removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Process failed");
    } finally {
      setProcessedLoading(false);
    }
  }

  // Auto-generate composed when the backdrop changes (cached per vehicle+key)
  useEffect(() => {
    if (!vehicle) return;
    let cancelled = false;
    setComposedLoading(true);
    setComposedUrl(null);
    fetchAngle(vehicle.id, "composed", {
      backdropKey: swatch.id,
      backdropHint: swatch.hint,
    })
      .then((u) => {
        if (cancelled) return;
        setComposedUrl(u);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(
          e instanceof Error ? e.message : "Compose failed",
        );
      })
      .finally(() => {
        if (!cancelled) setComposedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicle, swatch.id, swatch.hint]);


  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Photo Processing
        </h1>
        <p className="text-sm text-muted-foreground">
          Prepare vehicle photos for advertising. Remove backgrounds, apply
          backdrops, and generate AI images.
        </p>
      </div>
      {!vehicles ? (
        <Skeleton className="h-72" />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No vehicles in stock"
          description="Add a vehicle first, then come back here to manage photos."
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
                  selected === v.id ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <RegPlate registration={v.registration} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">
                    {v.make} {v.model}
                  </div>
                  <div className="text-xs text-muted-foreground">
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
                  <div className="flex gap-2">
                    {/* v4.1 TC-P2-008/009: Mark Photos Ready transitions
                        photos_pending → photos_ready → ready */}
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!user) return;
                        if (vehicle.status === "photos_pending") {
                          await vehicleService.changeStatus(
                            vehicle.id,
                            "ready",
                            user.id,
                          );
                          toast.success(`${vehicle.registration} marked Ready`);
                          if (company)
                            setVehicles(
                              await vehicleService.getAll(company.id),
                            );
                        } else if (vehicle.status === "ready") {
                          toast.info("Already Ready");
                        } else {
                          toast.info(
                            `Vehicle is in ${vehicle.status} status — cannot mark ready yet`,
                          );
                        }
                      }}
                      disabled={
                        vehicle.status !== "photos_pending" &&
                        vehicle.status !== "photos_ready"
                      }
                    >
                      Mark Photos Ready
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/vehicles/${vehicle.id}`}>Open vehicle</Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="relative overflow-hidden rounded-md border">
                        <VehicleImage
                          vehicle={vehicle}
                          variant="card"
                          className="h-44 rounded-none"
                        />
                        <div className="flex items-center justify-between border-t bg-background px-2 py-1.5 text-xs">
                          <span className="font-medium">Original</span>
                          <Badge variant="secondary" className="text-xs">
                            AI hero
                          </Badge>
                        </div>
                      </div>
                      <ImageTile
                        label="Processed"
                        badge={processedUrl ? "BG removed" : "Click to process"}
                        url={processedUrl}
                        loading={processedLoading}
                        fallbackTone="bg-zinc-50"
                        overlay={
                          !processedUrl && !processedLoading ? (
                            <Button size="sm" onClick={handleProcess}>
                              <Wand2 className="mr-1.5 h-4 w-4" />
                              Process Background
                            </Button>
                          ) : null
                        }
                      />
                      <ImageTile
                        label="Composed"
                        badge={swatch.label}
                        url={composedUrl}
                        loading={composedLoading}
                        fallbackTone={swatch.swatch}
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
                              "flex flex-col items-center gap-1 rounded-md p-1 text-xs transition",
                              bg === b.id
                                ? "ring-2 ring-primary"
                                : "ring-1 ring-border hover:ring-primary/50",
                            )}
                            title={b.label}
                          >
                            <span
                              className={cn("h-12 w-full rounded", b.swatch)}
                            />
                            <span className="line-clamp-1 text-center">
                              {b.label}
                            </span>
                          </button>
                        ))}
                      </div>
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

function ImageTile({
  label,
  badge,
  url,
  loading,
  fallbackTone,
  overlay,
}: {
  label: string;
  badge: string;
  url: string | null;
  loading: boolean;
  fallbackTone: string;
  overlay?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border">
      <div
        className={cn(
          "relative flex h-44 w-full items-center justify-center",
          !url && fallbackTone,
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className="h-full w-full object-cover"
          />
        ) : !loading ? (
          <ImageIcon className="h-10 w-10 text-zinc-400" />
        ) : null}
        {loading && <Skeleton className="absolute inset-0 h-full w-full rounded-none" />}
        {overlay && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 backdrop-blur-[1px]">
            {overlay}
          </div>
        )}
        {loading && (
          <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 text-xs text-muted-foreground backdrop-blur">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Generating
          </span>
        )}
      </div>
      <div className="flex items-center justify-between border-t bg-background px-2 py-1.5 text-xs">
        <span className="font-medium">{label}</span>
        <Badge variant="secondary" className="text-xs">
          {badge}
        </Badge>
      </div>
    </div>
  );
}
