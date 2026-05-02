"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Loader2, Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { warrantyService } from "@/lib/services/warranty-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { claimService } from "@/lib/services/claim-service";
import { downloadBlob, pdfService } from "@/lib/services/pdf-service";
import type { Vehicle, Warranty, WarrantyClaim } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { RegPlate } from "@/components/shared/reg-plate";
import { EmptyState } from "@/components/shared/empty-state";
import {
  formatCurrency,
  formatDate,
  formatRelativeTime,
} from "@/lib/utils";
import { toast } from "sonner";

const claimSchema = z.object({
  issueDescription: z.string().min(1),
  isComplaint: z.boolean(),
  estimatedCost: z.coerce.number().optional(),
});
type ClaimInput = z.input<typeof claimSchema>;
type ClaimOutput = z.output<typeof claimSchema>;

export default function WarrantyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { user, company } = useAuth();
  const [warranty, setWarranty] = useState<Warranty | null | undefined>(undefined);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [generating, setGenerating] = useState(false);
  const [open, setOpen] = useState(false);

  const form = useForm<ClaimInput, unknown, ClaimOutput>({
    resolver: zodResolver(claimSchema),
    defaultValues: {
      issueDescription: "",
      isComplaint: false,
      estimatedCost: undefined,
    },
  });

  useEffect(() => {
    void warrantyService.getById(id).then(async (w) => {
      setWarranty(w);
      if (w) {
        const [v, cs] = await Promise.all([
          vehicleService.getById(w.vehicleId),
          claimService.getForWarranty(w.id),
        ]);
        setVehicle(v);
        setClaims(cs);
      }
    });
  }, [id]);

  async function handleGenerate() {
    if (!warranty || !company) return;
    setGenerating(true);
    try {
      const blob = await pdfService.generateWarrantyCertificate({
        warranty,
        vehicle,
        companyName: company.name,
        companyAddress: company.address,
        vatNumber: company.vatNumber,
      });
      downloadBlob(blob, `warranty-${warranty.id}.pdf`);
      await warrantyService.markCertificateGenerated(warranty.id);
      toast.success("Certificate generated");
    } finally {
      setGenerating(false);
    }
  }

  async function onClaimSubmit(values: ClaimOutput) {
    if (!user || !warranty) return;
    await claimService.create(
      {
        warrantyId: warranty.id,
        vehicleId: warranty.vehicleId,
        companyId: warranty.companyId,
        customerName: warranty.customerName,
        issueDescription: values.issueDescription,
        isComplaint: values.isComplaint,
        estimatedCost: values.estimatedCost ?? null,
      },
      user.id,
    );
    setClaims(await claimService.getForWarranty(warranty.id));
    const fresh = await warrantyService.getById(warranty.id);
    setWarranty(fresh);
    toast.success("Claim opened");
    setOpen(false);
    form.reset();
  }

  if (warranty === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (warranty === null) {
    return (
      <EmptyState
        title="Warranty not found"
        description="It may have been removed."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/warranties">Back to list</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/warranties">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">
              Warranty for {warranty.customerName}
            </h1>
            <Badge variant="outline" className="capitalize">
              {warranty.status}
            </Badge>
          </div>
          {vehicle && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <RegPlate registration={vehicle.registration} size="sm" />
              <span>
                {vehicle.year} {vehicle.make} {vehicle.model}
              </span>
            </div>
          )}
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          Generate Certificate
        </Button>
      </div>

      <Card className="grid gap-x-8 gap-y-3 p-5 sm:grid-cols-2">
        <Field label="Type" capitalize>
          {warranty.type.replace("_", " ")}
        </Field>
        <Field label="Provider">{warranty.provider ?? "—"}</Field>
        <Field label="Coverage" className="sm:col-span-2">
          {warranty.coverageDetails}
        </Field>
        <Field label="Period">
          {formatDate(warranty.startDate)} → {formatDate(warranty.endDate)}
        </Field>
        <Field label="Customer">
          {warranty.customerName} · {warranty.customerPhone}
        </Field>
        <Field label="Email">{warranty.customerEmail ?? "—"}</Field>
        <Field label="Cost to dealership">
          {formatCurrency(warranty.costToDealership)}
        </Field>
        <Field label="Cost to customer">
          {formatCurrency(warranty.costToCustomer)}
        </Field>
        <Field label="Certificate">
          {warranty.certificateGenerated ? "Generated ✓" : "Not generated"}
        </Field>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Claims ({claims.length})</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-4 w-4" /> Open Claim
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Open Claim</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit(onClaimSubmit)}
                className="grid gap-3"
              >
                <div>
                  <Label>Issue description</Label>
                  <Textarea
                    {...form.register("issueDescription")}
                    className="min-h-20"
                    placeholder="e.g. gearbox slipping in second gear"
                  />
                </div>
                <div>
                  <Label>Estimated cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    {...form.register("estimatedCost")}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.watch("isComplaint")}
                    onCheckedChange={(v) => form.setValue("isComplaint", v)}
                  />
                  This is a complaint (not just a claim)
                </label>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Open</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {claims.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No claims for this warranty.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {claims.map((c) => (
              <li
                key={c.id}
                className="rounded-md border bg-background p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{c.issueDescription}</span>
                  <div className="flex items-center gap-2">
                    {c.isComplaint && (
                      <Badge variant="destructive">Complaint</Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {c.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Est. {formatCurrency(c.estimatedCost)} · opened{" "}
                  {formatRelativeTime(c.createdAt)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  className,
  capitalize,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  capitalize?: boolean;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={capitalize ? "capitalize text-sm" : "text-sm"}>
        {children}
      </div>
    </div>
  );
}
