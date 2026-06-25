"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  CalendarClock,
  Check,
  Megaphone,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { listingService } from "@/lib/services/listing-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import {
  performanceService,
  type VehicleEnquiry,
} from "@/lib/services/performance-service";
import type {
  Listing,
  ListingStatus,
  Vehicle,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { DaysInStockChip } from "@/components/shared/days-in-stock-chip";
import { RegPlate } from "@/components/shared/reg-plate";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { AtIndicatorCell } from "@/components/data-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";

const CHANNELS = ["website", "autotrader", "ebay", "facebook"] as const;
type Channel = (typeof CHANNELS)[number];

const CHANNEL_LABELS: Record<Channel, string> = {
  website: "Website",
  autotrader: "AutoTrader",
  ebay: "eBay",
  facebook: "Facebook",
};

// Listing-status tone pills — mirrors the status colours used across the app
// so a draft/live/reserved/sold/archived advert reads the same here as in the
// Master Sheet. (No context lost from the original Status column.)
const LISTING_STATUS_META: Record<
  ListingStatus,
  { label: string; cls: string; dot: string }
> = {
  draft: {
    label: "Draft",
    cls: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  live: {
    label: "Live",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  reserved: {
    label: "Reserved",
    cls: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
    dot: "bg-pink-500",
  },
  sold: {
    label: "Sold",
    cls: "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    dot: "bg-gray-400",
  },
  archived: {
    label: "Archived",
    cls: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
};

function ListingStatusPill({ status }: { status: ListingStatus }) {
  const m = LISTING_STATUS_META[status] ?? LISTING_STATUS_META.draft;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        m.cls,
      )}
    >
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

function PreviewStat({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-1.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-base font-semibold">{children}</div>
    </div>
  );
}

interface ListingRow extends Listing {
  vehicle: Vehicle | null;
}

const schema = z.object({
  vehicleId: z.string().min(1, "Pick a vehicle"),
  title: z.string().min(1),
  description: z.string().min(1),
  price: z.coerce.number().min(0),
  specialFeatures: z.string(),
  atPriceIndicator: z.enum([
    "great",
    "good",
    "above_average",
    "high",
    "unrated",
  ]),
  website: z.boolean(),
  autotrader: z.boolean(),
  ebay: z.boolean(),
  facebook: z.boolean(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export default function ListingsPage() {
  const { user, company } = useAuth();
  const router = useRouter();
  const { can, isSuperUser } = usePermissions();
  const canPublishAT = isSuperUser || can("listing:publish_autotrader");
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  // Live enquiry counts derived from leads — the same single source of truth
  // the Performance page uses, so the two pages never disagree. The
  // denormalised `listings.enquiries_count` column is never incremented.
  const [enquiriesByVehicle, setEnquiriesByVehicle] = useState<
    Record<string, VehicleEnquiry>
  >({});
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  // Master-detail selection — the listing shown in the right-hand preview.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // AutoTrader publish confirm — set to the row pending live publish.
  const [atConfirm, setAtConfirm] = useState<ListingRow | null>(null);
  const [atBusy, setAtBusy] = useState(false);
  // Delete confirm — set to the listing pending deletion.
  const [deleteTarget, setDeleteTarget] = useState<ListingRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleId: "",
      title: "",
      description: "",
      price: 0,
      specialFeatures: "Bluetooth, Cruise Control, Parking Sensors, Alloy Wheels",
      atPriceIndicator: "unrated",
      website: true,
      autotrader: false,
      ebay: false,
      facebook: false,
    },
  });

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      listingService.getAll(company.id),
      vehicleService.getAll(company.id),
      performanceService.getStats(company.id),
    ]).then(([l, v, stats]) => {
      setListings(l);
      setVehicles(v);
      setEnquiriesByVehicle(stats.byVehicle);
    });
  }, [company]);

  const readyVehicles = useMemo(
    () =>
      // Gate creation until listings have loaded: while `listings` is null we
      // can't tell which vehicles already have an advert, so offering any here
      // risks creating a duplicate listing.
      listings === null
        ? []
        : vehicles.filter(
            (v) =>
              (v.status === "ready" || v.status === "listed") &&
              !listings.some((l) => l.vehicleId === v.id),
          ),
    [vehicles, listings],
  );

  const filtered = useMemo<ListingRow[] | null>(() => {
    if (!listings) return null;
    let out = [...listings];
    if (statusFilter !== "all") out = out.filter((l) => l.status === statusFilter);
    if (channelFilter !== "all")
      out = out.filter((l) => l.channels[channelFilter]);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((l) => {
        const v = vehicles.find((x) => x.id === l.vehicleId);
        return (
          l.title.toLowerCase().includes(q) ||
          (v &&
            (v.registration.toLowerCase().includes(q) ||
              v.stockId.toLowerCase().includes(q)))
        );
      });
    }
    // v4.1 Gap 1 / TC-P6-003: hide listings whose vehicle has been removed
    // from website. Sold vehicles still show until that step is taken.
    out = out.filter((l) => {
      const v = vehicles.find((x) => x.id === l.vehicleId);
      return !v || v.removedFromWebsiteAt === null;
    });
    return out.map((l) => ({
      ...l,
      vehicle: vehicles.find((v) => v.id === l.vehicleId) ?? null,
    }));
  }, [listings, statusFilter, channelFilter, search, vehicles]);

  // Keep the selection valid as filters/data change: fall back to the first
  // row when the selected listing drops out of the filtered set.
  useEffect(() => {
    if (!filtered) return;
    if (filtered.length === 0) {
      if (selectedId !== null) setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((l) => l.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = useMemo<ListingRow | null>(
    () => filtered?.find((l) => l.id === selectedId) ?? null,
    [filtered, selectedId],
  );

  const watchedVehicle = form.watch("vehicleId");
  const selectedVehicle = useMemo(
    () => vehicles.find((x) => x.id === watchedVehicle) ?? null,
    [vehicles, watchedVehicle],
  );
  useEffect(() => {
    const v = vehicles.find((x) => x.id === watchedVehicle);
    if (!v) return;
    form.setValue(
      "title",
      `${v.year} ${v.make} ${v.model} ${v.variantCode ?? ""}`.trim(),
    );
    form.setValue(
      "description",
      `Stunning ${v.colour.toLowerCase()} ${v.make} ${v.model} with ${v.mileage.toLocaleString()} miles. ${v.serviceHistory === "full" ? "Full service history. " : ""}Drives superb.`,
    );
    if (v.listingPrice) form.setValue("price", v.listingPrice);
    // Seed the AutoTrader price indicator from the captured valuation.
    if (v.atRetailValuation && v.listingPrice) {
      const ratio = v.listingPrice / v.atRetailValuation;
      // Clearly over-retail cars get the "high" (overpriced) bucket — never
      // silently "unrated", which hid overpriced cars before.
      form.setValue(
        "atPriceIndicator",
        ratio <= 0.96
          ? "great"
          : ratio <= 1.0
            ? "good"
            : ratio <= 1.05
              ? "above_average"
              : "high",
      );
    }
  }, [watchedVehicle, vehicles, form]);

  async function onSubmit(values: FormOutput) {
    if (!user || !company) return;
    const v = vehicles.find((x) => x.id === values.vehicleId);
    if (!v) return;
    await listingService.create(
      {
        companyId: company.id,
        vehicleId: values.vehicleId,
        title: values.title,
        description: values.description,
        price: values.price,
        specialFeatures: values.specialFeatures,
        channels: {
          website: values.website,
          autotrader: values.autotrader,
          ebay: values.ebay,
          facebook: values.facebook,
        },
        atPriceIndicator: values.atPriceIndicator,
      },
      user.id,
    );
    const fresh = await listingService.getAll(company.id);
    setListings(fresh);
    toast.success("Listing created (draft)");
    setOpen(false);
    form.reset();
  }

  async function handlePublish(id: string) {
    if (!user || !company) return;
    await listingService.publish(id, user.id);
    setListings(await listingService.getAll(company.id));
    toast.success("Listing published");
  }

  async function handleToggleChannel(id: string, ch: Channel) {
    if (!company) return;
    await listingService.toggleChannel(id, ch);
    setListings(await listingService.getAll(company.id));
  }

  async function confirmPublishAutoTrader() {
    if (!atConfirm || !company) return;
    setAtBusy(true);
    try {
      const res = await fetch("/api/autotrader/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: atConfirm.vehicleId,
          listingId: atConfirm.id,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        stockId?: string;
        warnings?: string[];
        error?: string;
        detail?: string;
      };
      if (res.ok && body.stockId) {
        toast.success(`Published to AutoTrader — Stock ID ${body.stockId}`);
        if (body.warnings?.length) {
          for (const w of body.warnings) toast.warning(w);
        }
      } else {
        toast.error(
          body.detail
            ? `AutoTrader publish failed: ${body.detail}`
            : `AutoTrader publish failed (${body.error ?? res.status})`,
        );
      }
      setListings(await listingService.getAll(company.id));
    } catch (e) {
      toast.error(`AutoTrader publish failed: ${String(e)}`);
    } finally {
      setAtBusy(false);
      setAtConfirm(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !user || !company) return;
    setDeleteBusy(true);
    try {
      await listingService.delete(deleteTarget.id, user.id);
      setListings(await listingService.getAll(company.id));
      if (selectedId === deleteTarget.id) setSelectedId(null);
      toast.success("Listing deleted");
    } catch (e) {
      toast.error(`Couldn't delete listing: ${String(e)}`);
    } finally {
      setDeleteBusy(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work List</h1>
          <p className="text-sm text-muted-foreground">
            Vehicles ready to advertise. Build each advert, set pricing, and
            publish it to your sales channels.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Create Listing
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <form onSubmit={form.handleSubmit(onSubmit)} className="contents">
              <DialogHeader>
                <DialogTitle>Create Listing</DialogTitle>
                <DialogDescription>
                  Build the advert and choose where it publishes. Saved as a
                  draft.
                </DialogDescription>
              </DialogHeader>
              <DialogPanel className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label>Vehicle</Label>
                  <Select
                    items={Object.fromEntries(
                      readyVehicles.map((v) => [
                        v.id,
                        `${v.registration} — ${v.make} ${v.model}`,
                      ]),
                    )}
                    value={form.watch("vehicleId")}
                    onValueChange={(v) => form.setValue("vehicleId", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a ready / listed vehicle" />
                    </SelectTrigger>
                    <SelectContent>
                      {readyVehicles.length === 0 ? (
                        <SelectItem value="__none" disabled>
                          No vehicles available
                        </SelectItem>
                      ) : (
                        readyVehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.registration} — {v.make} {v.model}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Title</Label>
                  <Input {...form.register("title")} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Description</Label>
                  <Textarea
                    {...form.register("description")}
                    className="min-h-24"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      {...form.register("price")}
                    />
                    {selectedVehicle?.atRetailValuation != null && (
                      <button
                        type="button"
                        onClick={() =>
                          form.setValue(
                            "price",
                            selectedVehicle.atRetailValuation as number,
                          )
                        }
                        className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        AutoTrader retail: £
                        {selectedVehicle.atRetailValuation.toLocaleString()} —
                        use
                      </button>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <Label>AT indicator</Label>
                    <Select
                      value={form.watch("atPriceIndicator")}
                      onValueChange={(v) =>
                        form.setValue(
                          "atPriceIndicator",
                          v as Listing["atPriceIndicator"],
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="great">Great</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="above_average">Above Avg</SelectItem>
                        <SelectItem value="high">Overpriced / High</SelectItem>
                        <SelectItem value="unrated">Unrated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Special features</Label>
                  <Input {...form.register("specialFeatures")} />
                </div>
                <div className="grid gap-2">
                  <Label>Publish channels</Label>
                  <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                    {CHANNELS.map((c) => (
                      <label
                        key={c}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Switch
                          checked={form.watch(c)}
                          onCheckedChange={(v) => form.setValue(c, v)}
                        />
                        {CHANNEL_LABELS[c]}
                      </label>
                    ))}
                  </div>
                </div>
              </DialogPanel>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Save Draft</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Master-detail: searchable listing list (left) + advert preview (right) */}
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        {/* LEFT — reg search, filters, and the scrollable listing list */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by reg, stock or title…"
                aria-label="Search listings by registration, stock ID or title"
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) =>
                  setStatusFilter(v as ListingStatus | "all")
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={channelFilter}
                onValueChange={(v) => setChannelFilter(v as Channel | "all")}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CHANNEL_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!filtered ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[78px] rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No listings yet"
              description="Mark a vehicle as ready, then create a listing."
            />
          ) : (
            <div
              role="listbox"
              aria-label="Listings"
              className="flex max-h-[calc(100dvh-15rem)] flex-col gap-1.5 overflow-y-auto pr-1"
            >
              {filtered.map((l) => {
                const isActive = l.id === selectedId;
                return (
                  <button
                    key={l.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => setSelectedId(l.id)}
                    className={cn(
                      "flex w-full shrink-0 gap-3 rounded-lg border p-3 text-left transition-colors",
                      isActive
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    {l.vehicle ? (
                      <VehicleImage
                        vehicle={l.vehicle}
                        variant="thumb"
                        className="h-14 w-[72px] shrink-0 self-center rounded-md"
                      />
                    ) : (
                      <span className="grid h-14 w-[72px] shrink-0 self-center place-items-center rounded-md bg-muted text-muted-foreground/50">
                        <Car className="size-5" />
                      </span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      {/* Meta row — stock ID + status */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-mono text-2xs text-muted-foreground">
                          {l.vehicle?.stockId ?? "—"}
                        </span>
                        <ListingStatusPill status={l.status} />
                      </div>
                      {/* Title */}
                      <span className="mt-0.5 truncate text-sm font-medium">
                        {l.title}
                      </span>
                      {/* Price + enquiries · days */}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          {formatCurrency(l.price)}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-2xs text-muted-foreground">
                          <MessageSquare className="size-3" />
                          {enquiriesByVehicle[l.vehicleId]?.total ?? 0}
                          {l.vehicle ? ` · ${l.vehicle.daysInStock}d` : ""}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT — full advert preview for the selected listing */}
        <div className="lg:sticky lg:top-4">
          {!filtered ? (
            <Skeleton className="h-[460px] rounded-xl" />
          ) : !selected ? (
            <div className="flex h-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card text-center text-muted-foreground">
              <Megaphone className="size-6" />
              <p className="text-sm">Select a listing to preview its advert.</p>
            </div>
          ) : (
            (() => {
              const channelsOn = CHANNELS.filter(
                (c) => selected.channels[c],
              ).length;
              const canPushAT =
                selected.channels.autotrader &&
                canPublishAT &&
                !selected.atStockId;
              return (
                <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm">
                  {/* Header — plate, stock, status, title, price, AT indicator */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {selected.vehicle ? (
                          <RegPlate
                            registration={selected.vehicle.registration}
                            size="sm"
                          />
                        ) : null}
                        <span className="font-mono text-xs text-muted-foreground">
                          {selected.vehicle?.stockId ?? "—"}
                        </span>
                        <ListingStatusPill status={selected.status} />
                      </div>
                      <h2 className="mt-1.5 text-lg font-semibold leading-snug">
                        {selected.title}
                      </h2>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold tabular-nums">
                        {formatCurrency(selected.price)}
                      </div>
                      <div className="mt-1 flex justify-end">
                        <AtIndicatorCell
                          indicator={selected.atPriceIndicator}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stats — days in stock, enquiries, channel coverage */}
                  <div className="grid grid-cols-3 gap-3">
                    <PreviewStat icon={CalendarClock} label="Days in stock">
                      {selected.vehicle ? (
                        <DaysInStockChip days={selected.vehicle.daysInStock} />
                      ) : (
                        "—"
                      )}
                    </PreviewStat>
                    <PreviewStat icon={MessageSquare} label="Enquiries">
                      <span className="tabular-nums">
                        {enquiriesByVehicle[selected.vehicleId]?.total ?? 0}
                      </span>
                    </PreviewStat>
                    <PreviewStat icon={Megaphone} label="Channels">
                      <span className="tabular-nums">{channelsOn}/4</span>
                    </PreviewStat>
                  </div>

                  {/* Publish channels — wired to the live toggle service */}
                  <div>
                    <div className="mb-2 text-xs font-medium text-muted-foreground">
                      Publish channels
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {CHANNELS.map((c) => {
                        const on = selected.channels[c];
                        return (
                          <div
                            key={c}
                            className={cn(
                              "flex items-center justify-between rounded-lg border px-3 py-2.5",
                              on
                                ? "border-primary/30 bg-primary/5"
                                : "bg-muted/20",
                            )}
                          >
                            <span className="text-sm font-medium">
                              {CHANNEL_LABELS[c]}
                            </span>
                            <div className="flex items-center gap-2">
                              {c === "autotrader" && selected.atStockId ? (
                                <span className="inline-flex items-center gap-1 text-2xs font-medium text-emerald-600 dark:text-emerald-400">
                                  <Check className="size-3" /> Synced
                                </span>
                              ) : null}
                              <Switch
                                checked={on}
                                onCheckedChange={() =>
                                  void handleToggleChannel(selected.id, c)
                                }
                                aria-label={`${CHANNEL_LABELS[c]} ${on ? "on" : "off"}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* AutoTrader sync state — preserves Synced #id / Error */}
                  {selected.atStockId ? (
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <Check className="size-3.5" />
                      Synced to AutoTrader · Stock ID{" "}
                      {selected.atStockId.slice(0, 8)}
                    </div>
                  ) : selected.atLastError ? (
                    <div
                      className="inline-flex items-start gap-1.5 rounded-md bg-rose-100 px-2.5 py-1.5 text-xs font-medium text-rose-800 dark:bg-rose-500/15 dark:text-rose-300"
                      title={selected.atLastError}
                    >
                      <TriangleAlert className="mt-px size-3.5 shrink-0" />
                      <span className="line-clamp-2">
                        AutoTrader error: {selected.atLastError}
                      </span>
                    </div>
                  ) : null}

                  {/* Actions — delete, edit, publish (draft→live), push to AT */}
                  <div className="mt-1 flex flex-wrap items-center gap-2 border-t pt-4">
                    <Button
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(selected)}
                    >
                      <Trash2 className="mr-1.5 size-4" />
                      Delete
                    </Button>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          selected.vehicleId &&
                          router.push(`/vehicles/${selected.vehicleId}/advert`)
                        }
                      >
                        <Pencil className="mr-1.5 size-4" />
                        Edit advert
                      </Button>
                      {selected.status === "draft" ? (
                        <Button onClick={() => void handlePublish(selected.id)}>
                          <Send className="mr-1.5 size-4" />
                          Publish
                        </Button>
                      ) : null}
                      {canPushAT ? (
                        <Button onClick={() => setAtConfirm(selected)}>
                          <Send className="mr-1.5 size-4" />
                          Push to AutoTrader
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      {/* AutoTrader publish confirm — gated live write to the sandbox. */}
      <Dialog
        open={atConfirm !== null}
        onOpenChange={(o) => {
          if (!o && !atBusy) setAtConfirm(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish to AutoTrader (sandbox)</DialogTitle>
          </DialogHeader>
          <DialogPanel className="space-y-3 text-sm">
            <p>
              This creates a <strong>real advert</strong> on your AutoTrader
              Connect <strong>sandbox</strong> account for{" "}
              <strong>
                {atConfirm?.vehicle?.registration ?? atConfirm?.title}
              </strong>
              .
            </p>
            <p className="text-muted-foreground">
              The advert is created with all advertising locations{" "}
              <strong>NOT_PUBLISHED</strong> (it won&apos;t go live on the
              AutoTrader marketplace until a separate go-live step). The
              returned Stock ID is stored against this listing.
            </p>
            {atConfirm &&
            (atConfirm.vehicle?.imagesCount === 0 ||
              !atConfirm.vehicle?.heroImageUrl) ? (
              <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Note: this advert will be created without images (photo upload
                pending).
              </p>
            ) : null}
          </DialogPanel>
          <DialogFooter variant="bare">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAtConfirm(null)}
              disabled={atBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmPublishAutoTrader()}
              disabled={atBusy}
            >
              {atBusy ? "Publishing…" : "Publish to AutoTrader"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete listing confirm — removes the advert, keeps the vehicle. */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o && !deleteBusy) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this listing?</DialogTitle>
          </DialogHeader>
          <DialogPanel className="space-y-3 text-sm">
            <p>
              This permanently deletes the advert for{" "}
              <strong>
                {deleteTarget?.vehicle?.registration ?? deleteTarget?.title}
              </strong>
              {deleteTarget?.status === "live" ? " and takes it offline" : ""}.
              The vehicle and its photos are kept — it returns to the Work List
              as ready to advertise.
            </p>
            {deleteTarget?.atStockId ? (
              <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                Note: this listing is synced to AutoTrader (Stock ID{" "}
                {deleteTarget.atStockId.slice(0, 8)}). Deleting here removes the
                local advert only — remove it on AutoTrader separately.
              </p>
            ) : null}
          </DialogPanel>
          <DialogFooter variant="bare">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deleteBusy}
            >
              {deleteBusy ? "Deleting…" : "Delete listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
