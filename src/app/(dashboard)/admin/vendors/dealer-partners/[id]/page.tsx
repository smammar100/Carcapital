"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronDown, Plus } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { dealerPartnerService } from "@/lib/services/dealer-partner-service";
import type { DealerPartner, Vehicle } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { AddVehicleButton } from "@/components/vehicles/add-vehicle-button";
import {
  type ColumnDef,
  DataGridColumnsButton,
  DataGridDensityToggle,
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridTable,
  VehicleCell,
  useColumnVisibility,
  useDensity,
} from "@/components/data-grid";
import { toast } from "@/lib/toast";

interface DraftPartner {
  name: string;
  phone: string;
  companyName: string;
  email: string;
  companyAddress: string;
  vatNumber: string;
  active: boolean;
}

export default function DealerPartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { company } = useAuth();
  const [partner, setPartner] = useState<DealerPartner | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState<Vehicle[] | null>(null);
  const [historical, setHistorical] = useState<Vehicle[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [edit, setEdit] = useState<DraftPartner | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!company) return;
    const cid = company.id;
    void dealerPartnerService.getById(id).then((p) => {
      setPartner(p);
      setLoaded(true);
      setNotesDraft(p?.notes ?? "");
      if (p) {
        void dealerPartnerService.activeStock(cid, id).then(setActive);
        void dealerPartnerService
          .historicalStock(cid, id)
          .then(setHistorical);
      }
    });
  }, [company, id]);

  const stockCols = useMemo<ColumnDef<Vehicle>[]>(
    () => [
      {
        key: "vehicle",
        label: "Vehicle",
        type: "vehicle",
        sticky: true,
        width: 220,
        render: (v) => <VehicleCell vehicle={v} />,
      },
      { key: "registration", label: "Reg", type: "text", width: 110 },
      { key: "stockId", label: "Stock ID", type: "text", width: 110 },
      { key: "status", label: "Status", type: "vehicleStatus", width: 140 },
      { key: "daysInStock", label: "Days", type: "number", width: 80 },
      { key: "listingPrice", label: "Web price", type: "currency", width: 110 },
    ],
    [],
  );

  const { density, setDensity } = useDensity();
  const { hiddenKeys, setHiddenKeys, visibleCols } =
    useColumnVisibility(stockCols);
  const lockedKeys = useMemo(() => new Set(["vehicle"]), []);

  async function saveNotes() {
    if (!company || !partner) return;
    setBusy(true);
    try {
      const res = await dealerPartnerService.upsert({
        id: partner.id,
        companyId: company.id,
        name: partner.name,
        phone: partner.phone,
        companyName: partner.companyName,
        email: partner.email,
        companyAddress: partner.companyAddress,
        vatNumber: partner.vatNumber,
        notes: notesDraft.trim() || null,
        active: partner.active,
      });
      if (res) {
        setPartner(res);
        toast.success("Notes saved");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!company || !partner || !edit) return;
    if (!edit.name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    setBusy(true);
    try {
      const res = await dealerPartnerService.upsert({
        id: partner.id,
        companyId: company.id,
        name: edit.name.trim(),
        phone: edit.phone.trim() || null,
        companyName: edit.companyName.trim() || null,
        email: edit.email.trim() || null,
        companyAddress: edit.companyAddress.trim() || null,
        vatNumber: edit.vatNumber.trim() || null,
        notes: partner.notes,
        active: edit.active,
      });
      if (res) {
        setPartner(res);
        toast.success("Partner updated");
        setEdit(null);
      }
    } finally {
      setBusy(false);
    }
  }

  if (loaded && !partner) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          href="/admin/vendors?tab=dealer-partners"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Dealer Partners
        </Link>
        <EmptyState
          icon={Plus}
          title="Partner not found"
          description="This dealer partner doesn't exist or the table isn't migrated."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/vendors?tab=dealer-partners"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Dealer Partners
      </Link>

      {!partner ? (
        <Skeleton className="h-40" />
      ) : (
        <>
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {partner.companyName ?? partner.name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {partner.name}
                  {partner.phone ? ` · ${partner.phone}` : ""}
                  {partner.email ? ` · ${partner.email}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {partner.companyAddress ?? "—"}
                  {partner.vatNumber ? ` · VAT ${partner.vatNumber}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!partner.active && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEdit({
                      name: partner.name,
                      phone: partner.phone ?? "",
                      companyName: partner.companyName ?? "",
                      email: partner.email ?? "",
                      companyAddress: partner.companyAddress ?? "",
                      vatNumber: partner.vatNumber ?? "",
                      active: partner.active,
                    })
                  }
                >
                  Edit Partner
                </Button>
                <AddVehicleButton
                  size="sm"
                  extraParams={{ dealerPartner: partner.id }}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add Vehicle from this
                  Partner
                </AddVehicleButton>
              </div>
            </div>
          </Card>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                Active Stock{" "}
                <span className="text-muted-foreground">
                  ({active?.length ?? "…"})
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <DataGridColumnsButton
                  columns={stockCols}
                  hiddenKeys={hiddenKeys}
                  onChange={setHiddenKeys}
                  lockedKeys={lockedKeys}
                />
                <DataGridDensityToggle
                  density={density}
                  onChange={setDensity}
                />
              </div>
            </div>
            {!active ? (
              <Skeleton className="h-40" />
            ) : active.length === 0 ? (
              <EmptyState
                icon={Plus}
                title="No active stock"
                description="No vehicles currently in stock from this partner (sold / returned excluded)."
              />
            ) : (
              <DataGridShell>
                <DataGridTable cols={visibleCols} density={density}>
                  <DataGridHeaderRow cols={visibleCols} />
                  <tbody>
                    {active.map((v, i) => (
                      <DataGridRow
                        key={v.id}
                        row={v}
                        cols={visibleCols}
                        index={i}
                      />
                    ))}
                  </tbody>
                </DataGridTable>
              </DataGridShell>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowHistory((s) => !s)}
              className="flex items-center gap-1 text-sm font-semibold"
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  showHistory ? "" : "-rotate-90"
                }`}
              />
              Historical Stock{" "}
              <span className="text-muted-foreground">
                ({historical?.length ?? "…"})
              </span>
            </button>
            {showHistory &&
              (!historical ? (
                <Skeleton className="mt-2 h-32" />
              ) : historical.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No previous vehicles from this partner.
                </p>
              ) : (
                <div className="mt-2">
                  <DataGridShell>
                    <DataGridTable cols={visibleCols} density={density}>
                      <DataGridHeaderRow cols={visibleCols} />
                      <tbody>
                        {historical.map((v, i) => (
                          <DataGridRow
                            key={v.id}
                            row={v}
                            cols={visibleCols}
                            index={i}
                          />
                        ))}
                      </tbody>
                    </DataGridTable>
                  </DataGridShell>
                </div>
              ))}
          </div>

          <Card className="flex flex-col gap-2 p-5">
            <Label className="text-sm font-semibold">Notes</Label>
            <Textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              className="min-h-24"
              placeholder="Free-text notes about this partner…"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => void saveNotes()}
                disabled={busy || notesDraft === (partner.notes ?? "")}
              >
                Save notes
              </Button>
            </div>
          </Card>
        </>
      )}

      <Dialog
        open={edit !== null}
        onOpenChange={(o) => {
          if (!o) setEdit(null);
        }}
      >
        <DialogContent className="max-w-md">
          {edit && (
            <>
              <DialogHeader>
                <DialogTitle>Edit Dealer Partner</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Contact name</Label>
                  <Input
                    value={edit.name}
                    onChange={(e) =>
                      setEdit({ ...edit, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={edit.phone}
                      onChange={(e) =>
                        setEdit({ ...edit, phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={edit.email}
                      onChange={(e) =>
                        setEdit({ ...edit, email: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Company name</Label>
                  <Input
                    value={edit.companyName}
                    onChange={(e) =>
                      setEdit({ ...edit, companyName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Company address</Label>
                  <Input
                    value={edit.companyAddress}
                    onChange={(e) =>
                      setEdit({ ...edit, companyAddress: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>VAT number</Label>
                  <Input
                    value={edit.vatNumber}
                    onChange={(e) =>
                      setEdit({ ...edit, vatNumber: e.target.value })
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={edit.active}
                    onCheckedChange={(v) => setEdit({ ...edit, active: v })}
                  />
                  Active
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEdit(null)}>
                  Cancel
                </Button>
                <Button onClick={() => void saveEdit()} disabled={busy}>
                  Save
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
