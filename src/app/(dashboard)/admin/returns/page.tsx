"use client";

import { useEffect, useState } from "react";
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
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { RegPlate } from "@/components/shared/reg-plate";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

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

      {!returns ? (
        <Skeleton className="h-72" />
      ) : returns.length === 0 ? (
        <EmptyState
          icon={Undo2}
          title="No returns yet"
          description="Process customer returns and track resolution paths."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Return date</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Resolution</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((r) => {
                const v = vehicles.find((x) => x.id === r.vehicleId);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      {v ? (
                        <RegPlate registration={v.registration} size="sm" />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.customerName}
                    </TableCell>
                    <TableCell>{formatDate(r.returnDate)}</TableCell>
                    <TableCell className="max-w-[260px] truncate">
                      {r.reason}
                    </TableCell>
                    <TableCell className="capitalize">
                      <Badge variant="outline">
                        {r.resolutionPath.replace("_", "-")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(r.refundAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {r.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
