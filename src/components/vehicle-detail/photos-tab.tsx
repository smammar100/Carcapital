"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  Images,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import type { Vehicle } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogPanel,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { vehicleService } from "@/lib/services/vehicle-service";
import {
  vehiclePhotoService,
  type VehiclePhoto,
} from "@/lib/services/vehicle-photo-service";
import { Panel } from "./primitives";

interface PhotosTabProps {
  vehicle: Vehicle;
}

/** Named angle slots — each is assigned from an uploaded photo. "hero" is the
 *  cover photo (persisted via vehicles.hero_image_url); the rest live in
 *  vehicles.custom_fields under `angle:<key>` → photoId. */
const ANGLES: { key: string; label: string }[] = [
  { key: "hero", label: "Hero (cover)" },
  { key: "front", label: "Front" },
  { key: "rear", label: "Rear" },
  { key: "side", label: "Side" },
  { key: "interior", label: "Interior" },
  { key: "processed", label: "Processed" },
];

const angleKey = (k: string) => `angle:${k}`;

/**
 * Photos tab (Variation C — media library + select toolbar).
 *  - Upload (drag + click) → `vehiclePhotoService.upload`.
 *  - Multi-select grid with Set-cover / Delete toolbar; per-photo hover actions.
 *  - Cover photo persists to `vehicle.heroImageUrl`.
 *  - "Vehicle angles": assign an uploaded photo to each named slot (no AI).
 */
