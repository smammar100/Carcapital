"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  ExternalLink as ExternalLinkIcon,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { warrantyService } from "@/lib/services/warranty-service";
import { vehicleService } from "@/lib/services/vehicle-service";
import { claimService } from "@/lib/services/claim-service";
import { invoiceService } from "@/lib/services/invoice-service";
import { teamService } from "@/lib/services/team-service";
import { vehicleDetailHref } from "@/lib/vehicle-nav";
import type {
  Invoice,
  User,
  Vehicle,
  Warranty,
  WarrantyClaim,
} from "@/lib/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { RegPlate } from "@/components/shared/reg-plate";
import { StatusPill } from "./status-pill";
import { ProviderBadge } from "./provider-badge";
import { MarkPurchasedDialog } from "./mark-purchased-dialog";
import { NewClaimDialog } from "./new-claim-dialog";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

interface WarrantyDetailSheetProps {
  warranty: Warranty | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

function daysRemaining(endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round(
    (new Date(endDate).getTime() - today.getTime()) / 86_400_000,
  );
}

export function WarrantyDetailSheet({
  warranty,
  onOpenChange,
  onChanged,
}: WarrantyDetailSheetProps) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const pathname = usePathname();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [claims, setClaims] = useState<WarrantyClaim[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [markPurchasedOpen, setMarkPurchasedOpen] = useState(false);
  const [fileClaimOpen, setFileClaimOpen] = useState(false);

  const open = warranty !== null;

  useEffect(() => {
    if (!warranty) return;
    void Promise.all([
      vehicleService.getById(warranty.vehicleId),
      claimService.getForWarranty(warranty.id),
      teamService.getAll(warranty.companyId),
      // Warranties issued by closing a sales invoice link back to it (GEN-66).
      warranty.invoiceId
        ? invoiceService.getById(warranty.invoiceId)
        : Promise.resolve(null),
    ]).then(([v, c, u, inv]) => {
      setVehicle(v);
      setClaims(c);
      setUsers(u);
      setInvoice(inv);
    });
  }, [warranty?.id]);

  const purchaserName = useMemo(() => {
    if (!warranty?.purchasedBy) return null;
    return users.find((u) => u.id === warranty.purchasedBy)?.name ?? null;
  }, [warranty?.purchasedBy, users]);

  const canEdit = can("warranty:edit");

  if (!warranty) return null;

  const remaining = daysRemaining(warranty.endDate);
  const margin =
    warranty.type === "external"
      ? warranty.costToCustomer - warranty.costToDealership
      : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex w-full flex-col gap-0 p-0 sm:max-w-[480px]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <SheetTitle className="text-base font-semibold">
                {warranty.type === "external" ? "External" : "In-house"} warranty
              </SheetTitle>
              <span className="truncate text-xs text-muted-foreground">
                {warranty.customerName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={warranty.status} />
              <button
                type="button"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-3">
              {/* Vehicle */}
              <Card className="flex flex-col gap-2 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vehicle
                </h4>
                {vehicle ? (
                  <Link
                    href={vehicleDetailHref(vehicle.id, pathname)}
                    className="flex items-center justify-between gap-2 rounded-md transition-colors hover:bg-accent/40"
                  >
                    <div className="flex items-center gap-2">
                      <RegPlate
                        registration={vehicle.registration}
                        size="sm"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Stock {vehicle.stockId}
                        </span>
                      </div>
                    </div>
                    <ExternalLinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                ) : (
                  <Skeleton className="h-10" />
                )}
              </Card>

              {/* Customer */}
              <Card className="flex flex-col gap-1 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Customer
                </h4>
                <div className="text-sm font-medium">{warranty.customerName}</div>
                <div className="text-xs text-muted-foreground">
                  {warranty.customerPhone}
                  {warranty.customerEmail && ` · ${warranty.customerEmail}`}
                </div>
              </Card>

              {/* Coverage */}
              <Card className="flex flex-col gap-2 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Coverage
                </h4>
                <div className="flex items-center justify-between">
                  <ProviderBadge provider={warranty.provider} />
                  <span
                    className={cn(
                      "text-xs",
                      remaining < 0
                        ? "text-destructive"
                        : remaining < 30
                          ? "text-amber-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {remaining < 0
                      ? `Expired ${-remaining}d ago`
                      : `${remaining}d remaining`}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(warranty.startDate)} →{" "}
                  {formatDate(warranty.endDate)}
                </div>
                <p className="text-sm">{warranty.coverageDetails}</p>
                {/* Where this cover came from. Warranties issued by closing a
                    sales invoice link straight back to it (GEN-66); ones
                    raised by hand in this module have no invoice. */}
                {invoice ? (
                  <Link
                    href={`/sales/invoice-generation?invoiceId=${invoice.id}`}
                    className="flex items-center justify-between gap-2 rounded-md text-xs text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
                  >
                    <span>
                      Issued by invoice{" "}
                      <span className="font-medium">
                        {invoice.invoiceNumber}
                      </span>
                    </span>
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </Card>

              {/* Pricing */}
              <Card className="flex flex-col gap-1 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pricing
                </h4>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Cost to customer</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(warranty.costToCustomer)}
                  </span>
                </div>
                {warranty.type === "external" && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Cost to dealership
                      </span>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(warranty.costToDealership)}
                      </span>
                    </div>
                    {warranty.amountPaid != null && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Amount paid to provider
                        </span>
                        <span className="font-medium tabular-nums">
                          {formatCurrency(warranty.amountPaid)}
                        </span>
                      </div>
                    )}
                    {margin !== null && (
                      <div className="flex items-center justify-between border-t pt-1 text-sm">
                        <span className="text-muted-foreground">Margin</span>
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            margin < 0 && "text-destructive",
                          )}
                        >
                          {formatCurrency(margin)}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </Card>

              {/* Purchase status — external only */}
              {warranty.type === "external" && (
                <Card
                  className={cn(
                    "flex flex-col gap-2 p-3",
                    warranty.purchaseStatus === "pending" &&
                      "border-amber-400/60 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/5",
                  )}
                >
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Purchase status
                  </h4>
                  {warranty.purchaseStatus === "pending" ? (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span>This warranty hasn&apos;t been bought from the provider yet.</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="self-start"
                        disabled={!canEdit}
                        onClick={() => setMarkPurchasedOpen(true)}
                        title={
                          canEdit
                            ? undefined
                            : "Requires Warranty Edit capability"
                        }
                      >
                        Mark purchased
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-col gap-1 text-sm">
                      <StatusPill status="purchased" />
                      {warranty.purchasedAt && (
                        <span className="text-xs text-muted-foreground">
                          Bought {formatDate(warranty.purchasedAt)}
                          {purchaserName && ` by ${purchaserName}`}
                        </span>
                      )}
                      {warranty.providerReference && (
                        <span className="text-xs text-muted-foreground">
                          Ref {warranty.providerReference}
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              )}

              {/* Claims */}
              <Card className="flex flex-col gap-2 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Claims ({claims.length})
                </h4>
                {claims.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No claims filed against this warranty.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {claims.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-start justify-between gap-2 rounded-md border bg-card p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">
                            {c.issueDescription}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(c.createdAt)}
                            {c.isComplaint && " · Complaint"}
                          </span>
                        </div>
                        <StatusPill status={c.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-2 border-t bg-background px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFileClaimOpen(true)}
              disabled={warranty.status !== "active"}
              title={
                warranty.status !== "active"
                  ? "Can only file claims on active warranties"
                  : undefined
              }
            >
              <ShieldAlert className="mr-1.5 h-4 w-4" />
              File claim
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmCancelOpen(true)}
              disabled={!canEdit || warranty.status === "cancelled"}
              title={
                !canEdit
                  ? "Requires Warranty Edit capability"
                  : warranty.status === "cancelled"
                    ? "Already cancelled"
                    : undefined
              }
            >
              <Ban className="mr-1.5 h-4 w-4" />
              Cancel warranty
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirm cancel — uses Dialog since alert-dialog isn't in the ui set */}
      <CancelConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        warranty={warranty}
        actorId={user?.id ?? null}
        onCancelled={() => {
          setConfirmCancelOpen(false);
          onOpenChange(false);
          onChanged?.();
        }}
      />

      {/* Mark purchased dialog */}
      <MarkPurchasedDialog
        open={markPurchasedOpen}
        onOpenChange={setMarkPurchasedOpen}
        warranty={warranty}
        onMarked={() => {
          setMarkPurchasedOpen(false);
          onChanged?.();
        }}
      />

      {/* File claim dialog with warranty prefilled */}
      <NewClaimDialog
        open={fileClaimOpen}
        onOpenChange={setFileClaimOpen}
        warrantyId={warranty.id}
        onCreated={() => {
          setFileClaimOpen(false);
          onChanged?.();
        }}
      />
    </>
  );
}

function CancelConfirmDialog({
  open,
  onOpenChange,
  warranty,
  actorId,
  onCancelled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warranty: Warranty;
  actorId: string | null;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (!actorId) return;
    setSubmitting(true);
    try {
      await warrantyService.cancel(warranty.id, actorId, reason || undefined);
      toast.success("Warranty cancelled");
      setReason("");
      onCancelled();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel this warranty?</DialogTitle>
          <DialogDescription>
            This sets the warranty status to <strong>cancelled</strong>. Existing
            claims keep their state. The action is logged.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label className="text-sm font-medium">Reason (optional)</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being cancelled?"
            className="mt-1 min-h-20"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Keep warranty
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={confirm}
            disabled={submitting}
          >
            {submitting ? "Cancelling…" : "Cancel warranty"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
