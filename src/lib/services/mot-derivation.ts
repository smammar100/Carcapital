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
export function deriveMotStatus(tests: MotTest[]): MotStatus {
  if (!tests.length) return NO_MOT_HISTORY;
  const today = new Date().toISOString().slice(0, 10);
  const latestPassed = tests
    .filter((t) => t.testResult === "PASSED" && t.expiryDate)
    .map((t) => t.expiryDate as string)
    .sort()
    .pop();
  if (latestPassed && latestPassed >= today) return "Valid";
  return "Not valid";
}

/** Latest PASSED test's expiry date (ISO YYYY-MM-DD), or null when none. */
export function deriveExpiryDate(tests: MotTest[]): string | null {
  const passedExpiries = tests
    .filter((t) => t.testResult === "PASSED" && t.expiryDate)
    .map((t) => t.expiryDate as string)
    .sort();
  return passedExpiries.at(-1) ?? null;
}
