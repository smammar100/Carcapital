"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Handshake, Plus, Store } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vendorService } from "@/lib/services/vendor-service";
import { dealerPartnerService } from "@/lib/services/dealer-partner-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import type {
  DealerPartner,
  MaintenanceJob,
  Vendor,
  VendorSpeciality,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import {
  type ColumnDef,
  DataGridFooterRow,
  DataGridHeaderRow,
  DataGridRow,
  DataGridShell,
  DataGridSkeletonRows,
  DataGridTable,
} from "@/components/data-grid";
import { toast } from "sonner";

export default function VendorsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // SPEC Point 6 (T6.5) — tab in the URL so it survives refresh.
  const tab =
    searchParams.get("tab") === "dealer-partners" ? "partners" : "garages";
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Vendors</h1>
        <p className="text-sm text-muted-foreground">
          Service garages you use, and the trade partners who supply your
          stock.
        </p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) =>
          router.replace(
            v === "partners"
              ? "/admin/vendors?tab=dealer-partners"
              : "/admin/vendors",
            { scroll: false },
          )
        }
      >
        <TabsList>
          <TabsTrigger value="garages">Garages</TabsTrigger>
          <TabsTrigger value="partners">Dealer Partners</TabsTrigger>
        </TabsList>
        <TabsContent value="garages" className="mt-4">
          <GaragesTab />
        </TabsContent>
        <TabsContent value="partners" className="mt-4">
          <DealerPartnersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Garages (the existing vendor list — unchanged behaviour)
// ────────────────────────────────────────────────────────────────────────────

const SPECIALITIES: VendorSpeciality[] = [
  "mechanical",
  "electrical",
  "bodywork",
  "tyres",
  "mot",
  "general",
];

interface DraftVendor {
  id: string | null;
  name: string;
  phone: string;
  speciality: VendorSpeciality;
  active: boolean;
}

const EMPTY_VENDOR: DraftVendor = {
  id: null,
  name: "",
  phone: "",
  speciality: "mechanical",
  active: true,
};

interface VendorRow extends Vendor {
  activeCount: number;
  totalSpent: number;
}

