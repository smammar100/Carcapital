"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Undo2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { returnService } from "@/lib/services/return-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import type {
  ReturnResolutionPath,
  Vehicle,
  VehicleReturn,
} from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DataGridTable,
  VehicleCell,
} from "@/components/data-grid";
import { toast } from "sonner";

interface ReturnRow extends VehicleReturn {
  vehicle: Vehicle | null;
}

const PATHS: { value: ReturnResolutionPath; label: string }[] = [
  { value: "vendor", label: "Vendor" },
  { value: "supplier", label: "Supplier" },
  { value: "g_trader", label: "G-Trader" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  vehicleId: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  returnDate: z.string().min(1),
  reason: z.string().min(1),
  resolutionPath: z.enum(["vendor", "supplier", "g_trader", "other"]),
  resolutionNotes: z.string().optional(),
  refundAmount: z.coerce.number().optional(),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export default function ReturnsPage() {
  const { user, company } = useAuth();
  const [returns, setReturns] = useState<VehicleReturn[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [open, setOpen] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleId: "",
      customerName: "",
      customerPhone: "",
      returnDate: new Date().toISOString().slice(0, 10),
      reason: "",
      resolutionPath: "g_trader",
      resolutionNotes: "",
      refundAmount: undefined,
    },
  });

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      returnService.getAll(company.id),
      vehicleService.getAll(company.id),
    ]).then(([r, v]) => {
      setReturns(r);
      setVehicles(v);
    });
  }, [company]);

  const rows = useMemo<ReturnRow[] | null>(() => {
    if (!returns) return null;
    return returns.map((r) => ({
      ...r,
      vehicle: vehicles.find((v) => v.id === r.vehicleId) ?? null,
    }));
  }, [returns, vehicles]);

  const cols = useMemo<ColumnDef<ReturnRow>[]>(
    () => [
      {
        key: "vehicle",
        label: "Vehicle",
        type: "vehicle",
        sticky: true,
        width: 200,
        render: (r) => <VehicleCell vehicle={r.vehicle} />,
      },
      { key: "customerName", label: "Customer", type: "text", width: 160 },
      { key: "customerPhone", label: "Phone", type: "phone", width: 140 },
      { key: "returnDate", label: "Return date", type: "date", width: 130 },
      { key: "reason", label: "Reason", type: "text", width: 240 },
      {
        key: "resolutionPath",
        label: "Resolution",
        type: "returnResolution",
        width: 130,
      },
      { key: "refundAmount", label: "Refund", type: "currency", width: 120 },
      { key: "status", label: "Status", type: "returnStatus", width: 130 },
    ],
    [],
  );

  async function onSubmit(values: FormOutput) {
    if (!user || !company) return;
    await returnService.create(
      {
        companyId: company.id,
        vehicleId: values.vehicleId,
        saleDealId: null,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        returnDate: values.returnDate,
        reason: values.reason,
        resolutionPath: values.resolutionPath,
        resolutionNotes: values.resolutionNotes || null,
        refundAmount: values.refundAmount ?? null,
      },
      user.id,
    );
    setReturns(await returnService.getAll(company.id));
    setVehicles(await vehicleService.getAll(company.id));
    toast.success("Return processed — vehicle status flipped to returned");
    setOpen(false);
    form.reset();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vehicle Returns</h1>
          <p className="text-sm text-muted-foreground">
            Customer returns and the resolution path used.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" /> Create Return
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Return</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
              <div>
                <Label>Sold vehicle</Label>
                <Select
                  value={form.watch("vehicleId")}
                  onValueChange={(v) => form.setValue("vehicleId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a sold vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles
                      .filter((v) => v.status === "sold")
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.registration} — {v.make} {v.model}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Customer name</Label>
                  <Input {...form.register("customerName")} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input {...form.register("customerPhone")} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Return date</Label>
                  <Input type="date" {...form.register("returnDate")} />
                </div>
                <div>
                  <Label>Refund (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register("refundAmount")}
                  />
                </div>
              </div>
              <div>
                <Label>Reason</Label>
                <Textarea {...form.register("reason")} className="min-h-16" />
              </div>
              <div>
                <Label>Resolution path</Label>
                <Select
                  value={form.watch("resolutionPath")}
                  onValueChange={(v) =>
                    form.setValue("resolutionPath", v as ReturnResolutionPath)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PATHS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Resolution notes</Label>
                <Textarea
                  {...form.register("resolutionNotes")}
                  className="min-h-16"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Process return</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!rows ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Undo2}
          title="No returns yet"
          description="Process customer returns and track resolution paths."
        />
      ) : (
        <DataGridShell>
          <DataGridTable cols={cols}>
            <DataGridHeaderRow cols={cols} />
            <tbody>
              {rows.map((r, i) => (
                <DataGridRow key={r.id} row={r} cols={cols} index={i} />
              ))}
              <DataGridFooterRow
                label="New return"
                span={cols.length}
                onClick={() => setOpen(true)}
              />
            </tbody>
          </DataGridTable>
        </DataGridShell>
      )}
    </div>
  );
}
