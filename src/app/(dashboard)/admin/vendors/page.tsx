"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Banknote,
  Briefcase,
  CheckCircle2,
  Handshake,
  Package,
  Plus,
  Store,
  Wrench,
  type LucideIcon,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { cn, formatCurrency } from "@/lib/utils";
import { toast } from "@/lib/toast";

export default function VendorsPage() {
  const searchParams = useSearchParams();
  // SPEC Point 6 (T6.5) — tab persists in the URL across refresh. The active
  // tab is LOCAL state. We deliberately do NOT use router.replace() to switch
  // it: replacing only the ?tab= query on the same route is unreliable in the
  // App Router (it neither updates useSearchParams nor reliably preserves
  // local state), which froze the controlled <Tabs> when going back to
  // Garages. Instead history.replaceState() reflects the tab into the URL
  // bar with zero React/Next re-render, so local state stays authoritative
  // and the switch is instant in both directions.
  const [tab, setTab] = useState<"garages" | "partners">(() =>
    searchParams.get("tab") === "dealer-partners" ? "partners" : "garages",
  );
  // "Add" triggers live on the tab row (parent); each tab opens its own dialog.
  const [garageAdd, setGarageAdd] = useState(false);
  const [partnerAdd, setPartnerAdd] = useState(false);

  function selectTab(v: "garages" | "partners") {
    setTab(v);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        v === "partners"
          ? "/admin/vendors?tab=dealer-partners"
          : "/admin/vendors",
      );
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
        <p className="text-sm text-muted-foreground">
          Your suppliers in one place: the service garages you send work to and
          the trade partners who supply your stock.
        </p>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => selectTab(v as "garages" | "partners")}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="garages">Garages</TabsTrigger>
            <TabsTrigger value="partners">Dealer Partners</TabsTrigger>
          </TabsList>
          {tab === "garages" ? (
            <Button onClick={() => setGarageAdd(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Garage
            </Button>
          ) : (
            <Button onClick={() => setPartnerAdd(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add Dealer Partner
            </Button>
          )}
        </div>
        <TabsContent value="garages" className="mt-4">
          <GaragesTab addOpen={garageAdd} setAddOpen={setGarageAdd} />
        </TabsContent>
        <TabsContent value="partners" className="mt-4">
          <DealerPartnersTab addOpen={partnerAdd} setAddOpen={setPartnerAdd} />
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

function GaragesTab({
  addOpen,
  setAddOpen,
}: {
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
}) {
  const { company } = useAuth();
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [maintJobs, setMaintJobs] = useState<MaintenanceJob[]>([]);
  const [draft, setDraft] = useState<DraftVendor | null>(null);
  const [loadError, setLoadError] = useState(false);

  // The "Add Garage" trigger lives on the tab row (parent); open the draft here.
  useEffect(() => {
    if (addOpen) setDraft({ ...EMPTY_VENDOR });
  }, [addOpen]);

  const load = useCallback(async () => {
    if (!company) return;
    setLoadError(false);
    try {
      const [v, m] = await Promise.all([
        vendorService.getAll(company.id),
        maintenanceService.getAll(company.id),
      ]);
      setVendors(v);
      setMaintJobs(m);
    } catch {
      // No catch here previously: any failed/slow read left the tab on an
      // infinite skeleton. Surface a retry instead.
      setVendors(null);
      setLoadError(true);
    }
  }, [company]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo<VendorRow[] | null>(() => {
    if (!vendors) return null;
    const stats = new Map<string, { activeCount: number; totalSpent: number }>();
    for (const v of vendors) stats.set(v.id, { activeCount: 0, totalSpent: 0 });
    for (const j of maintJobs) {
      if (!j.vendorId) continue;
      const sct = stats.get(j.vendorId);
      if (!sct) continue;
      if (j.status !== "completed") sct.activeCount++;
      // "Total spent" is realised cost only: sum actualCost for completed
      // jobs. In-progress estimates aren't money spent and would inflate the
      // figure (and change it when jobs later complete).
      if (j.status === "completed") sct.totalSpent += j.actualCost ?? 0;
    }
    return vendors.map((v) => ({
      ...v,
      activeCount: stats.get(v.id)?.activeCount ?? 0,
      totalSpent: stats.get(v.id)?.totalSpent ?? 0,
    }));
  }, [vendors, maintJobs]);

  const stats = useMemo(() => {
    const activeJobs = rows?.reduce((a, r) => a + r.activeCount, 0) ?? 0;
    const totalSpent = rows?.reduce((a, r) => a + r.totalSpent, 0) ?? 0;
    const specialities = new Set(vendors?.map((v) => v.speciality)).size;
    const activeGarages = vendors?.filter((v) => v.active).length ?? 0;
    return { activeJobs, totalSpent, specialities, activeGarages };
  }, [rows, vendors]);

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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Wrench}
          label="Garages"
          value={vendors ? String(vendors.length) : "—"}
          sub={`${stats.activeGarages} active`}
        />
        <KpiCard
          icon={Briefcase}
          label="Active jobs"
          value={String(stats.activeJobs)}
          sub="in progress"
        />
        <KpiCard
          icon={Banknote}
          label="Total spent"
          value={formatCurrency(stats.totalSpent)}
          sub="all-time"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Specialities"
          value={String(stats.specialities)}
          sub="covered"
        />
      </div>

      <Dialog
        open={draft !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDraft(null);
            setAddOpen(false);
          }
        }}
      >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{draft?.id ? "Edit Garage" : "Add Garage"}</DialogTitle>
            </DialogHeader>
            {draft && (
              <div className="grid gap-3 px-6 pb-6">
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

      {loadError && !rows ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load garages.
          </p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      ) : !rows ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No garages yet"
          description="Add the garages and parts suppliers you work with."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm [&_td]:border-r [&_td]:border-border [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-border [&_th:last-child]:border-r-0">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Phone</th>
                <th className="px-3 py-2.5 font-medium">Speciality</th>
                <th className="px-3 py-2.5 text-right font-medium">Active jobs</th>
                <th className="px-3 py-2.5 text-right font-medium">Total spent</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() =>
                    setDraft({
                      id: row.id,
                      name: row.name,
                      phone: row.phone,
                      speciality: row.speciality,
                      active: row.active,
                    })
                  }
                  className="cursor-pointer border-b border-border hover:bg-muted/50"
                >
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={row.name} />
                      <span className="font-medium">{row.name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {row.phone || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <SpecChip s={row.speciality} />
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.activeCount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums">
                    {formatCurrency(row.totalSpent)}
                  </td>
                  <td className="px-3 py-2.5">
                    <ActiveDot active={row.active} />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={6} className="border-t border-border">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...EMPTY_VENDOR })}
                    className="flex w-full items-center justify-center gap-1.5 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" /> New garage
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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

function DealerPartnersTab({
  addOpen,
  setAddOpen,
}: {
  addOpen: boolean;
  setAddOpen: (v: boolean) => void;
}) {
  const { company } = useAuth();
  const router = useRouter();
  const [partners, setPartners] = useState<DealerPartner[] | null>(null);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [draft, setDraft] = useState<DraftPartner | null>(null);
  const [loadError, setLoadError] = useState(false);

  // The "Add Dealer Partner" trigger lives on the tab row (parent).
  useEffect(() => {
    if (addOpen) setDraft({ ...EMPTY_PARTNER });
  }, [addOpen]);

  const reload = useCallback(async () => {
    if (!company) return;
    setLoadError(false);
    try {
      const [p, c] = await Promise.all([
        dealerPartnerService.getAll(company.id),
        dealerPartnerService.activeStockCounts(company.id),
      ]);
      setPartners(p);
      setCounts(c);
    } catch {
      setPartners(null);
      setLoadError(true);
    }
  }, [company]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const rows = useMemo<PartnerRow[] | null>(() => {
    if (!partners) return null;
    return partners.map((p) => ({
      ...p,
      activeStock: counts.get(p.id) ?? 0,
    }));
  }, [partners, counts]);

  const stats = useMemo(() => {
    const activeStock = rows?.reduce((a, r) => a + r.activeStock, 0) ?? 0;
    const activeCount = partners?.filter((p) => p.active).length ?? 0;
    const companies = new Set(
      partners?.map((p) => p.companyName).filter(Boolean),
    ).size;
    return { activeStock, activeCount, companies };
  }, [rows, partners]);

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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Store}
          label="Dealer partners"
          value={partners ? String(partners.length) : "—"}
          sub={`${stats.activeCount} active`}
        />
        <KpiCard
          icon={Package}
          label="Active stock"
          value={String(stats.activeStock)}
          sub="listed"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Active"
          value={String(stats.activeCount)}
          sub={partners ? `of ${partners.length}` : "—"}
        />
        <KpiCard
          icon={Handshake}
          label="Companies"
          value={String(stats.companies)}
          sub="linked"
        />
      </div>

      <Dialog
        open={draft !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDraft(null);
            setAddOpen(false);
          }
        }}
      >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {draft?.id ? "Edit Dealer Partner" : "Add Dealer Partner"}
              </DialogTitle>
            </DialogHeader>
            {draft && (
              <div className="grid gap-3 px-6 pb-6">
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

      {loadError && !rows ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load dealer partners.
          </p>
          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : !rows ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="No dealer partners yet"
          description="Add the trade partners who supply you stock. (Requires database migration 0002.)"
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] border-collapse text-sm [&_td]:border-r [&_td]:border-border [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:border-border [&_th:last-child]:border-r-0">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-xs text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Contact</th>
                <th className="px-3 py-2.5 font-medium">Phone</th>
                <th className="px-3 py-2.5 font-medium">Company</th>
                <th className="px-3 py-2.5 text-right font-medium">Active stock</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() =>
                    router.push(`/admin/vendors/dealer-partners/${row.id}`)
                  }
                  className="cursor-pointer border-b border-border hover:bg-muted/50"
                >
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={row.companyName || row.name} />
                      <span className="font-medium">{row.name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {row.phone || "—"}
                  </td>
                  <td className="px-3 py-2.5">{row.companyName || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {row.activeStock}
                  </td>
                  <td className="px-3 py-2.5">
                    <ActiveDot active={row.active} />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="border-t border-border">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...EMPTY_PARTNER })}
                    className="flex w-full items-center justify-center gap-1.5 px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" /> New dealer partner
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Variation A shared helpers
// ────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

const SPEC_CLS: Record<string, string> = {
  mechanical: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  general: "bg-muted text-foreground/75",
  electrical:
    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  tyres: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
  bodywork:
    "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  mot: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
};

function SpecChip({ s }: { s: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide",
        SPEC_CLS[s] ?? "bg-muted text-foreground/75",
      )}
    >
      {s}
    </span>
  );
}

function ActiveDot({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />{" "}
      Inactive
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    ? name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
      {initials}
    </span>
  );
}
