/**
 * Running balance for an invoice paid off over time (GEN-73).
 *
 * Pure on purpose: this decides when a sale is considered settled, which then
 * triggers the completion chain (vehicle sold, listing closed, warranty
 * issued). It must be checkable without a database.
 */

/** Money actually received against an invoice. */
export interface Receipt {
  id: string;
  amount: number;
  paidOn: string;
  method: string | null;
  reference: string | null;
}

export interface BalanceState {
  /** Invoice grand total, including add-ons and VAT. */
  grandTotal: number;
  /** Deposit recorded on the invoice itself. */
  deposit: number;
  /** Finance being settled by a third party. */
  finance: number;
  /** Sum of every receipt logged against the invoice. */
  received: number;
  /** deposit + finance + received. */
  paid: number;
  /** What's left to collect. Never negative. */
  balanceDue: number;
  /** Paid more than the total — flagged rather than silently absorbed. */
  overpaid: boolean;
  /** By how much, when overpaid. */
  overpaidBy: number;
  /** True once nothing is outstanding. */
  settled: boolean;
}

/** Round to pennies. Float drift must never decide whether a sale completed. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeBalance(input: {
  grandTotal: number;
  deposit?: number | null;
  finance?: number | null;
  receipts?: Pick<Receipt, "amount">[];
}): BalanceState {
  const grandTotal = round2(input.grandTotal || 0);
  const deposit = round2(input.deposit ?? 0);
  const finance = round2(input.finance ?? 0);
  const received = round2(
    (input.receipts ?? []).reduce((sum, r) => sum + (r.amount || 0), 0),
  );
  const paid = round2(deposit + finance + received);
  const rawBalance = round2(grandTotal - paid);

  return {
    grandTotal,
    deposit,
    finance,
    received,
    paid,
    balanceDue: Math.max(0, rawBalance),
    overpaid: rawBalance < 0,
    overpaidBy: rawBalance < 0 ? round2(-rawBalance) : 0,
    // A zero-total invoice isn't "settled" by having had nothing paid on it —
    // that would mark an empty draft as paid the moment it's created.
    settled: grandTotal > 0 && rawBalance <= 0,
  };
}

/**
 * Does recording this payment settle the invoice?
 *
 * Separate from `computeBalance` so the caller can decide *before* writing
 * whether the sale-completion chain is about to fire.
 */
export function wouldSettle(
  current: BalanceState,
  paymentAmount: number,
): boolean {
  return (
    current.grandTotal > 0 &&
    round2(current.paid + paymentAmount) >= current.grandTotal
  );
}
