"use client";

import Link from "next/link";
import { Receipt, Car } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { RegPlate } from "@/components/shared/reg-plate";
import { salesStageLabel } from "@/lib/constants";
import type { SalesDeal, User, Vehicle } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Props {
  deal: SalesDeal | null;
  vehicle: Vehicle | null;
  agent: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function stageLabel(stage: SalesDeal["stage"]): string {
  return salesStageLabel(stage);
}

/** One labelled row in the deal sheet; renders nothing when the value is empty. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

/**
 * Read-only summary of a pipeline deal, opened from the pipeline card's
 * customer name. Deals aren't a routed page, so this sheet is their detail
 * view — it links out to the vehicle and to invoice generation.
 */
export function DealDetailSheet({
  deal,
  vehicle,
  agent,
  open,
  onOpenChange,
}: Props) {
  const canInvoice =
    deal?.stage === "deposit_taken" || deal?.stage === "completed_sale";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        {deal && (
          <>
            <SheetHeader>
              <SheetTitle className="flex flex-wrap items-center gap-2">
                {deal.customerName}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {stageLabel(deal.stage)}
                </span>
              </SheetTitle>
              <SheetDescription>
                Deal opened {formatDate(deal.createdAt)}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex flex-col gap-5 px-4 pb-6">
              {/* Vehicle */}
              <section>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Vehicle
                </h3>
                {vehicle ? (
                  <Link
                    href={`/vehicles/${vehicle.id}`}
                    className="flex items-center gap-2 rounded-md border p-2.5 transition-colors hover:bg-muted/40"
                  >
                    <RegPlate registration={vehicle.registration} size="sm" />
                    <span className="text-sm">
                      {vehicle.make} {vehicle.model}
                    </span>
                  </Link>
                ) : (
                  <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Car className="size-4" /> No vehicle linked
                  </p>
                )}
              </section>

              {/* Customer */}
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Customer
                </h3>
                <Row label="Name" value={deal.customerName} />
                <Row label="Phone" value={deal.customerPhone} />
                <Row label="Email" value={deal.customerEmail} />
              </section>

              {/* Deal */}
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Deal
                </h3>
                <Row
                  label="Offer price"
                  value={
                    deal.offerPrice != null
                      ? formatCurrency(deal.offerPrice)
                      : null
                  }
                />
                <Row
                  label="Agreed price"
                  value={
                    deal.agreedPrice != null
                      ? formatCurrency(deal.agreedPrice)
                      : null
                  }
                />
                <Row
                  label="Deposit"
                  value={
                    deal.depositAmount != null
                      ? `${formatCurrency(deal.depositAmount)}${
                          deal.depositDate
                            ? ` · ${formatDate(deal.depositDate)}`
                            : ""
                        }`
                      : null
                  }
                />
                <Row
                  label="Collection"
                  value={
                    deal.collectionDate ? formatDate(deal.collectionDate) : null
                  }
                />
                <Row
                  label="Completed"
                  value={
                    deal.completionDate ? formatDate(deal.completionDate) : null
                  }
                />
                <Row label="Selling agent" value={agent?.name ?? null} />
                <Row label="Notes" value={deal.notes} />
              </section>

              {canInvoice && (
                <Button asChild className="w-full">
                  <Link
                    href={
                      vehicle
                        ? `/sales/invoice-generation?vehicleId=${vehicle.id}`
                        : "/sales/invoice-generation"
                    }
                  >
                    <Receipt className="mr-1.5 h-4 w-4" />
                    Generate Invoice
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
