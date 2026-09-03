/**
 * Shared MOT-status derivation.
 *
 * Both the DVSA MOT History API and the AutoTrader Connect vehicle lookup
 * return an MOT-test array with the same essential shape. This module holds
 * the pure derivation logic + types so neither service has to depend on the
 * other (originally lived in dvsa-service.ts).
 *
 * `motStatus` / `motExpiryDate` are stored as free `text` / `date` in the DB
 * (migration 0017), so these string values are display-only — no migration
 * is tied to the exact wording.
 */

export type MotStatus = "Valid" | "Not valid" | "No MOT history";

export const NO_MOT_HISTORY: MotStatus = "No MOT history";

/**
 * The only fields the derivation reads. Both DVSA's `DvsaMotTest` and
 * AutoTrader's `motTests[]` entries satisfy this structurally.
 */
export interface MotTest {
  testResult?: string;
  /** YYYY-MM-DD */
  expiryDate?: string;
}

/**
 * "Valid" if the latest PASSED test's expiry is today or later; "Not valid"
 * if there are tests but none currently valid; "No MOT history" when empty
 * (e.g. a brand-new car or an upstream that returned no tests).
 */
// DVSA returns "PASSED" (upper); AutoTrader returns "Passed" (title). Compare
// case-insensitively so AutoTrader's passes aren't silently discarded.
function isPass(t: MotTest): boolean {
  return (t.testResult ?? "").toUpperCase() === "PASSED";
}

export function deriveMotStatus(tests: MotTest[]): MotStatus {
  if (!tests.length) return NO_MOT_HISTORY;
  const today = new Date().toISOString().slice(0, 10);
  const latestPassed = tests
    .filter((t) => isPass(t) && t.expiryDate)
    .map((t) => t.expiryDate as string)
    .sort()
    .pop();
  if (latestPassed && latestPassed >= today) return "Valid";
  return "Not valid";
}

/** Latest PASSED test's expiry date (ISO YYYY-MM-DD), or null when none. */
export function deriveExpiryDate(tests: MotTest[]): string | null {
  const passedExpiries = tests
    .filter((t) => isPass(t) && t.expiryDate)
    .map((t) => t.expiryDate as string)
    .sort();
  return passedExpiries.at(-1) ?? null;
}

// ─── GEN-75: inspection-queue MOT expiry flag ────────────────────────────

/** A vehicle is flagged "expiring soon" inside this many days of its MOT date. */
const MOT_EXPIRING_SOON_DAYS = 30;

export type MotFlagTone = "expired" | "expiring" | "ok" | "unknown";

export interface MotFlag {
  tone: MotFlagTone;
  label: string;
}

/**
 * Inspection-queue MOT badge, derived purely from the vehicle's already-
 * stored `motExpiry` date — no live DVLA/DVSA call at render time. "unknown"
 * covers both "no MOT history yet" and "MOT-exempt" (DVLA doesn't
 * distinguish the two in `motStatus`); either way there's nothing dated to
 * flag, so showing "no data" beats guessing.
 */
export function motFlagFor(motExpiry: string | null): MotFlag {
  if (!motExpiry) return { tone: "unknown", label: "MOT: no data" };
  const days = Math.floor(
    (new Date(motExpiry).getTime() - Date.now()) / 86_400_000,
  );
  if (days < 0) return { tone: "expired", label: "MOT expired" };
  if (days <= MOT_EXPIRING_SOON_DAYS) {
    return { tone: "expiring", label: `MOT expires in ${days}d` };
  }
  return { tone: "ok", label: "MOT valid" };
}
