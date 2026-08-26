/**
 * Pure helpers behind the vehicle-detail inline editors (GEN-98 and its
 * sub-tickets). Everything here is framework-free so the parsing, validation
 * and diffing rules can be unit-tested without a DOM — the UI layer in
 * `components/vehicle-detail/editable-card.tsx` only wires these to inputs.
 *
 * The rules live here rather than in each tab so Details, Financials, Location
 * and the rest cannot drift apart: one parser for money, one for mileage, one
 * definition of "changed".
 */

// ============================================================
// PARSERS — string (what an <input> gives us) → typed value
// ============================================================

/**
 * "£1,250.50" / "1250.5" / "" → 1250.5 / null.
 *
 * Strips the currency symbol, thousands separators and whitespace before
 * parsing, so a value copied straight out of the read-mode display round-trips.
 * Returns `undefined` for input that is not a number at all, which callers
 * treat as a validation failure rather than a null value.
 */
export function parseNumeric(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[£,\s]/g, "");
  // Reject "12abc" — Number() would too, but "" and whitespace already left.
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/** As `parseNumeric` but rejects any fractional part (mileage, keys, year). */
export function parseIntegerStrict(raw: string): number | null | undefined {
  const n = parseNumeric(raw);
  if (n === undefined || n === null) return n;
  return Number.isInteger(n) ? n : undefined;
}

/** Empty string → null, so clearing an optional text field stores NULL. */
export function parseOptionalText(raw: string): string | null {
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/** Normalises a UK registration for storage: uppercase, no inner spaces. */
export function parseRegistration(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, "");
}

// ============================================================
// VALIDATORS — typed value → error message | null
// ============================================================

export type Validator<V> = (value: V) => string | null;

export function required(label: string): Validator<unknown> {
  return (v) =>
    v === null || v === undefined || v === "" ? `${label} is required` : null;
}

export function nonNegative(label: string): Validator<number | null> {
  return (v) => (v !== null && v < 0 ? `${label} cannot be negative` : null);
}

export function withinRange(
  label: string,
  min: number,
  max: number,
): Validator<number | null> {
  return (v) =>
    v !== null && (v < min || v > max)
      ? `${label} must be between ${min} and ${max}`
      : null;
}

/**
 * Model years. Upper bound is next calendar year — dealers register plates
 * ahead of the year turning, but a 2050 model is a typo.
 */
export function validYear(now: Date = new Date()): Validator<number | null> {
  const max = now.getFullYear() + 1;
  return (v) =>
    v !== null && (v < 1900 || v > max)
      ? `Year must be between 1900 and ${max}`
      : null;
}

/** Rejects a date in the future — receipt dates, first-registered, etc. */
export function notFuture(label: string, now: Date = new Date()): Validator<string | null> {
  return (v) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return `${label} is not a valid date`;
    return d.getTime() > now.getTime() ? `${label} cannot be in the future` : null;
  };
}

export function validDate(label: string): Validator<string | null> {
  return (v) => {
    if (!v) return null;
    return Number.isNaN(new Date(v).getTime())
      ? `${label} is not a valid date`
      : null;
  };
}

/** Runs validators in order and returns the first failure. */
export function firstError<V>(value: V, validators: Validator<V>[]): string | null {
  for (const v of validators) {
    const err = v(value);
    if (err) return err;
  }
  return null;
}

// ============================================================
// DIFFING — draft vs original
// ============================================================

export interface FieldChange {
  key: string;
  label: string;
  from: unknown;
  to: unknown;
}

export interface DiffResult<T> {
  /** Only the keys that actually changed — safe to send straight to a PATCH. */
  patch: Partial<T>;
  changes: FieldChange[];
}

/**
 * Compares a draft against the original and returns only genuine changes.
 *
 * Treats `null`, `undefined` and `""` as equivalent so that opening an editor
 * on an empty field and closing it again is a no-op rather than a write of
 * `null` over `undefined`. Without this, "save with no changes" would emit
 * spurious activity-log entries.
 */
export function diffFields<T extends object>(
  original: T,
  draft: Partial<T>,
  labels: Record<string, string> = {},
): DiffResult<T> {
  const source = original as Record<string, unknown>;
  const patch: Partial<T> = {};
  const changes: FieldChange[] = [];

  for (const key of Object.keys(draft)) {
    const before = source[key];
    const after = draft[key as keyof T];
    if (isEquivalent(before, after)) continue;
    patch[key as keyof T] = after as T[keyof T];
    changes.push({ key, label: labels[key] ?? key, from: before, to: after });
  }

  return { patch, changes };
}

/** Empty-ish values are interchangeable; everything else compares by value. */
export function isEquivalent(a: unknown, b: unknown): boolean {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return true;
  if (aEmpty !== bEmpty) return false;
  return Object.is(a, b);
}

/** True when the draft holds nothing the original does not already have. */
export function isPristine<T extends object>(
  original: T,
  draft: Partial<T>,
): boolean {
  return diffFields(original, draft).changes.length === 0;
}

/**
 * Human-readable one-liner per change, for the activity-log description.
 * GEN-88 requires the audit trail to carry old and new values, not just
 * "vehicle updated".
 */
export function describeChanges(changes: FieldChange[]): string {
  return changes
    .map((c) => `${c.label}: ${displayValue(c.from)} → ${displayValue(c.to)}`)
    .join(", ");
}

function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "empty";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}
