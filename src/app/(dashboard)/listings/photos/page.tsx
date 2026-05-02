"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Image as ImageIcon, Loader2, Sparkles, Wand2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import {
  backdropPrompt,
  carPhotoPrompt,
  photoService,
  type PhotoSize,
} from "@/lib/services/photo-service";
import type { Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RegPlate } from "@/components/shared/reg-plate";
import { EmptyState } from "@/components/shared/empty-state";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

const SIZES: { value: PhotoSize; label: string }[] = [
  { value: "1024x1024", label: "Square (1024×1024)" },
  { value: "1536x1024", label: "Landscape (1536×1024)" },
  { value: "1024x1536", label: "Portrait (1024×1536)" },
];

export default function PhotoProcessingPage() {
  const { company } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bgRemoved, setBgRemoved] = useState(false);
  const [bg, setBg] = useState("white");

  // Generation state
  const [mode, setMode] = useState<"car" | "backdrop">("car");
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<PhotoSize>("1536x1024");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<{
    dataUrl: string;
    label: string;
  } | null>(null);

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

  // Auto-fill prompt when mode / vehicle / backdrop changes
  useEffect(() => {
    if (mode === "car" && vehicle) {
      setPrompt(
        carPhotoPrompt({
          year: vehicle.year,
          make: vehicle.make,
          model: vehicle.model,
          colour: vehicle.colour,
          variant: vehicle.variantCode,
          backdrop: swatch.hint,
        }),
      );
    } else if (mode === "backdrop") {
      setPrompt(backdropPrompt(swatch.label, swatch.hint));
    }
  }, [mode, vehicle, swatch]);

  function handleProcess() {
    setBgRemoved(true);
    toast.success("Background removed (mock)");
  }

  async function handleGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error("Prompt required");
      return;
    }
    setGenerating(true);
    setGenerated(null);
    try {
      const { dataUrl } = await photoService.generate({
        prompt: trimmed,
        size,
      });
      setGenerated({
        dataUrl,
        label:
          mode === "car"
            ? vehicle
              ? `${vehicle.make} ${vehicle.model} (${vehicle.registration})`
              : "Car"
            : swatch.label,
      });
      toast.success("Image generated");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Image generation failed.",
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Photo Processing
        </h1>
        <p className="text-sm text-muted-foreground">
          Mock background-removal toggle, 10 backdrop swatches, and AI image
          generation (cars + backdrops) via OpenAI <code>gpt-image-1</code>.
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
                  setGenerated(null);
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

                <Tabs defaultValue="manage">
                  <TabsList>
                    <TabsTrigger value="manage">Manage</TabsTrigger>
                    <TabsTrigger value="generate">
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Generate (AI)
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="manage" className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="relative overflow-hidden rounded-md border">
                        <VehicleImage
                          vehicle={vehicle}
                          variant="card"
                          className="h-44 rounded-none"
                        />
                        <div className="flex items-center justify-between border-t bg-background px-2 py-1.5 text-xs">
                          <span className="font-medium">Original</span>
                          <Badge variant="secondary" className="text-[10px]">
                            AI hero
                          </Badge>
                        </div>
                      </div>
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
                              className={cn("h-12 w-full rounded", b.swatch)}
                            />
                            <span className="line-clamp-1 text-center">
                              {b.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="generate" className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                      <div>
                        <Label className="text-xs">Mode</Label>
                        <Tabs
                          value={mode}
                          onValueChange={(v) =>
                            setMode(v as "car" | "backdrop")
                          }
                          className="mt-1"
                        >
                          <TabsList>
                            <TabsTrigger value="car">Car concept</TabsTrigger>
                            <TabsTrigger value="backdrop">Backdrop</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      <div>
                        <Label className="text-xs">Size</Label>
                        <Select
                          value={size}
                          onValueChange={(v) => setSize(v as PhotoSize)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SIZES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Prompt</Label>
                      <Textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="mt-1 min-h-32 font-mono text-xs"
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Auto-built from the selected vehicle + backdrop. Edit freely.
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-muted-foreground">
                        Calls /api/photo/generate → OpenAI <code>gpt-image-1</code>.
                      </p>
                      <Button
                        size="sm"
                        onClick={handleGenerate}
                        disabled={generating || !prompt.trim()}
                      >
                        {generating ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1.5 h-4 w-4" />
                        )}
                        Generate
                      </Button>
                    </div>

                    {generating && (
                      <Skeleton className="h-72 w-full" />
                    )}
                    {generated && !generating && (
                      <div className="overflow-hidden rounded-md border">
                        <img
                          src={generated.dataUrl}
                          alt={generated.label}
                          className="block w-full object-contain bg-zinc-50"
                        />
                        <div className="flex items-center justify-between border-t bg-background px-3 py-2 text-xs">
                          <span className="font-medium">
                            {generated.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              {mode === "car" ? "Car concept" : "Backdrop"}
                            </Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="h-7 text-[11px]"
                            >
                              <a
                                href={generated.dataUrl}
                                download={`${mode}-${Date.now()}.png`}
                              >
                                Download
                              </a>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
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
      <div className={cn("flex h-44 w-full items-center justify-center", tone)}>
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
