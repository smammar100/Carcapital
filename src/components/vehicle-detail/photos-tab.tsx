"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Vehicle } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VehicleImage } from "@/components/shared/vehicle-image";
import type { CarAngle } from "@/lib/services/photo-service";
import {
  vehiclePhotoService,
  type VehiclePhoto,
} from "@/lib/services/vehicle-photo-service";
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
 * Photos tab — two sections:
 *   1. Real dealer-uploaded photos (Supabase Storage + `vehicle_photos`).
 *   2. AI-generated angle stand-ins (one OpenAI call per tile on first view).
 */
export function PhotosTab({ vehicle }: PhotosTabProps) {
  const { user, company } = useAuth();
  const [photos, setPhotos] = useState<VehiclePhoto[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    vehiclePhotoService
      .list(vehicle.id)
      .then((p) => active && setPhotos(p))
      .catch(() => active && setPhotos([]));
    return () => {
      active = false;
    };
  }, [vehicle.id]);

  async function handleFiles(files: FileList | null) {
    const list = files
      ? Array.from(files).filter((f) => f.type.startsWith("image/"))
      : [];
    if (!list.length || !user || !company) return;
    setUploading(true);
    const base = photos?.length ?? 0;
    const ok: VehiclePhoto[] = [];
    try {
      for (let i = 0; i < list.length; i++) {
        ok.push(
          await vehiclePhotoService.upload(
            list[i],
            company.id,
            vehicle.id,
            user.id,
            base + i,
          ),
        );
      }
      setPhotos((prev) => [...(prev ?? []), ...ok]);
      toast.success(`Uploaded ${ok.length} photo${ok.length === 1 ? "" : "s"}`);
    } catch (e) {
      if (ok.length) setPhotos((prev) => [...(prev ?? []), ...ok]);
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove(photo: VehiclePhoto) {
    const prev = photos;
    setPhotos((p) => (p ?? []).filter((x) => x.id !== photo.id));
    try {
      await vehiclePhotoService.remove(photo);
    } catch {
      setPhotos(prev);
      toast.error("Couldn't remove photo");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Real uploaded photos */}
      <Panel
        title={`Photos${photos && photos.length ? ` · ${photos.length}` : ""}`}
        subtitle="Upload real photos of this vehicle — stored securely and ready for the listing."
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="mr-1 h-3.5 w-3.5" />
            )}
            Upload
          </Button>
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "rounded-md transition",
            dragging && "ring-2 ring-primary ring-offset-2",
          )}
        >
          {photos === null ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] w-full rounded-md" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed py-12 text-sm text-muted-foreground transition hover:bg-muted/40"
            >
              <ImagePlus className="h-6 w-6" />
              <span>
                Drag photos here or{" "}
                <span className="font-medium text-foreground">
                  click to upload
                </span>
              </span>
              <span className="text-xs">JPG, PNG or WebP · up to 15 MB each</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {photos.map((p) => (
                <div
                  key={p.id}
                  className="group relative overflow-hidden rounded-md border bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={`${vehicle.make} ${vehicle.model} photo`}
                    className="aspect-[4/3] w-full object-cover"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemove(p)}
                    className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-full bg-background/85 text-destructive shadow-sm transition hover:bg-background group-hover:flex"
                    aria-label="Remove photo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>

      {/* AI-generated angle stand-ins */}
      <Panel
        title="AI-generated angles"
        subtitle="Studio stand-ins generated on demand. Each tile is one OpenAI call when first viewed."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {PHOTO_ANGLES.map((tile) => (
            <AiAngleTile key={tile.angle} vehicle={vehicle} tile={tile} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AiAngleTile({
  vehicle,
  tile,
}: {
  vehicle: Vehicle;
  tile: { angle: CarAngle; label: string };
}) {
  const [force, setForce] = useState(0);
  return (
    <div className="flex flex-col gap-2">
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
          onClick={() => setForce((f) => f + 1)}
          className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm transition group-hover:flex"
          aria-label={`Regenerate ${tile.label}`}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      <Badge variant="secondary" className="self-start text-xs">
        {tile.label}
      </Badge>
    </div>
  );
}
