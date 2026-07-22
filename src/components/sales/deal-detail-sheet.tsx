"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Receipt, Car, Loader2, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RegPlate } from "@/components/shared/reg-plate";
import { salesStageLabel } from "@/lib/constants";
import { useAuth } from "@/contexts/auth-context";
import { dealNoteService } from "@/lib/services/deal-note-service";
import type { DealNote, SalesDeal, User, Vehicle } from "@/lib/types";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";

interface Props {
  deal: SalesDeal | null;
  vehicle: Vehicle | null;
  agent: User | null;
  /** Company staff, for resolving note authors — reuse the caller's already-
   *  loaded list (GEN-70) rather than re-fetching every time the sheet opens. */
  users: User[];
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
  users,
  open,
  onOpenChange,
}: Props) {
  const { user } = useAuth();
  const canInvoice =
    deal?.stage === "deposit_taken" || deal?.stage === "completed_sale";

  const [notes, setNotes] = useState<DealNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!deal || !open) return;
    void dealNoteService.getForDeal(deal.id).then(setNotes);
  }, [deal, open]);

  async function handleAddNote() {
    if (!user || !deal || !newNote.trim()) return;
    setSavingNote(true);
    try {
      // GEN-70: append the row `add` already returns instead of a second
      // round trip to re-fetch the whole list — the note now appears the
      // instant the write completes.
      const note = await dealNoteService.add({
        dealId: deal.id,
        userId: user.id,
        content: newNote.trim(),
      });
      setNotes((prev) => [...prev, note]);
      setNewNote("");
    } finally {
      setSavingNote(false);
    }
  }

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
              </section>

              {/* Notes — timestamped, attributed running log (GEN-74) */}
              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Notes
                  </h3>
                  <span className="text-2xs text-muted-foreground">
                    {notes.length} note{notes.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note, e.g. offered £500 discount"
                    className="min-h-16 text-sm"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleAddNote}
                      disabled={savingNote || !newNote.trim()}
                    >
                      {savingNote ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="mr-1 h-3 w-3" />
                      )}
                      Add Note
                    </Button>
                  </div>
                </div>
                {notes.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2 border-t pt-3">
                    {[...notes].reverse().map((n) => {
                      const author = users.find((u) => u.id === n.userId);
                      return (
                        <div
                          key={n.id}
                          className="rounded border bg-muted/30 p-2.5 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">
                              {author?.name ?? "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 whitespace-pre-wrap">
                            {n.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
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
