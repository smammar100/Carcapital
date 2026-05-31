"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Megaphone, Plus, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { listingService } from "@/lib/services/listing-service";
import { vehicleService } from "@/lib/services/vehicle-service";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { DaysInStockChip } from "@/components/shared/days-in-stock-chip";
import {
  type ColumnDef,
  ChannelsCell,
  DataGridColumnsButton,
  DataGridDensityToggle,
  DataGridHeaderRow,
  DataGridRow,
  DataGridSearchBar,
  DataGridShell,
  DataGridSkeletonRows,
  DataGridTable,
  VehicleCell,
  useColumnVisibility,
  useDensity,
} from "@/components/data-grid";
import { toast } from "sonner";

const CHANNELS = ["website", "autotrader", "ebay", "facebook"] as const;
type Channel = (typeof CHANNELS)[number];

interface ListingRow extends Listing {
  vehicle: Vehicle | null;
}

const schema = z.object({
  vehicleId: z.string().min(1, "Pick a vehicle"),
  title: z.string().min(1),
  description: z.string().min(1),
  price: z.coerce.number().min(0),
  specialFeatures: z.string(),
  atPriceIndicator: z.enum(["great", "good", "above_average", "unrated"]),
  website: z.boolean(),
  autotrader: z.boolean(),
  ebay: z.boolean(),
  facebook: z.boolean(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export default function ListingsPage() {
  const { user, company } = useAuth();
  const { can, isSuperUser } = usePermissions();
  const canPublishAT = isSuperUser || can("listing:publish_autotrader");
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [statusFilter, setStatusFilter] = useState<ListingStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  // AutoTrader publish confirm — set to the row pending live publish.
  const [atConfirm, setAtConfirm] = useState<ListingRow | null>(null);
  const [atBusy, setAtBusy] = useState(false);

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
    ]).then(([l, v]) => {
      setListings(l);
      setVehicles(v);
    });
  }, [company]);

  const readyVehicles = useMemo(
    () =>
      vehicles.filter(
        (v) =>
          (v.status === "ready" || v.status === "listed") &&
          !listings?.some((l) => l.vehicleId === v.id),
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

  const cols = useMemo<ColumnDef<ListingRow>[]>(
    () => [
      {
        key: "stockId",
        label: "Stock ID",
        type: "text",
        sticky: true,
        width: 100,
        render: (l) => (
          <span className="font-mono text-xs font-medium">
            {l.vehicle?.stockId ?? "—"}
          </span>
        ),
      },
      {
        key: "vehicle",
        label: "Vehicle",
        type: "vehicle",
        width: 200,
        render: (l) => <VehicleCell vehicle={l.vehicle} />,
      },
      { key: "title", label: "Title", type: "text", width: 240 },
      { key: "price", label: "Web price", type: "currency", width: 120 },
      {
        key: "atPriceIndicator",
        label: "AT",
        type: "atIndicator",
        width: 130,
      },
      {
        key: "channels",
        label: "Channels",
        type: "channels",
        width: 200,
        render: (l) => (
          <ChannelsCell
            channels={l.channels as unknown as Record<string, boolean>}
            onToggle={(c) => void handleToggleChannel(l.id, c as Channel)}
          />
        ),
      },
      {
        key: "daysListed",
        label: "Days",
        type: "custom",
        width: 80,
        render: (l) =>
          l.vehicle ? <DaysInStockChip days={l.vehicle.daysInStock} /> : null,
      },
      { key: "enquiriesCount", label: "Enq.", type: "number", width: 80 },
      { key: "status", label: "Status", type: "select", width: 110 },
      {
        key: "atSync",
        label: "AutoTrader",
        type: "custom",
        width: 140,
        render: (l) =>
          l.atStockId ? (
            <span className="inline-flex items-center rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
              Synced #{l.atStockId.slice(0, 8)}
            </span>
          ) : l.atLastError ? (
            <span
              className="inline-flex items-center rounded-md bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-800"
              title={l.atLastError}
            >
              Error
            </span>
          ) : l.channels.autotrader && canPublishAT ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                setAtConfirm(l);
              }}
            >
              <Send className="mr-1 size-3" />
              Publish to AT
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
      },
      {
        key: "action",
        label: " ",
        type: "custom",
        width: 100,
        align: "right",
        render: (l) =>
          l.status === "draft" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                void handlePublish(l.id);
              }}
            >
              Publish
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Live</span>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canPublishAT],
  );

  const { density, setDensity } = useDensity();
  const { hiddenKeys, setHiddenKeys, visibleCols } = useColumnVisibility(cols);
  const lockedKeys = useMemo(() => new Set(["stockId"]), []);

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
      form.setValue(
        "atPriceIndicator",
        ratio <= 0.96 ? "great" : ratio <= 1.0 ? "good" : ratio <= 1.05 ? "above_average" : "unrated",
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work List</h1>
          <p className="text-sm text-muted-foreground">
            {filtered ? `${filtered.length} listings` : "Loading…"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Create Listing
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Listing</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
              <div>
                <Label>Vehicle</Label>
                <Select
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
              <div>
                <Label>Title</Label>
                <Input {...form.register("title")} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  {...form.register("description")}
                  className="min-h-24"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
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
                      className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      AutoTrader retail: £
                      {selectedVehicle.atRetailValuation.toLocaleString()} — use
                    </button>
                  )}
                </div>
                <div>
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
                      <SelectItem value="unrated">Unrated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Special features</Label>
                <Input {...form.register("specialFeatures")} />
              </div>
              <div className="grid gap-2">
                <Label>Publish channels</Label>
                <div className="flex flex-wrap gap-3">
                  {CHANNELS.map((c) => (
                    <label
                      key={c}
                      className="flex items-center gap-2 text-sm capitalize"
                    >
                      <Switch
                        checked={form.watch(c)}
                        onCheckedChange={(v) => form.setValue(c, v)}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
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

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
        <DataGridSearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search title, reg, stock…"
          className="w-full max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ListingStatus | "all")}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
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
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {CHANNELS.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <DataGridColumnsButton
            columns={cols}
            hiddenKeys={hiddenKeys}
            onChange={setHiddenKeys}
            lockedKeys={lockedKeys}
          />
          <DataGridDensityToggle density={density} onChange={setDensity} />
        </div>
      </div>

      {!filtered ? (
        // Row-aware skeleton matching the table's column structure.
        <DataGridShell>
          <DataGridTable cols={visibleCols} density={density}>
            <DataGridHeaderRow cols={visibleCols} />
            <tbody>
              <DataGridSkeletonRows columns={visibleCols} rows={6} />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No listings yet"
          description="Mark a vehicle as ready, then create a listing."
        />
      ) : (
        <DataGridShell>
          <DataGridTable cols={visibleCols} density={density}>
            <DataGridHeaderRow cols={visibleCols} />
            <tbody>
              {filtered.map((l, i) => (
                <DataGridRow key={l.id} row={l} cols={visibleCols} index={i} />
              ))}
            </tbody>
          </DataGridTable>
        </DataGridShell>
      )}

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
          <div className="space-y-3 text-sm">
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
          </div>
          <DialogFooter>
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
    </div>
  );
}
