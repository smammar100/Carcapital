/**
 * GEN-73 — an invoice paid off over time.
 *
 * The UAT case is concrete: an £11,850 invoice takes a £500 deposit and must
 * then read £11,350 outstanding, not £0 and not the full amount. These pin
 * that and the arithmetic around it, because this is what decides when a sale
 * is treated as complete.
 */
import { describe, expect, it } from "vitest";
import { computeBalance, wouldSettle } from "./invoice-balance";

describe("computeBalance — the UAT scenario", () => {
  it("a £500 deposit against £11,850 leaves £11,350 (case 1)", () => {
    const b = computeBalance({ grandTotal: 11850, deposit: 500 });
    expect(b.balanceDue).toBe(11350);
    expect(b.paid).toBe(500);
    expect(b.settled).toBe(false);
  });

  it("a second payment moves the balance again (case 2)", () => {
    const b = computeBalance({
      grandTotal: 11850,
      deposit: 500,
      receipts: [{ amount: 1000 }],
    });
    expect(b.received).toBe(1000);
    expect(b.balanceDue).toBe(10350);
    expect(b.settled).toBe(false);
  });

  it("paying the rest settles it at exactly £0 (case 3)", () => {
    const b = computeBalance({
      grandTotal: 11850,
      deposit: 500,
      receipts: [{ amount: 1000 }, { amount: 10350 }],
    });
    expect(b.balanceDue).toBe(0);
    expect(b.settled).toBe(true);
    expect(b.overpaid).toBe(false);
  });
});

describe("computeBalance — finance", () => {
  it("counts finance toward the balance", () => {
    const b = computeBalance({ grandTotal: 11850, deposit: 500, finance: 11350 });
    expect(b.balanceDue).toBe(0);
    expect(b.settled).toBe(true);
  });

  it("deposit + finance + receipts all net off together", () => {
    const b = computeBalance({
      grandTotal: 20000,
      deposit: 1000,
      finance: 15000,
      receipts: [{ amount: 2000 }, { amount: 500 }],
    });
    expect(b.paid).toBe(18500);
    expect(b.balanceDue).toBe(1500);
  });
});

describe("computeBalance — edges", () => {
  it("never reports a negative balance, but does flag the overpayment", () => {
    const b = computeBalance({
      grandTotal: 1000,
      receipts: [{ amount: 1200 }],
    });
    expect(b.balanceDue).toBe(0);
    expect(b.overpaid).toBe(true);
    expect(b.overpaidBy).toBe(200);
    expect(b.settled).toBe(true);
  });

  it("an empty invoice is not 'paid' just because nothing is owed", () => {
    const b = computeBalance({ grandTotal: 0 });
    expect(b.settled).toBe(false);
  });

  it("survives float drift — three thirds of a penny still settles", () => {
    const b = computeBalance({
      grandTotal: 0.3,
      receipts: [{ amount: 0.1 }, { amount: 0.1 }, { amount: 0.1 }],
    });
    expect(b.balanceDue).toBe(0);
    expect(b.settled).toBe(true);
  });

  it("treats missing deposit/finance as zero rather than NaN", () => {
    const b = computeBalance({
      grandTotal: 500,
      deposit: null,
      finance: null,
    });
    expect(b.paid).toBe(0);
    expect(b.balanceDue).toBe(500);
  });

  it("rounds to pennies", () => {
    const b = computeBalance({
      grandTotal: 100.005,
      receipts: [{ amount: 50.004 }],
    });
    expect(Number.isInteger(b.balanceDue * 100)).toBe(true);
  });
});

describe("wouldSettle", () => {
  const state = computeBalance({ grandTotal: 11850, deposit: 500 });

  it("is false for a payment that leaves something outstanding", () => {
    expect(wouldSettle(state, 1000)).toBe(false);
  });

  it("is true for the payment that clears it", () => {
    expect(wouldSettle(state, 11350)).toBe(true);
  });

  it("is true for an overpayment", () => {
    expect(wouldSettle(state, 12000)).toBe(true);
  });

  it("never settles a zero-total invoice", () => {
    expect(wouldSettle(computeBalance({ grandTotal: 0 }), 100)).toBe(false);
  });
});
