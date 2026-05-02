"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, SlidersHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vehicleService } from "@/lib/services/vehicle-service";
import type { Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/shared/empty-state";

interface ColDef {
  key: keyof Vehicle | "profit";
  label: string;
  width?: string;
  format?: (v: Vehicle) => string;
}

const COLS: ColDef[] = [
  { key: "stockId", label: "Stock ID" },
  { key: "registration", label: "Reg" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "variantCode", label: "Variant" },
  { key: "year", label: "Year" },
  { key: "colour", label: "Colour" },
  { key: "mileage", label: "Mileage" },
  { key: "vehicleType", label: "Type" },
  { key: "bodyType", label: "Body" },
  { key: "fuelType", label: "Fuel" },
  { key: "transmission", label: "Trans" },
  { key: "engineSizeCC", label: "Engine cc" },
  { key: "receivedDate", label: "Received" },
  { key: "sellerName", label: "Seller" },
  { key: "sellerPhone", label: "Phone" },
  { key: "sourceType", label: "Source" },
  { key: "auctionHouse", label: "Auction" },
  { key: "v5Received", label: "V5", format: (v) => (v.v5Received ? "Y" : "N") },
  { key: "serviceHistory", label: "SH" },
  { key: "numKeys", label: "Keys" },
  { key: "lockNut", label: "Lock", format: (v) => (v.lockNut ? "Y" : "N") },
  { key: "motExpiry", label: "MOT" },
  { key: "buyingPrice", label: "Buying £" },
  { key: "buyersFee", label: "Buyer fee" },
  { key: "collectionFee", label: "Coll. fee" },
  { key: "totalBuyingPrice", label: "Total buying" },
  { key: "financeProvider", label: "Finance" },
  { key: "stockingCharges", label: "Stocking £" },
  { key: "valueAddition", label: "Value add" },
  { key: "warrantyCost", label: "Warranty" },
  { key: "landedCost", label: "Landed" },
  { key: "baseCost", label: "Base cost" },
  { key: "minimumSalePrice", label: "Min sale" },
  { key: "listingPrice", label: "Listing" },
  { key: "sellingPrice", label: "Sold" },
  { key: "dateSold", label: "Sold date" },
  { key: "sellingAgent", label: "Agent" },
  { key: "grossEarning", label: "Gross" },
  {
    key: "profit",
    label: "Est. profit",
    format: (v) =>
      v.listingPrice !== null
        ? String(Math.round(v.listingPrice - v.baseCost))
        : "",
  },
  { key: "status", label: "Status" },
  { key: "daysInStock", label: "Days" },
  { key: "imagesCount", label: "Imgs" },
];

function csvEscape(s: string) {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function cellValue(col: ColDef, v: Vehicle): string {
  if (col.format) return col.format(v);
  if (col.key === "profit") {
    return v.listingPrice !== null
      ? String(Math.round(v.listingPrice - v.baseCost))
      : "";
  }
  const raw = v[col.key as keyof Vehicle];
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "boolean") return raw ? "Y" : "N";
  return String(raw);
}

export default function MasterSheetPage() {
  const { company } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [visible, setVisible] = useState<Set<string>>(
    new Set(COLS.map((c) => String(c.key))),
  );

  useEffect(() => {
    if (!company) return;
    void vehicleService.getAll(company.id).then(setVehicles);
  }, [company]);

  const cols = useMemo(
    () => COLS.filter((c) => visible.has(String(c.key))),
    [visible],
  );

  function toggle(k: string) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  function exportCsv() {
    if (!vehicles) return;
    const head = cols.map((c) => csvEscape(c.label)).join(",");
    const body = vehicles
      .map((v) => cols.map((c) => csvEscape(cellValue(c, v))).join(","))
      .join("\n");
    const csv = `${head}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `master-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Master Sheet</h1>
          <p className="text-sm text-muted-foreground">
            All vehicle fields in one wide grid. Replaces the legacy 132-column Excel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                Columns ({cols.length}/{COLS.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <ScrollArea className="max-h-[60vh] p-3">
                <div className="grid grid-cols-2 gap-2">
                  {COLS.map((c) => {
                    const k = String(c.key);
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
          <Button size="sm" onClick={exportCsv} disabled={!vehicles}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {!vehicles ? (
        <Skeleton className="h-72" />
      ) : vehicles.length === 0 ? (
        <EmptyState icon={FileSpreadsheet} title="No vehicles" />
      ) : (
        <Card className="p-0">
          <div className="max-w-full overflow-x-auto">
            <table className="text-xs">
              <thead className="sticky top-0 z-10 border-b bg-muted/40">
                <tr>
                  {cols.map((c) => (
                    <th
                      key={String(c.key)}
                      className="whitespace-nowrap px-2 py-1.5 text-left font-medium"
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    {cols.map((c) => (
                      <td
                        key={String(c.key)}
                        className="whitespace-nowrap px-2 py-1 tabular-nums"
                      >
                        {cellValue(c, v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