function GaragesTab() {
  const { company } = useAuth();
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [maintJobs, setMaintJobs] = useState<MaintenanceJob[]>([]);
  const [draft, setDraft] = useState<DraftVendor | null>(null);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      vendorService.getAll(company.id),
      maintenanceService.getAll(company.id),
    ]).then(([v, m]) => {
      setVendors(v);
      setMaintJobs(m);
    });
  }, [company]);

  const rows = useMemo<VendorRow[] | null>(() => {
    if (!vendors) return null;
    const stats = new Map<string, { activeCount: number; totalSpent: number }>();
    for (const v of vendors) stats.set(v.id, { activeCount: 0, totalSpent: 0 });
    for (const j of maintJobs) {
      if (!j.vendorId) continue;
      const sct = stats.get(j.vendorId);
      if (!sct) continue;
      if (j.status !== "completed") sct.activeCount++;
      sct.totalSpent += j.actualCost ?? j.estimatedCost ?? 0;
    }
    return vendors.map((v) => ({
      ...v,
      activeCount: stats.get(v.id)?.activeCount ?? 0,
      totalSpent: stats.get(v.id)?.totalSpent ?? 0,
    }));
  }, [vendors, maintJobs]);

  const cols = useMemo<ColumnDef<VendorRow>[]>(
    () => [
      { key: "name", label: "Name", type: "text", sticky: true, width: 220 },
      { key: "phone", label: "Phone", type: "phone", width: 160 },
      { key: "speciality", label: "Speciality", type: "select", width: 140 },
      {
        key: "activeCount",
        label: "Active jobs",
        type: "custom",
        width: 110,
        align: "right",
        render: (v) =>
          v.activeCount > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {v.activeCount}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">0</span>
          ),
      },
      { key: "totalSpent", label: "Total spent", type: "currency", width: 130 },
      { key: "active", label: "Active", type: "boolean", width: 80 },
    ],
    [],
  );

  async function handleSave() {
    if (!company || !draft) return;
    if (!draft.name.trim()) {
      toast.error("Name required");
      return;
    }
    await vendorService.upsert({
      id: draft.id ?? undefined,
      companyId: company.id,
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      speciality: draft.speciality,
      active: draft.active,
    });
    setVendors(await vendorService.getAll(company.id));
    toast.success(draft.id ? "Garage updated" : "Garage added");
    setDraft(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {vendors ? `${vendors.length} garages` : "Loading…"}
        </p>
        <Dialog
          open={draft !== null}
          onOpenChange={(o) => {
            if (!o) setDraft(null);
            else if (draft === null) setDraft({ ...EMPTY_VENDOR });
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Add Garage
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{draft?.id ? "Edit Garage" : "Add Garage"}</DialogTitle>
            </DialogHeader>
            {draft && (
              <div className="grid gap-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={draft.phone}
                    onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Speciality</Label>
                  <Select
                    value={draft.speciality}
                    onValueChange={(v) =>
                      setDraft({ ...draft, speciality: v as VendorSpeciality })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SPECIALITIES.map((sp) => (
                        <SelectItem key={sp} value={sp} className="capitalize">
                          {sp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.active}
                    onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                  />
                  Active
                </label>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!rows ? (
        <DataGridShell>
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              <DataGridSkeletonRows columns={cols} rows={5} />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No garages yet"
          description="Add the garages and parts suppliers you work with."
        />
      ) : (
        <DataGridShell>
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              {rows.map((row, i) => (
                <DataGridRow
                  key={row.id}
                  row={row}
                  cols={cols}
                  index={i}
                  onClick={(v) =>
                    setDraft({
                      id: v.id,
                      name: v.name,
                      phone: v.phone,
                      speciality: v.speciality,
                      active: v.active,
                    })
                  }
                />
              ))}
              <DataGridFooterRow
                label="New garage"
                span={cols.length}
                onClick={() => setDraft({ ...EMPTY_VENDOR })}
              />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Dealer Partners (trade stock suppliers) — new
// ────────────────────────────────────────────────────────────────────────────

interface DraftPartner {
  id: string | null;
  name: string;
  phone: string;
  companyName: string;
  email: string;
  companyAddress: string;
  vatNumber: string;
  active: boolean;
}

const EMPTY_PARTNER: DraftPartner = {
  id: null,
  name: "",
  phone: "",
  companyName: "",
  email: "",
  companyAddress: "",
  vatNumber: "",
  active: true,
};

interface PartnerRow extends DealerPartner {
  activeStock: number;
}

function DealerPartnersTab() {
  const { company } = useAuth();
  const router = useRouter();
  const [partners, setPartners] = useState<DealerPartner[] | null>(null);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [draft, setDraft] = useState<DraftPartner | null>(null);

  async function reload() {
    if (!company) return;
    const [p, c] = await Promise.all([
      dealerPartnerService.getAll(company.id),
      dealerPartnerService.activeStockCounts(company.id),
    ]);
    setPartners(p);
    setCounts(c);
  }

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      dealerPartnerService.getAll(company.id),
      dealerPartnerService.activeStockCounts(company.id),
    ]).then(([p, c]) => {
      setPartners(p);
      setCounts(c);
    });
  }, [company]);

  const rows = useMemo<PartnerRow[] | null>(() => {
    if (!partners) return null;
    return partners.map((p) => ({
      ...p,
      activeStock: counts.get(p.id) ?? 0,
    }));
  }, [partners, counts]);

  const cols = useMemo<ColumnDef<PartnerRow>[]>(
    () => [
      {
        key: "name",
        label: "Contact Name",
        type: "text",
        sticky: true,
        width: 200,
      },
      { key: "phone", label: "Phone", type: "phone", width: 150 },
      { key: "companyName", label: "Company Name", type: "text", width: 200 },
      {
        key: "activeStock",
        label: "Active Stock",
        type: "custom",
        width: 120,
        align: "right",
        render: (p) =>
          p.activeStock > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {p.activeStock}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">0</span>
          ),
      },
      { key: "active", label: "Active", type: "boolean", width: 80 },
    ],
    [],
  );

  async function handleSave() {
    if (!company || !draft) return;
    if (!draft.name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    const result = await dealerPartnerService.upsert({
      id: draft.id ?? undefined,
      companyId: company.id,
      name: draft.name.trim(),
      phone: draft.phone.trim() || null,
      companyName: draft.companyName.trim() || null,
      email: draft.email.trim() || null,
      companyAddress: draft.companyAddress.trim() || null,
      vatNumber: draft.vatNumber.trim() || null,
      notes: null,
      active: draft.active,
    });
    if (!result) {
      toast.error(
        "Couldn't save — apply migration 0002 (dealer_partners) to the database first.",
      );
      return;
    }
    await reload();
    toast.success(draft.id ? "Dealer partner updated" : "Dealer partner added");
    setDraft(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {partners ? `${partners.length} dealer partners` : "Loading…"}
        </p>
        <Dialog
          open={draft !== null}
          onOpenChange={(o) => {
            if (!o) setDraft(null);
            else if (draft === null) setDraft({ ...EMPTY_PARTNER });
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Add Dealer Partner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {draft?.id ? "Edit Dealer Partner" : "Add Dealer Partner"}
              </DialogTitle>
            </DialogHeader>
            {draft && (
              <div className="grid gap-3">
                <div>
                  <Label>Contact name</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={draft.phone}
                      onChange={(e) =>
                        setDraft({ ...draft, phone: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={draft.email}
                      onChange={(e) =>
                        setDraft({ ...draft, email: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div>
                  <Label>Company name</Label>
                  <Input
                    value={draft.companyName}
                    onChange={(e) =>
                      setDraft({ ...draft, companyName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Company address</Label>
                  <Input
                    value={draft.companyAddress}
                    onChange={(e) =>
                      setDraft({ ...draft, companyAddress: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>VAT number</Label>
                  <Input
                    value={draft.vatNumber}
                    onChange={(e) =>
                      setDraft({ ...draft, vatNumber: e.target.value })
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={draft.active}
                    onCheckedChange={(v) => setDraft({ ...draft, active: v })}
                  />
                  Active
                </label>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!rows ? (
        <DataGridShell>
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              <DataGridSkeletonRows columns={cols} rows={5} />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No dealer partners yet"
          description="Add the trade partners who supply you stock. (Requires database migration 0002.)"
        />
      ) : (
        <DataGridShell>
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              {rows.map((row, i) => (
                <DataGridRow
                  key={row.id}
                  row={row}
                  cols={cols}
                  index={i}
                  onClick={() =>
                    router.push(
                      `/admin/vendors/dealer-partners/${row.id}`,
                    )
                  }
                />
              ))}
              <DataGridFooterRow
                label="New dealer partner"
                span={cols.length}
                onClick={() => setDraft({ ...EMPTY_PARTNER })}
              />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      )}
    </div>
  );
}
