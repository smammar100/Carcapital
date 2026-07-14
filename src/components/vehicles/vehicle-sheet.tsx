"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Check,
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import { dealerPartnerService } from "@/lib/services/dealer-partner-service";
import type { DealerPartner, Vehicle, VehicleStatus } from "@/lib/types";
import { VEHICLE_STATUSES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/lib/toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";
import { RegPlate } from "@/components/shared/reg-plate";
import { VehicleImage } from "@/components/shared/vehicle-image";
import { PageShell } from "@/components/layout/page-shell";
import { DataGridPagination } from "@/components/data-grid";
import { LocationBadge } from "@/components/locations/location-badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Shared "wide spreadsheet" module — the Master Sheet grid extracted
 * so the Master Sheet and All Vehicles pages render the exact same
 * module (sticky row-counter + Stock ID, full gridlines, bg-muted
 * sticky header, chip-bar filter, inline edit, quick-add, paginated
 * footer). Each page supplies its own column set + filter fields; the
 * structure and styling are identical by construction.
 * ------------------------------------------------------------------ */

export type ColType =
  | "vehicle"
  | "stockId"
  | "text"
  | "number"
  | "currency"
  | "date"
  | "boolean"
  | "select"
  | "status"
  // Module A — physical location with off-site badge (Spec v3.0 · Chunk 2.6)
  | "location"
  // Escape hatch — column supplies its own renderer (and is never editable).
  | "custom";

export interface ColDef {
  key: keyof Vehicle | "profit";
  label: string;
  type: ColType;
  width: number;
  /** Override the raw value used for CSV export / edit seeding. */
  format?: (v: Vehicle) => string;
  /** Custom cell renderer. When present the column is read-only and the
   *  null-dash placeholder is skipped (the renderer owns empty states). */
  render?: (v: Vehicle) => ReactNode;
  sticky?: boolean;
}

/** Unique React key per column. ColDef.key is keyed by data field, so two
 *  columns can share the same data source (e.g. the stockId column shows the
 *  raw value, and the "Vehicle" column also reads from stockId). The label is
 *  always unique, so use it as the React identity. */
export function colKey(c: ColDef): string {
  return `${String(c.key)}__${c.label}`;
}

const PAGE_SIZE = 25;

// Column-resize bounds (GEN-20). Columns never shrink below MIN so a header
// stays clickable, nor grow past MAX so one column can't run off the screen.
const MIN_COL_W = 48;
const MAX_COL_W = 640;
/** localStorage key for a sheet's per-column width overrides. */
const colWidthsKey = (csvName: string): string =>
  `cc.vehicle-sheet.col-widths.${csvName}`;

/* ---- Filtering (Master Sheet "Variation C" filter-chip bar) -------------- */

export type FilterKind = "text" | "num";
export interface FilterField {
  key: keyof Vehicle;
  label: string;
  kind: FilterKind;
}

interface FilterCond {
  id: number;
  key: keyof Vehicle;
  label: string;
  kind: FilterKind;
  op: string;
  value: string;
}

const TEXT_OPS = [
  { v: "is", l: "is" },
  { v: "not", l: "is not" },
  { v: "contains", l: "contains" },
];
const NUM_OPS = [
  { v: "gte", l: "≥" },
  { v: "lte", l: "≤" },
  { v: "eq", l: "=" },
];
function opsFor(kind: FilterKind) {
  return kind === "num" ? NUM_OPS : TEXT_OPS;
}
function opLabel(op: string): string {
  return [...TEXT_OPS, ...NUM_OPS].find((o) => o.v === op)?.l ?? op;
}
function kindOf(fields: FilterField[], key: keyof Vehicle): FilterKind {
  return fields.find((f) => f.key === key)?.kind ?? "text";
}
function matchCond(c: FilterCond, v: Vehicle): boolean {
  const raw = v[c.key];
  if (c.kind === "num") {
    const n = typeof raw === "number" ? raw : Number(raw);
    const fv = Number(c.value);
    // An unparseable filter value can't constrain anything — keep the row.
    if (Number.isNaN(fv)) return true;
    // A null/NaN row value can't satisfy a numeric comparison — exclude it.
    if (raw === null || raw === undefined || Number.isNaN(n)) return false;
    if (c.op === "gte") return n >= fv;
    if (c.op === "lte") return n <= fv;
    return n === fv;
  }
  const s = String(raw ?? "").toLowerCase();
  const fv = c.value.toLowerCase();
  if (c.op === "contains") return s.includes(fv);
  if (c.op === "not") return s !== fv;
  return s === fv;
}

const STATUS_TONE: Record<VehicleStatus, string> = {
  received: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
  inspection_pending:
    "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300",
  being_prepared:
    "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-300",
  photos_pending:
    "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-300",
  photos_ready:
    "bg-lime-50 text-lime-700 dark:bg-lime-950/30 dark:text-lime-300",
  ready: "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300",
  listed:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
  reserved: "bg-pink-50 text-pink-700 dark:bg-pink-950/30 dark:text-pink-300",
  sold: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  returned: "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300",
};

function csvEscape(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rawValue(col: ColDef, v: Vehicle): unknown {
  if (col.format) return col.format(v);
  if (col.key === "daysInStock") {
    // The stored column is unreliable (quick-add inserts 0 and it's never
    // recomputed). For vehicles still in stock, derive it live from the
    // received date; once sold, trust the stored (frozen) value.
    const sold = v.status === "sold";
    if (!sold && v.receivedDate) {
      const received = new Date(v.receivedDate).getTime();
      if (!Number.isNaN(received)) {
        const days = Math.floor((Date.now() - received) / 86_400_000);
        return Math.max(0, days);
      }
    }
    return v.daysInStock;
  }
  if (col.key === "profit") {
    // For sold vehicles the realized selling price is the true top line;
    // unsold vehicles fall back to the asking (listing) price.
    const topLine = v.sellingPrice ?? v.listingPrice;
    return topLine !== null ? Math.round(topLine - v.baseCost) : null;
  }
  return v[col.key as keyof Vehicle];
}

function cellCsv(col: ColDef, v: Vehicle): string {
  const raw = rawValue(col, v);
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "boolean") return raw ? "Y" : "N";
  return String(raw);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-GB").format(n);
}

// Direct, non-computed Vehicle attributes that are safe to inline-edit.
// Deliberately excludes the cost-chain inputs (buyingPrice, fees) and all
// computed/derived totals (totalBuyingPrice, landedCost, baseCost,
// grossEarning, profit, daysInStock) plus stockId / status / the vehicle
// composite — editing those would persist an inconsistent sheet or bypass
// the status-change service. Leaf prices (listing/min/sold) are allowed.
export const DEFAULT_EDITABLE_KEYS = new Set<string>([
  "make",
  "model",
  "variantCode",
  "year",
  "colour",
  "mileage",
  "vehicleType",
  "bodyType",
  "fuelType",
  "transmission",
  "engineSizeCC",
  "receivedDate",
  "sellerName",
  "sellerPhone",
  "purchaseSource",
  "auctionHouse",
  "v5Received",
  "serviceHistory",
  "numKeys",
  "lockNut",
  "motExpiry",
  "minimumSalePrice",
  "listingPrice",
  "sellingPrice",
  "dateSold",
  "sellingAgent",
]);

function isEditableCol(c: ColDef, editableKeys: Set<string>): boolean {
  if (c.render) return false;
  if (c.key === "profit") return false;
  if (c.type === "vehicle" || c.type === "stockId" || c.type === "status")
    return false;
  return editableKeys.has(String(c.key));
}

/** Coerce a raw string editor value into the typed Vehicle field value. */
function coerceCellValue(c: ColDef, draft: string): unknown {
  const t = draft.trim();
  if (c.type === "number" || c.type === "currency") {
    if (t === "") return null;
    const n = Number(t);
    return Number.isNaN(n) ? null : n;
  }
  if (c.type === "date") return t === "" ? null : t;
  return t === "" ? null : t;
}

function CellContent({ col, v }: { col: ColDef; v: Vehicle }) {
  if (col.render) return <>{col.render(v)}</>;

  const raw = rawValue(col, v);

  if (raw === null || raw === undefined || raw === "") {
    return <span className="text-muted-foreground/40">—</span>;
  }

  switch (col.type) {
    case "stockId":
      return (
        <span className="font-mono text-xs font-medium">{v.stockId}</span>
      );
    case "vehicle":
      return (
        <div className="flex items-center gap-2">
          <VehicleImage
            vehicle={v}
            variant="thumb"
            className="h-9 w-12 shrink-0 rounded"
          />
          <RegPlate registration={v.registration} size="sm" />
        </div>
      );
    case "currency":
      return (
        <span className="font-medium tabular-nums">
          {formatCurrency(typeof raw === "number" ? raw : null)}
        </span>
      );
    case "date":
      return <span className="tabular-nums">{formatDate(String(raw))}</span>;
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (Number.isNaN(n)) return <span>{String(raw)}</span>;
      return <span className="tabular-nums">{formatNumber(n)}</span>;
    }
    case "boolean":
      return raw ? (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300">
          <Check className="h-2.5 w-2.5" />
        </span>
      ) : (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <X className="h-2.5 w-2.5" />
        </span>
      );
    case "select":
      return (
        <span className="inline-flex max-w-full items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-foreground/80">
          <span className="truncate">{String(raw)}</span>
        </span>
      );
    case "status": {
      const status = String(raw) as VehicleStatus;
      const def = VEHICLE_STATUSES.find((s) => s.value === status);
      return (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            STATUS_TONE[status],
          )}
        >
          {def?.label ?? status}
        </span>
      );
    }
    case "location":
      // Spec v3.0 · Module A — renders the location label + off-site /
      // test-drive affordances. Workshop / staff name tooltips need the
      // related-entity lookup, which the master-sheet cell doesn't carry;
      // the badge falls back to a generic tooltip in that case.
      return (
        <LocationBadge
          location={v.currentLocation}
          outForTestDrive={v.outForTestDrive}
          testDriveExpectedBackAt={v.testDriveExpectedBackAt}
        />
      );
    case "text":
    default:
      return <span className="truncate">{String(raw)}</span>;
  }
}

