"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import type { Vehicle } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VehicleImage } from "@/components/shared/vehicle-image";
import type { CarAngle } from "@/lib/services/photo-service";
import { Panel } from "./primitives";

interface PhotosTabProps {
  vehicle: Vehicle;
}

const PHOTO_ANGLES: { angle: CarAngle; label: string }[] = [
  { angle: "hero", label: "Hero" },
  { angle: "front", label: "Front" },
  { angle: "rear", label: "Rear" },
  { angle: "side", label: "Side" },
  { angle: "interior", label: "Interior" },
  { angle: "processed", label: "Processed" },
];

/**
 * Photos tab — a 6-column gallery. Each tile regenerates independently
 * so the dealer can iterate one angle without burning OpenAI credits on
 * the whole set. Photos are AI-generated stand-ins for now; Phase 6
 * swaps in real uploads from Supabase Storage.
 */
export function PhotosTab({ vehicle }: PhotosTabProps) {
  const [forced, setForced] = useState<Record<CarAngle, number>>({
    hero: 0,
    front: 0,
    rear: 0,
    side: 0,
    interior: 0,
    processed: 0,
    composed: 0,
  });

  function regenerate(angle: CarAngle) {
    setForced((f) => ({ ...f, [angle]: f[angle] + 1 }));
  }

  return (
    <Panel
      title={`Photos · ${PHOTO_ANGLES.length} images`}
      subtitle="AI-generated angles. Each tile is one OpenAI call when first viewed."
      action={
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Upload
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PHOTO_ANGLES.map((tile) => {
          const force = forced[tile.angle];
          return (
            <div key={tile.angle} className="flex flex-col gap-2">
              <div className="group relative overflow-hidden rounded-md border bg-muted">
                <VehicleImage
                  key={`${tile.angle}-${force}`}
                  vehicle={vehicle}
                  angle={tile.angle}
                  variant="card"
                  forceRegenerate={force > 0}
                  alt={`${vehicle.make} ${vehicle.model} ${tile.label}`}
                  className="aspect-[4/3] w-full"
                />
                <button
                  type="button"
                  onClick={() => regenerate(tile.angle)}
                  className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm transition group-hover:flex"
                  aria-label={`Regenerate ${tile.label}`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
              <Badge variant="secondary" className="self-start text-[10px]">
                {tile.label}
              </Badge>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