export function PhotosTab({ vehicle }: PhotosTabProps) {
  const { user, company } = useAuth();
  const [photos, setPhotos] = useState<VehiclePhoto[] | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(vehicle.heroImageUrl);
  const [customFields, setCustomFields] = useState<Vehicle["customFields"]>(
    vehicle.customFields ?? {},
  );
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [pickerAngle, setPickerAngle] = useState<string | null>(null);
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

  const photoById = (id: string) => (photos ?? []).find((p) => p.id === id);

  async function handleFiles(files: FileList | null) {
    const list = files
      ? Array.from(files).filter((f) => f.type.startsWith("image/"))
      : [];
    if (!list.length || !user || !company) return;
    setUploading(true);
    const base = photos?.length ?? 0;
    const ok: VehiclePhoto[] = [];
    let firstError: string | null = null;
    try {
      for (let i = 0; i < list.length; i++) {
        try {
          ok.push(
            await vehiclePhotoService.upload(
              list[i],
              company.id,
              vehicle.id,
              user.id,
              base + i,
            ),
          );
        } catch (e) {
          // Keep going so one bad file doesn't abort the whole batch.
          if (!firstError) {
            firstError = e instanceof Error ? e.message : "Upload failed";
          }
        }
      }
      if (ok.length) setPhotos((prev) => [...(prev ?? []), ...ok]);
      if (ok.length) {
        toast.success(`Uploaded ${ok.length} photo${ok.length === 1 ? "" : "s"}`);
      }
      if (firstError) toast.error(firstError);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function persistCover(url: string | null) {
    setCoverUrl(url);
    if (url) {
      try {
        await vehicleService.setHeroImageUrl(vehicle.id, url);
      } catch {
        toast.error("Couldn't set cover");
      }
    }
  }

  async function handleSetCover(photo: VehiclePhoto) {
    await persistCover(photo.url);
    toast.success("Cover photo updated");
  }

  async function removeMany(ids: string[]) {
    if (!ids.length) return;
    const targets = (photos ?? []).filter((p) => ids.includes(p.id));
    const prev = photos;
    const remaining = (photos ?? []).filter((p) => !ids.includes(p.id));
    setPhotos(remaining);
    setSel(new Set());

    // If the cover was removed, fall back to the new first photo.
    const removedCover = targets.some((t) => t.url === coverUrl);
    if (removedCover) void persistCover(remaining[0]?.url ?? null);

    // Prune angle assignments that referenced a deleted photo.
    const stale = Object.entries(customFields).filter(
      ([k, v]) =>
        k.startsWith("angle:") && typeof v === "string" && ids.includes(v),
    );
    if (stale.length) {
      const next = { ...customFields };
      for (const [k] of stale) next[k] = null;
      setCustomFields(next);
      if (user) {
        void vehicleService
          .update(vehicle.id, { customFields: next }, user.id)
          .catch(() => {});
      }
    }

    try {
      for (const t of targets) await vehiclePhotoService.remove(t);
      toast.success(`Deleted ${targets.length} photo${targets.length === 1 ? "" : "s"}`);
    } catch {
      setPhotos(prev);
      toast.error("Couldn't delete photo(s)");
    }
  }

  async function assignAngle(key: string, photoId: string) {
    setPickerAngle(null);
    if (key === "hero") {
      const p = photoById(photoId);
      if (p) await handleSetCover(p);
      return;
    }
    const next = { ...customFields, [angleKey(key)]: photoId };
    setCustomFields(next);
    if (!user) return;
    try {
      await vehicleService.update(vehicle.id, { customFields: next }, user.id);
      toast.success("Angle updated");
    } catch {
      toast.error("Couldn't set angle");
    }
  }

  async function clearAngle(key: string) {
    if (key === "hero") {
      await persistCover(null);
      return;
    }
    const next = { ...customFields, [angleKey(key)]: null };
    setCustomFields(next);
    if (!user) return;
    try {
      await vehicleService.update(vehicle.id, { customFields: next }, user.id);
    } catch {
      toast.error("Couldn't clear angle");
    }
  }

  /** Resolve the photo assigned to an angle (hero = cover). */
  function anglePhoto(key: string): VehiclePhoto | undefined {
    if (key === "hero") return (photos ?? []).find((p) => p.url === coverUrl);
    const id = customFields[angleKey(key)];
    return typeof id === "string" ? photoById(id) : undefined;
  }

  function toggleSel(id: string) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /** Move the dragged photo so it sits before `targetId`, then persist order. */
  async function reorderTo(targetId: string) {
    const from = dragId;
    setDragId(null);
    setOverId(null);
    if (!from || from === targetId || !photos) return;
    const next = [...photos];
    const fromIdx = next.findIndex((p) => p.id === from);
    const toIdx = next.findIndex((p) => p.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const prev = photos;
    setPhotos(next);
    try {
      await vehiclePhotoService.reorder(next.map((p) => p.id));
    } catch {
      setPhotos(prev);
      toast.error("Couldn't reorder photos");
    }
  }

  const count = photos?.length ?? 0;
  const hasSel = sel.size > 0;

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Gallery + select toolbar */}
      <Panel
        title={`Photos${count ? ` · ${count}` : ""}`}
        subtitle="Upload real photos of this vehicle — stored securely and ready for the listing."
        action={
          <Button
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1 h-3.5 w-3.5" />
            )}
            Upload
          </Button>
        }
        flush
      >
        {/* Select toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-y bg-muted/30 px-4 py-2 text-sm">
          {hasSel ? (
            <>
              <span className="font-medium">{sel.size} selected</span>
              {sel.size === 1 && (
                <button
                  className="ml-2 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    const p = photoById([...sel][0]);
                    if (p) void handleSetCover(p);
                    setSel(new Set());
                  }}
                >
                  <Star className="size-3.5" /> Set as cover
                </button>
              )}
              <button
                className="inline-flex items-center gap-1 text-destructive hover:opacity-80"
                onClick={() => void removeMany([...sel])}
              >
                <Trash2 className="size-3.5" /> Delete
              </button>
              <button
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSel(new Set())}
              >
                Clear
              </button>
            </>
          ) : (
            <>
              <button
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={count === 0}
                onClick={() => setSel(new Set((photos ?? []).map((p) => p.id)))}
              >
                <Check className="size-3.5" /> Select all
              </button>
              <span className="text-muted-foreground">
                · hover to tick / set cover / delete · drag to reorder
              </span>
            </>
          )}
        </div>

        {/* Grid / dropzone — external file drops upload; internal tile drags reorder */}
        <div
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            if (!e.dataTransfer.files.length) return;
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          className={cn("p-4", dragging && "rounded-md ring-2 ring-primary ring-offset-2")}
        >
          {photos === null ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/3] w-full rounded-md" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-sm text-muted-foreground transition hover:bg-muted/40"
            >
              <ImagePlus className="h-6 w-6" />
              <span>
                Drag photos here or{" "}
                <span className="font-medium text-foreground">click to upload</span>
              </span>
              <span className="text-xs">JPG, PNG or WebP · up to 15 MB each</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
              {photos.map((p) => {
                const isCover = p.url === coverUrl;
                const isSel = sel.has(p.id);
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(p.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", p.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    onDragOver={(e) => {
                      if (!dragId || dragId === p.id) return;
                      e.preventDefault();
                      setOverId(p.id);
                    }}
                    onDrop={(e) => {
                      if (!dragId) return;
                      e.preventDefault();
                      e.stopPropagation();
                      void reorderTo(p.id);
                    }}
                    className={cn(
                      "group relative aspect-[4/3] cursor-grab overflow-hidden rounded-lg border bg-muted active:cursor-grabbing",
                      isSel && "ring-2 ring-primary ring-offset-1",
                      dragId === p.id && "opacity-40",
                      overId === p.id && "ring-2 ring-primary",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`${vehicle.make} ${vehicle.model} photo`}
                      className="pointer-events-none h-full w-full object-cover"
                      loading="lazy"
                    />
                    {isCover && (
                      <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-2xs font-medium shadow-sm">
                        <Star className="size-3 fill-amber-400 text-amber-400" /> Cover
                      </span>
                    )}
                    <button
                      onClick={() => toggleSel(p.id)}
                      className={cn(
                        "absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full border bg-background/90 shadow-sm",
                        isCover && "left-auto right-9",
                        isSel
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border opacity-0 group-hover:opacity-100",
                      )}
                      aria-label="Select photo"
                    >
                      {isSel && <Check className="size-3" strokeWidth={3} />}
                    </button>
                    <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      {!isCover && (
                        <button
                          onClick={() => void handleSetCover(p)}
                          title="Set as cover"
                          className="grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
                        >
                          <Star className="size-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => void removeMany([p.id])}
                        title="Delete"
                        className="grid size-7 place-items-center rounded-full bg-background/90 text-destructive shadow-sm hover:bg-background"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {/* Always-visible add/drop tile for bulk upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground transition hover:bg-muted/40"
              >
                <ImagePlus className="size-5" />
                Add photos
              </button>
            </div>
          )}
        </div>
      </Panel>

      {/* Vehicle angles — assign uploaded photos to named slots */}
      <Panel
        title={
          <span className="flex items-center gap-2">
            <Images className="size-4 text-muted-foreground" /> Vehicle angles
          </span>
        }
        subtitle="Tag your uploaded photos by angle for the listing. Choose any uploaded photo for each slot."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ANGLES.map((a) => {
            const p = anglePhoto(a.key);
            return (
              <div key={a.key} className="flex flex-col gap-2">
                <div className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
                  {p ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.url}
                        alt={a.label}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          onClick={() => setPickerAngle(a.key)}
                          title="Change"
                          className="grid size-7 place-items-center rounded-full bg-background/90 shadow-sm hover:bg-background"
                        >
                          <Images className="size-3.5" />
                        </button>
                        <button
                          onClick={() => void clearAngle(a.key)}
                          title="Clear"
                          className="grid size-7 place-items-center rounded-full bg-background/90 text-destructive shadow-sm hover:bg-background"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={() => setPickerAngle(a.key)}
                      disabled={count === 0}
                      className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition hover:bg-muted/60 disabled:opacity-50"
                    >
                      <Plus className="size-4" />
                      {count === 0 ? "Upload first" : "Choose photo"}
                    </button>
                  )}
                </div>
                <span className="text-xs font-medium">{a.label}</span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Angle photo picker */}
      <Dialog
        open={pickerAngle !== null}
        onOpenChange={(o) => !o && setPickerAngle(null)}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Choose {ANGLES.find((a) => a.key === pickerAngle)?.label ?? "angle"} photo
            </DialogTitle>
            <DialogDescription>
              Pick an uploaded photo to use for this angle.
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            {count === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No photos uploaded yet.
              </div>
            ) : (
              <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
                {(photos ?? []).map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      pickerAngle && void assignAngle(pickerAngle, p.id)
                    }
                    className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted hover:ring-2 hover:ring-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </DialogPanel>
        </DialogContent>
      </Dialog>
    </div>
  );
}