interface QuickAdd {
  registration: string;
  make: string;
  model: string;
  year: string;
  colour: string;
  mileage: string;
  supplierId: string;
}

const EMPTY_QUICK_ADD: QuickAdd = {
  registration: "",
  make: "",
  model: "",
  year: "",
  colour: "",
  mileage: "",
  supplierId: "",
};

export interface VehicleSheetProps {
  /** Page title shown in the header. */
  title: string;
  /** Optional clarifier line (PageHelper) rendered under the title. */
  helper?: ReactNode;
  /** Row-count summary line; receives the filtered count + selected count. */
  summary: (count: number | null, selected: number) => ReactNode;
  /** Column definitions for this sheet. */
  cols: ColDef[];
  /** Fields offered in the "Add filter" condition builder. */
  filterFields: FilterField[];
  /** Filename prefix for the CSV export (date is appended). */
  csvName: string;
  /** Keys allowed to inline-edit. Defaults to the Master Sheet set. */
  editableKeys?: Set<string>;
  /** Show the quick-add footer row. Defaults to true. */
  enableQuickAdd?: boolean;
  /** Hide the Export CSV button. Defaults to false. */
  hideExport?: boolean;
  /** Extra header actions rendered after the Columns button (in the
   *  trailing CTA slot, where Export CSV otherwise sits). */
  headerActions?: ReactNode;
  /** Optional footer rendered after the table (e.g. an add-vehicle modal). */
  children?: ReactNode;
}

