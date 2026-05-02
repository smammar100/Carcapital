"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { warrantyService } from "@/lib/services/warranty-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { claimService } from "@/lib/services/claim-service";
import type {
  Vehicle,
  Warranty,
  WarrantyClaim,
  WarrantyStatus,
} from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
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

const STATUS_TABS: { value: WarrantyStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "claimed", label: "Claimed" },
  { value: "cancelled", label: "Cancelled" },
];

const schema = z.object({
  vehicleId: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  customerEmail: z.string().optional(),
  type: z.enum(["in_house", "third_party"]),
  provider: z.string().optional(),
  coverageDetails: z.string().min(1),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  costToDealership: z.coerce.number().min(0).default(0),
  costToCustomer: z.coerce.number().min(0).default(0),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export default function WarrantiesPage() {
  const { user, company } = useAuth();
  const [warranties, setWarranties] = useState<Warranty[] | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [tab, setTab] = useState<WarrantyStatus | "all">("all");
  const [open, setOpen] = useState(false);

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicleId: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      type: "in_house",
      provider: "",
      coverageDetails: "3-month engine and gearbox cover",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      costToDealership: 0,
      costToCustomer: 0,
    },
  });

  useEffect(() => {
    if (!company) return;
    void Promise.all([
      warrantyService.getAll(company.id),
      vehicleService.getAll(company.id),
      claimService.getAll(company.id),
    ]).then(([w, v, c]) => {
      setWarranties(w);
      setVehicles(v);
      setClaims(c);
    });
  }, [company]);

  const filtered = useMemo(() => {
    if (!warranties) return null;
    if (tab === "all") return warranties;
    return warranties.filter((w) => w.status === tab);
  }, [warranties, tab]);

  const watchType = form.watch("type");

  async function onSubmit(values: FormOutput) {
    if (!user || !company) return;
    await warrantyService.create(
      {
        companyId: company.id,
        vehicleId: values.vehicleId,
        saleDealId: null,
        customerName: values.customerName,
        customerPhone: values.customerPhone,
        customerEmail: values.customerEmail || null,
        type: values.type,
        provider: values.type === "third_party" ? values.provider || null : null,
        coverageDetails: values.coverageDetails,
        startDate: values.startDate,
        endDate: values.endDate,
        costToDealership: values.costToDealership,
        costToCustomer: values.costToCustomer,
      },
      user.id,
    );
    setWarranties(await warrantyService.getAll(company.id));
    toast.success("Warranty created");
    setOpen(false);
    form.reset();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Warranties</h1>
          <p className="text-sm text-muted-foreground">
            {filtered ? `${filtered.length} matching` : "Loading…"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-1.5 h-4 w-4" />
              Create Warranty
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Warranty</DialogTitle>
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
              <div>
                <Label>Email</Label>
                <Input type="email" {...form.register("customerEmail")} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Type</Label>
                  <Select
                    value={form.watch("type")}
                    onValueChange={(v) =>
                      form.setValue("type", v as "in_house" | "third_party")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_house">In-house</SelectItem>
                      <SelectItem value="third_party">Third-party</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {watchType === "third_party" && (
                  <div>
                    <Label>Provider</Label>
                    <Input
                      {...form.register("provider")}
                      placeholder="AA Warranty"
                    />
                  </div>
                )}
              </div>
              <div>
                <Label>Coverage details</Label>
                <Textarea {...form.register("coverageDetails")} className="min-h-16" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Start date</Label>
                  <Input type="date" {...form.register("startDate")} />
                </div>
                <div>
                  <Label>End date</Label>
                  <Input type="date" {...form.register("endDate")} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Cost to dealership</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register("costToDealership")}
                  />
                </div>
                <div>
                  <Label>Cost to customer</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register("costToCustomer")}
                  />
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
                <Button type="submit">Create</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as WarrantyStatus | "all")}
      >
        <TabsList>
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {!filtered ? (
        <Skeleton className="h-72" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No warranties in this view"
          description="Switch tabs or create a new warranty."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Claims</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((w) => {
                const v = vehicles.find((x) => x.id === w.vehicleId);
                const claimCount = claims.filter(
                  (c) => c.warrantyId === w.id,
                ).length;
                return (
                  <TableRow key={w.id}>
                    <TableCell>
                      {v ? (
                        <RegPlate registration={v.registration} size="sm" />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {w.customerName}
                    </TableCell>
                    <TableCell className="capitalize">
                      {w.type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {w.provider ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(w.startDate)} → {formatDate(w.endDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {w.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {claimCount > 0 ? (
                        <Badge variant="destructive">{claimCount}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/warranties/${w.id}`}>Open</Link>
                      </Button>
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
