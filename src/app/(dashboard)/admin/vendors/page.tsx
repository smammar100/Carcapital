"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Store } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { vendorService } from "@/lib/services/vendor-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import { todoService } from "@/lib/services/todo-service";
import type {
  MaintenanceJob,
  TodoItem,
  Vendor,
  VendorSpeciality,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

const EMPTY_DRAFT: DraftVendor = {
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

export default function VendorsPage() {
  const { company } = useAuth();
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [maintJobs, setMaintJobs] = useState<MaintenanceJob[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [draft, setDraft] = useState<DraftVendor | null>(null);

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      vendorService.getAll(company.id),
      maintenanceService.getAll(company.id),
    ]).then(async ([v, m]) => {
      setVendors(v);
      setMaintJobs(m);
      setTodos([]);
    });
    void todoService;
  }, [company]);

  const rows = useMemo<VendorRow[] | null>(() => {
    if (!vendors) return null;
    const stats = new Map<string, { activeCount: number; totalSpent: number }>();
    for (const v of vendors) stats.set(v.id, { activeCount: 0, totalSpent: 0 });
    for (const j of maintJobs) {
      if (!j.vendorId) continue;
      const s = stats.get(j.vendorId);
      if (!s) continue;
      if (j.status !== "completed") s.activeCount++;
      s.totalSpent += j.actualCost ?? j.estimatedCost ?? 0;
    }
    for (const t of todos) {
      if (!t.vendorId) continue;
      const s = stats.get(t.vendorId);
      if (!s) continue;
      s.totalSpent += t.cost ?? 0;
    }
    return vendors.map((v) => ({
      ...v,
      activeCount: stats.get(v.id)?.activeCount ?? 0,
      totalSpent: stats.get(v.id)?.totalSpent ?? 0,
    }));
  }, [vendors, maintJobs, todos]);

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
      {
        key: "totalSpent",
        label: "Total spent",
        type: "currency",
        width: 130,
      },
      { key: "active", label: "Active", type: "boolean", width: 80 },
    ],
    [],
  );

  function openEdit(v: VendorRow) {
    setDraft({
      id: v.id,
      name: v.name,
      phone: v.phone,
      speciality: v.speciality,
      active: v.active,
    });
  }

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
    toast.success(draft.id ? "Vendor updated" : "Vendor added");
    setDraft(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            {vendors ? `${vendors.length} suppliers` : "Loading…"}
          </p>
        </div>
        <Dialog
          open={draft !== null}
          onOpenChange={(o) => {
            if (!o) setDraft(null);
            else if (draft === null) setDraft({ ...EMPTY_DRAFT });
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Add Vendor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {draft?.id ? "Edit Vendor" : "Add Vendor"}
              </DialogTitle>
            </DialogHeader>
            {draft && (
              <div className="grid gap-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </div>
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
                      {SPECIALITIES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
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
        // Row-aware skeleton that matches the table's column structure.
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
          title="No vendors yet"
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
                  onClick={openEdit}
                />
              ))}
              <DataGridFooterRow
                label="New vendor"
                span={cols.length}
                onClick={() => setDraft({ ...EMPTY_DRAFT })}
              />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      )}
    </div>
  );
}