export function VehicleSheet({
  title,
  helper,
  summary,
  cols: allCols,
  filterFields,
  csvName,
  editableKeys = DEFAULT_EDITABLE_KEYS,
  enableQuickAdd = true,
  hideExport = false,
  headerActions,
  children,
}: VehicleSheetProps) {
  const { company, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [visible, setVisible] = useState<Set<string>>(
    new Set(allCols.map((c) => colKey(c))),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  // Inline-edit: which cell is open + the in-progress draft string.
  const [editing, setEditing] = useState<{ id: string; key: string } | null>(
    null,
  );
  const [draft, setDraft] = useState("");
  const [savingCell, setSavingCell] = useState(false);
  // Quick-add row state.
  const [partners, setPartners] = useState<DealerPartner[]>([]);
  const [quick, setQuick] = useState<QuickAdd>({ ...EMPTY_QUICK_ADD });
  const [adding, setAdding] = useState(false);
  // Filter-chip bar (Variation C) state.
  const [filters, setFilters] = useState<FilterCond[]>([]);
  const [search, setSearch] = useState("");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [bField, setBField] = useState<keyof Vehicle>(
    filterFields[0]?.key ?? "make",
  );
  const [bOp, setBOp] = useState(
    (filterFields[0]?.kind ?? "text") === "num" ? "gte" : "is",
  );
  const [bValue, setBValue] = useState("");
  const filterId = useRef(1);

  // Per-column width overrides (GEN-20), keyed by colKey → px. Missing keys fall
  // back to the ColDef's default width. Persisted per sheet so a user's resize
  // survives reloads; hydrated post-mount to avoid an SSR hydration mismatch.
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizeRef = useRef<{
    key: string;
    startX: number;
    startW: number;
    colEl: HTMLElement | null;
    width: number;
    tableEl: HTMLElement | null;
    startTableW: number;
  } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(colWidthsKey(csvName));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setColWidths(JSON.parse(raw) as Record<string, number>);
    } catch {
      /* corrupt/blocked storage → keep default widths */
    }
  }, [csvName]);

  const widthFor = (c: ColDef): number => colWidths[colKey(c)] ?? c.width;

  function persistWidths(next: Record<string, number>): void {
    try {
      localStorage.setItem(colWidthsKey(csvName), JSON.stringify(next));
    } catch {
      /* ignore storage failures — in-memory widths still apply */
    }
  }

  function onResizeStart(e: ReactPointerEvent, c: ColDef): void {
    // Keep the drag off the header (no sort/select side-effects) and capture the
    // pointer so move/up keep firing even once it leaves the thin handle.
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    // Grab the matching <col> so the drag can resize it imperatively — updating
    // React state on every pointermove would re-render the whole grid (43 cols ×
    // 25 rows) each frame and stutter. We commit to state only on release.
    const th = handle.closest("th");
    const tableEl = handle.closest("table") as HTMLElement | null;
    const colgroup = tableEl?.querySelector("colgroup");
    const colEl =
      th && colgroup
        ? (colgroup.children[th.cellIndex] as HTMLElement | undefined)
        : undefined;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort — the drag still tracks via move/up */
    }
    const startW = widthFor(c);
    resizeRef.current = {
      key: colKey(c),
      startX: e.clientX,
      startW,
      colEl: colEl ?? null,
      width: startW,
      tableEl,
      startTableW: tableEl?.offsetWidth ?? 0,
    };
  }
  function onResizeMove(e: ReactPointerEvent): void {
    const r = resizeRef.current;
    if (!r) return;
    r.width = Math.min(
      Math.max(r.startW + (e.clientX - r.startX), MIN_COL_W),
      MAX_COL_W,
    );
    // Imperative width update — no setState, so no re-render mid-drag. Under
    // table-fixed the table width must track the summed columns too, else a
    // shrink just redistributes the freed space back into the column.
    const delta = r.width - r.startW;
    if (r.colEl) r.colEl.style.width = `${r.width}px`;
    if (r.tableEl) r.tableEl.style.width = `${r.startTableW + delta}px`;
  }
  function onResizeEnd(e: ReactPointerEvent): void {
    const r = resizeRef.current;
    if (!r) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* no-op if capture was never acquired */
    }
    resizeRef.current = null;
    // A click with no drag (width unchanged) shouldn't pin/persist a width.
    if (r.width === r.startW) return;
    // Commit the final width to state (keeps React in sync) + persist once.
    setColWidths((prev) => {
      const next = { ...prev, [r.key]: r.width };
      persistWidths(next);
      return next;
    });
  }
  function resetWidth(c: ColDef): void {
    // Double-click a handle → drop the override, back to the ColDef default.
    setColWidths((prev) => {
      const next = { ...prev };
      delete next[colKey(c)];
      persistWidths(next);
      return next;
    });
  }

  useEffect(() => {
    if (!company) return;
    void vehicleService.getAll(company.id).then(setVehicles);
    if (enableQuickAdd) {
      void dealerPartnerService.getAll(company.id).then(setPartners);
    }
  }, [company, enableQuickAdd]);

  function startEdit(v: Vehicle, c: ColDef) {
    const raw = rawValue(c, v);
    setEditing({ id: v.id, key: colKey(c) });
    setDraft(raw === null || raw === undefined ? "" : String(raw));
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
  }

  async function commitEdit(v: Vehicle, c: ColDef, valueOverride?: unknown) {
    if (!user || !company) return;
    const value =
      valueOverride !== undefined ? valueOverride : coerceCellValue(c, draft);
    const field = c.key as keyof Vehicle;
    if (v[field] === value) {
      cancelEdit();
      return;
    }
    setSavingCell(true);
    const snapshot = vehicles;
    // Optimistic: patch the local row immediately.
    setVehicles((prev) =>
      prev
        ? prev.map((row) =>
            row.id === v.id ? { ...row, [field]: value } : row,
          )
        : prev,
    );
    try {
      const updated = await vehicleService.update(
        v.id,
        { [field]: value } as Partial<Vehicle>,
        user.id,
      );
      // Replace with the authoritative row (also refreshes any derived
      // values the server recomputed).
      setVehicles((prev) =>
        prev ? prev.map((row) => (row.id === v.id ? updated : row)) : prev,
      );
      toast.success(`${updated.registration}: ${c.label} updated`);
    } catch (e) {
      console.warn("[vehicle-sheet] cell update failed", e);
      setVehicles(snapshot); // revert
      toast.error(`Couldn't save ${c.label} — reverted`);
    } finally {
      setSavingCell(false);
      cancelEdit();
    }
  }

  async function handleQuickAdd() {
    if (!user || !company) return;
    const reg = quick.registration.trim().toUpperCase();
    if (!reg || !quick.make.trim()) {
      toast.error("Registration and make are required");
      return;
    }
    setAdding(true);
    try {
      const yearNum = Number(quick.year);
      const mileageNum = Number(quick.mileage);
      const today = new Date().toISOString().slice(0, 10);
      const created = await vehicleService.create(
        {
          companyId: company.id,
          registration: reg,
          tagNumber: null,
          make: quick.make.trim(),
          model: quick.model.trim(),
          variantName: null,
          variantCode: null,
          year:
            Number.isFinite(yearNum) && yearNum > 0
              ? yearNum
              : new Date().getFullYear(),
          colour: quick.colour.trim() || "Unknown",
          mileage: Number.isFinite(mileageNum) ? mileageNum : 0,
          vehicleType: "car",
          bodyType: "hatchback",
          fuelType: "petrol",
          transmission: "manual",
          engineSizeCC: null,
          receivedDate: today,
          receivedBy: user.id,
          sellerName: "—",
          sellerPhone: "",
          purchaseSource: "dealer",
          purchaseChannel: null,
          supplierId: null,
          customFields: {},
          localOrImport: "local",
          auctionHouse: null,
          ownedBy: null,
          managedBy: null,
          invoiceDate: null,
          v5Received: false,
          serviceHistory: "none",
          numKeys: 1,
          lockNut: false,
          motExpiry: null,
          vin: null,
          firstRegisteredDate: null,
          buyingPrice: 0,
          vatOnBuyingPrice: 0,
          buyersFee: null,
          inspectionCharge: null,
          collectionFee: null,
          deliveryFee: null,
          lateStorageFee: null,
          otherCharges: null,
          totalBuyingPrice: 0,
          financeProvider: "none",
          loadingFee: null,
          dailyChargeRate: null,
          unloadingFee: null,
          stockingCharges: 0,
          valueAddition: 0,
          warrantyCost: null,
          landedCost: 0,
          baseCost: 0,
          minimumSalePrice: null,
          listingPrice: null,
          sellingPrice: null,
          dateSold: null,
          sellingAgent: null,
          grossEarning: null,
          status: "received",
          removedFromWebsiteAt: null,
          daysInStock: 0,
          imagesCount: 0,
          heroImageUrl: null,
          // Module-F (migration 0017) — quick-add doesn't run the DVLA lookup,
          // so compliance fields land as null. Edit later via the vehicle
          // detail page to populate them.
          co2Emissions: null,
          euroStatus: null,
          taxStatus: null,
          taxDueDate: null,
          motStatus: null,
          wheelplan: null,
          automatedVehicle: null,
          dateOfLastV5CIssued: null,
          // AutoTrader (migration 0018) — quick-add skips the lookup.
          derivative: null,
          generation: null,
          trim: null,
          atDerivativeId: null,
          atRetailValuation: null,
          atTradeValuation: null,
          atPartExchangeValuation: null,
          atPrivateValuation: null,
          atPriceIndicator: null,
          atValuationAt: null,
        },
        user.id,
      );
      if (quick.supplierId) {
        await dealerPartnerService.assignSupplier(created.id, quick.supplierId);
      }
      setVehicles(await vehicleService.getAll(company.id));
      toast.success(`${created.stockId} — ${reg} added`);
      setQuick({ ...EMPTY_QUICK_ADD });
    } catch (e) {
      console.warn("[vehicle-sheet] quick-add failed", e);
      toast.error("Couldn't add vehicle");
    } finally {
      setAdding(false);
    }
  }

  const cols = useMemo(
    () => allCols.filter((c) => visible.has(colKey(c))),
    [allCols, visible],
  );

  const filtered = useMemo(() => {
    if (!vehicles) return null;
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (q) {
        const hay =
          `${v.registration} ${v.stockId} ${v.make} ${v.model}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return filters.every((c) => matchCond(c, v));
    });
  }, [vehicles, search, filters]);

  // Keep the selection confined to currently-visible rows. Without this,
  // "select all" + a later filter/search change would keep counting (and
  // acting on) rows that are no longer on screen.
  useEffect(() => {
    if (!filtered) return;
    setSelected((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(filtered.map((v) => v.id));
      const next = new Set<string>();
      for (const id of prev) if (visibleIds.has(id)) next.add(id);
      return next.size === prev.size ? prev : next;
    });
  }, [filtered]);

  function addFilter() {
    const fld = filterFields.find((f) => f.key === bField);
    if (!fld || !bValue.trim()) return;
    setFilters((prev) => [
      ...prev,
      {
        id: filterId.current++,
        key: fld.key,
        label: fld.label,
        kind: fld.kind,
        op: bOp,
        value: bValue.trim(),
      },
    ]);
    setBValue("");
    setBuilderOpen(false);
    setPage(1);
  }

  function removeFilter(id: number) {
    setFilters((prev) => prev.filter((f) => f.id !== id));
    setPage(1);
  }

  const totalPages = filtered
    ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    : 1;
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    if (!filtered) return null;
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  function toggle(k: string) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  /** Open a vehicle's detail page, stamping the originating list path as
   *  `?from=` so the detail Back button returns here (not always Inventory). */
  function openVehicle(id: string) {
    router.push(`/vehicles/${id}?from=${encodeURIComponent(pathname)}`);
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (!filtered) return;
    setSelected((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((v) => v.id)),
    );
  }

  function exportCsv() {
    if (!filtered) return;
    // Export every defined column (not just the visible ones) so hidden
    // columns aren't silently dropped from the data file. cellCsv reads the
    // raw value, so number/currency columns export bare numerics, not the
    // formatted display strings.
    const head = allCols.map((c) => csvEscape(c.label)).join(",");
    const body = filtered
      .map((v) => allCols.map((c) => csvEscape(cellCsv(c, v))).join(","))
      .join("\n");
    const csv = `${head}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${csvName}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <PageShell wide>
      {/* Bounded viewport height so the table's own container scrolls (and the
          sticky <thead> sticks) instead of the whole page scrolling. */}
      <div className="flex h-[calc(100dvh-8rem)] flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {helper}
            <p className="text-sm text-muted-foreground">
              {summary(filtered?.length ?? null, selected.size)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* The page's existing column visibility popover stays — it uses
                a 2-column grid layout that the generic DataGridColumnsButton
                doesn't replicate. Migrate in a follow-up if we want parity. */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                  Columns ({cols.length}/{allCols.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <ScrollArea className="max-h-[60vh] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {allCols.map((c) => {
                      const k = colKey(c);
                      return (
                        <Label
                          key={k}
                          className="flex items-center gap-2 text-xs"
                        >
                          <Checkbox
                            checked={visible.has(k)}
                            onCheckedChange={() => toggle(k)}
                          />
                          {c.label}
                        </Label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
            {!hideExport && (
              <Button size="sm" onClick={exportCsv} disabled={!filtered}>
                <Download className="mr-1.5 h-4 w-4" />
                Export CSV
              </Button>
            )}
            {headerActions}
          </div>
        </div>

        {/* Variation C — filter-chip bar: applied chips + add-condition builder */}
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Where
            </span>
            {filters.length === 0 && (
              <span className="text-xs text-muted-foreground">
                No filters applied
              </span>
            )}
            {filters.map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <span className="text-muted-foreground">{f.label}</span>
                <span className="text-muted-foreground">{opLabel(f.op)}</span>
                <span className="font-medium">{f.value}</span>
                <button
                  type="button"
                  onClick={() => removeFilter(f.id)}
                  aria-label={`Remove ${f.label} filter`}
                  className="ml-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {/* Plain search input — no "Search" label above it (GEN-40); the
                  placeholder describes it and aria-label keeps it accessible. */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label="Search"
                  placeholder="Search reg, stock, make…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 w-56 pl-7 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => setBuilderOpen((o) => !o)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent/40"
              >
                <Plus className="h-3.5 w-3.5" /> Add filter
              </button>
            </div>
          </div>
          {builderOpen && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-muted/20 p-2">
              <span className="text-xs font-medium text-muted-foreground">
                Add condition
              </span>
              <div className="w-40">
                <nord-select
                  size="s"
                  hideLabel
                  label="Field"
                  expand
                  value={String(bField)}
                  onChange={(e) => {
                    const key = (e.target as HTMLSelectElement)
                      .value as keyof Vehicle;
                    setBField(key);
                    setBOp(
                      kindOf(filterFields, key) === "num" ? "gte" : "is",
                    );
                  }}
                  suppressHydrationWarning
                >
                  {filterFields.map((f) => (
                    <option key={String(f.key)} value={String(f.key)}>
                      {f.label}
                    </option>
                  ))}
                </nord-select>
              </div>
              <div className="w-32">
                <nord-select
                  size="s"
                  hideLabel
                  label="Operator"
                  expand
                  value={bOp}
                  onChange={(e) =>
                    setBOp((e.target as HTMLSelectElement).value)
                  }
                  suppressHydrationWarning
                >
                  {opsFor(kindOf(filterFields, bField)).map((o) => (
                    <option key={o.v} value={o.v}>
                      {o.l}
                    </option>
                  ))}
                </nord-select>
              </div>
              <div className="w-48">
                <nord-input
                  size="s"
                  hideLabel
                  label="Value"
                  placeholder="Value…"
                  expand
                  value={bValue}
                  onInput={(e) =>
                    setBValue((e.target as HTMLInputElement).value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addFilter();
                  }}
                  suppressHydrationWarning
                />
              </div>
              <nord-button
                size="s"
                onClick={() => {
                  setBuilderOpen(false);
                  setBValue("");
                }}
              >
                Cancel
              </nord-button>
              <nord-button size="s" variant="primary" onClick={addFilter}>
                Add filter
              </nord-button>
            </div>
          )}
        </div>

        {!filtered ? (
          <Skeleton className="h-72" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No vehicles"
            description="Add a vehicle or adjust your filters."
          />
        ) : (
          <Card className="flex min-h-0 flex-1 flex-col p-0">
            <div className="relative min-h-0 flex-1 overflow-auto">
              {/* table-fixed makes the colgroup widths authoritative so a
                  resize actually sticks — under auto layout a wide-content
                  column (e.g. Variant) ignored its <col> width and couldn't be
                  shrunk (GEN-20). The explicit width tracks the summed columns
                  so the container scrolls horizontally as before. */}
              <table
                className="table-fixed border-separate text-xs"
                style={{
                  width: 80 + cols.reduce((sum, c) => sum + widthFor(c), 0),
                  borderSpacing: 0,
                }}
              >
                <colgroup>
                  <col style={{ width: 40 }} />
                  {cols.map((c) => (
                    <col key={colKey(c)} style={{ width: widthFor(c) }} />
                  ))}
                  <col style={{ width: 40 }} />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-muted">
                  <tr>
                    <th className="sticky left-0 z-30 border-b border-r bg-muted shadow-[2px_0_4px_-2px_var(--shadow-color)]">
                      <div className="flex h-8 items-center justify-center">
                        <Checkbox
                          checked={
                            filtered.length > 0 &&
                            selected.size === filtered.length
                          }
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                        />
                      </div>
                    </th>
                    {cols.map((c) => (
                      <th
                        key={colKey(c)}
                        className={cn(
                          "relative border-b border-r px-2 text-left font-medium",
                          c.sticky &&
                            "sticky z-30 bg-muted shadow-[2px_0_4px_-2px_var(--shadow-color)]",
                        )}
                        style={c.sticky ? { left: 40 } : undefined}
                      >
                        <div className="flex h-8 min-w-0 items-center pr-1 text-xs">
                          <span className="min-w-0 truncate font-medium text-foreground">
                            {c.label}
                          </span>
                        </div>
                        {/* Resize handle: a wide, easy-to-grab hit area (GEN-20)
                            straddling the right border, with a thin accent line
                            shown on hover. Drag to resize, double-click resets. */}
                        <div
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Resize ${c.label} column`}
                          onPointerDown={(e) => onResizeStart(e, c)}
                          onPointerMove={onResizeMove}
                          onPointerUp={onResizeEnd}
                          onDoubleClick={() => resetWidth(c)}
                          className="group/resize absolute -right-1.5 top-0 z-40 flex h-full w-3 cursor-col-resize touch-none select-none justify-center"
                          title="Drag to resize · double-click to reset"
                        >
                          <span className="h-full w-0.5 bg-transparent transition-colors group-hover/resize:bg-primary/60 group-active/resize:bg-primary" />
                        </div>
                      </th>
                    ))}
                    <th className="border-b">
                      <div className="flex h-8 items-center justify-center text-muted-foreground">
                        <Plus className="h-3.5 w-3.5" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-background">
                  {(pagedRows ?? []).map((v, idxOnPage) => {
                    const isSelected = selected.has(v.id);
                    const idx = (safePage - 1) * PAGE_SIZE + idxOnPage;
                    return (
                      <tr
                        key={v.id}
                        onClick={() => openVehicle(v.id)}
                        className={cn(
                          "group/row cursor-pointer",
                          isSelected && "bg-primary/5",
                        )}
                      >
                        <td
                          className={cn(
                            // SOLID backgrounds on sticky cells — a
                            // translucent sticky cell lets scrolled-out
                            // content bleed through and corrupts cell
                            // text (date columns sliding under stock IDs
                            // produced "CC400072026"-style artifacts).
                            // Drop shadow marks the sticky boundary.
                            "sticky left-0 z-10 border-b border-r bg-background text-center",
                            "shadow-[2px_0_4px_-2px_var(--shadow-color)]",
                            isSelected && "bg-muted",
                            "group-hover/row:bg-muted",
                          )}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex h-11 items-center justify-center">
                            <span className="text-xs tabular-nums text-muted-foreground group-hover/row:hidden group-has-[[data-state=checked]]/row:hidden">
                              {idx + 1}
                            </span>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRow(v.id)}
                              aria-label={`Select row ${idx + 1}`}
                              className={cn(
                                "hidden group-hover/row:inline-flex",
                                isSelected && "inline-flex",
                              )}
                            />
                          </div>
                        </td>
                        {cols.map((c) => {
                          const editable = isEditableCol(c, editableKeys);
                          const isEditingThis =
                            editing?.id === v.id && editing?.key === colKey(c);
                          const alignEnd =
                            c.type === "currency" || c.type === "number";
                          return (
                            <td
                              key={colKey(c)}
                              className={cn(
                                "border-b border-r px-2",
                                // Sticky data cells: SOLID bg + shadow.
                                // Inner sticky cells' shadows are occluded
                                // by the next sticky cell's solid bg via
                                // paint order; only the rightmost shadow
                                // is visually present.
                                c.sticky &&
                                  "sticky z-10 bg-background shadow-[2px_0_4px_-2px_var(--shadow-color)] group-hover/row:bg-muted",
                                isSelected && c.sticky && "bg-muted",
                                !c.sticky && "group-hover/row:bg-muted/40",
                              )}
                              style={c.sticky ? { left: 40 } : undefined}
                            >
                              <div
                                className={cn(
                                  // min-w-0 + overflow-hidden let truncating
                                  // cell text clip cleanly inside the now
                                  // fixed-width column (GEN-20).
                                  "flex h-11 min-w-0 items-center overflow-hidden [&_span]:min-w-0",
                                  alignEnd ? "justify-end" : "justify-start",
                                )}
                              >
                                {isEditingThis ? (
                                  <Input
                                    autoFocus
                                    type={
                                      c.type === "date"
                                        ? "date"
                                        : c.type === "number" ||
                                            c.type === "currency"
                                          ? "number"
                                          : "text"
                                    }
                                    value={draft}
                                    disabled={savingCell}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onBlur={() => void commitEdit(v, c)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        void commitEdit(v, c);
                                      } else if (e.key === "Escape") {
                                        e.preventDefault();
                                        cancelEdit();
                                      }
                                    }}
                                    className={cn(
                                      "h-7 w-full min-w-0 px-1.5 py-0 text-xs",
                                      alignEnd && "text-right",
                                    )}
                                  />
                                ) : editable ? (
                                  <button
                                    type="button"
                                    title="Click to edit"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (c.type === "boolean") {
                                        void commitEdit(
                                          v,
                                          c,
                                          !v[c.key as keyof Vehicle],
                                        );
                                      } else {
                                        startEdit(v, c);
                                      }
                                    }}
                                    className="-mx-1 flex w-full min-w-0 cursor-pointer items-center rounded px-1 text-left hover:bg-primary/5 focus-visible:outline-1"
                                    style={
                                      alignEnd
                                        ? { justifyContent: "flex-end" }
                                        : undefined
                                    }
                                  >
                                    <CellContent col={c} v={v} />
                                  </button>
                                ) : (
                                  <CellContent col={c} v={v} />
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="border-b group-hover/row:bg-muted/40" />
                      </tr>
                    );
                  })}
                  {/* Quick-add row — minimal create with auto stock ID */}
                  {enableQuickAdd && (
                    <tr className="bg-muted/20">
                      <td
                        colSpan={cols.length + 2}
                        className="border-b px-2 py-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <Plus className="h-3.5 w-3.5" /> Quick add
                          </span>
                          <Input
                            value={quick.registration}
                            onChange={(e) =>
                              setQuick({
                                ...quick,
                                registration: e.target.value,
                              })
                            }
                            placeholder="Reg *"
                            className="h-8 w-28 text-xs uppercase"
                          />
                          <Input
                            value={quick.make}
                            onChange={(e) =>
                              setQuick({ ...quick, make: e.target.value })
                            }
                            placeholder="Make *"
                            className="h-8 w-28 text-xs"
                          />
                          <Input
                            value={quick.model}
                            onChange={(e) =>
                              setQuick({ ...quick, model: e.target.value })
                            }
                            placeholder="Model"
                            className="h-8 w-28 text-xs"
                          />
                          <Input
                            value={quick.year}
                            onChange={(e) =>
                              setQuick({ ...quick, year: e.target.value })
                            }
                            placeholder="Year"
                            type="number"
                            className="h-8 w-20 text-xs"
                          />
                          <Input
                            value={quick.colour}
                            onChange={(e) =>
                              setQuick({ ...quick, colour: e.target.value })
                            }
                            placeholder="Colour"
                            className="h-8 w-24 text-xs"
                          />
                          <Input
                            value={quick.mileage}
                            onChange={(e) =>
                              setQuick({ ...quick, mileage: e.target.value })
                            }
                            placeholder="Mileage"
                            type="number"
                            className="h-8 w-24 text-xs"
                          />
                          <select
                            value={quick.supplierId}
                            onChange={(e) =>
                              setQuick({ ...quick, supplierId: e.target.value })
                            }
                            className="h-8 rounded-md border bg-background px-2 text-xs"
                          >
                            <option value="">No dealer partner</option>
                            {partners.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            className="h-8"
                            onClick={() => void handleQuickAdd()}
                            disabled={adding}
                          >
                            {adding ? "Adding…" : "Add vehicle"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {filtered && filtered.length > PAGE_SIZE && (
          // Phase B — shared DataGridPagination primitive.
          <Card className="p-0">
            <DataGridPagination
              page={safePage}
              pageSize={PAGE_SIZE}
              totalPages={totalPages}
              total={filtered.length}
              onPageChange={setPage}
            />
          </Card>
        )}
      </div>
      {children}
    </PageShell>
  );
}
