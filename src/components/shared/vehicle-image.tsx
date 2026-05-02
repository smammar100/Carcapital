"use client";

import { useEffect, useState } from "react";
import { Car, RefreshCw } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import type { CarAngle } from "@/lib/services/photo-service";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { RegPlate } from "./reg-plate";

type Variant = "thumb" | "card" | "hero";

interface Props {
  vehicle: Pick<Vehicle, "id" | "registration" | "heroImageUrl">;
  angle?: CarAngle;
  variant?: Variant;
  className?: string;
  alt?: string;
  /** When true, ignores any cached URL and re-requests generation. */
  forceRegenerate?: boolean;
  onRegenerated?: (url: string) => void;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  thumb: "aspect-[4/3] w-16 rounded-md",
  card: "aspect-[16/10] w-full rounded-md",
  hero: "aspect-[16/9] w-full rounded-lg",
};

// Module-level dedupe across mounts in the same tab.
const inFlight = new Map<string, Promise<string>>();
const failed = new Set<string>();

function urlFor(vehicleId: string, angle: CarAngle): string {
  return `/generated/cars/${vehicleId}/${angle}.png`;
}

async function fetchOrGenerate(
  vehicleId: string,
  angle: CarAngle,
): Promise<string> {
  const key = `${vehicleId}:${angle}`;
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = (async () => {
    const res = await fetch("/api/photo/vehicle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicleId, angle }),
    });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      throw new Error(json.error ?? `HTTP ${res.status}`);
    }
    return json.url;
  })();
  inFlight.set(key, p);
  try {
    const url = await p;
    return url;
  } finally {
    inFlight.delete(key);
  }
}

export function VehicleImage({
  vehicle,
  angle = "hero",
  variant = "card",
  className,
  alt,
  forceRegenerate,
  onRegenerated,
}: Props) {
  const initialUrl =
    !forceRegenerate && angle === "hero" && vehicle.heroImageUrl
      ? vehicle.heroImageUrl
      : urlFor(vehicle.id, angle);
  const [url, setUrl] = useState<string>(initialUrl);
  const [pending, setPending] = useState(false);
  const [errored, setErrored] = useState(false);

  // If the parent triggers a regenerate, kick off a fresh fetch.
  useEffect(() => {
    if (!forceRegenerate) return;
    let cancelled = false;
    setErrored(false);
    setPending(true);
    fetchOrGenerate(vehicle.id, angle)
      .then((u) => {
        if (cancelled) return;
        // Bust browser cache for the same path
        const bust = `${u}?t=${Date.now()}`;
        setUrl(bust);
        onRegenerated?.(u);
      })
      .catch(() => {
        if (cancelled) return;
        setErrored(true);
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceRegenerate, vehicle.id, angle]);

  // Reset when the vehicle changes
  useEffect(() => {
    setUrl(initialUrl);
    setPending(false);
    setErrored(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.id, angle]);

  function handleImgError() {
    // 404 on the static file → trigger generation (unless we've already failed)
    const key = `${vehicle.id}:${angle}`;
    if (failed.has(key)) {
      setErrored(true);
      return;
    }
    setPending(true);
    fetchOrGenerate(vehicle.id, angle)
      .then((u) => {
        setUrl(u);
        onRegenerated?.(u);
      })
      .catch(() => {
        failed.add(key);
        setErrored(true);
      })
      .finally(() => setPending(false));
  }

  const sizeClass = VARIANT_CLASSES[variant];

  if (errored) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden bg-muted text-muted-foreground",
          sizeClass,
          className,
        )}
        title="Image unavailable"
      >
        <Car className="h-1/3 w-1/3 opacity-30" />
        <RegPlate
          registration={vehicle.registration}
          size={variant === "hero" ? "md" : "sm"}
          className="absolute bottom-1 right-1"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-muted",
        sizeClass,
        className,
      )}
    >
      {pending && (
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt ?? `Vehicle ${vehicle.registration}`}
        className={cn(
          "h-full w-full object-cover transition-opacity",
          pending && "opacity-0",
        )}
        onError={handleImgError}
        loading="lazy"
      />
      {pending && variant !== "thumb" && (
        <span className="absolute bottom-1 right-1 inline-flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
          <RefreshCw className="h-2.5 w-2.5 animate-spin" />
          Generating
        </span>
      )}
    </div>
  );
}
