import { describe, expect, it } from "vitest";
import {
  describeChanges,
  diffFields,
  firstError,
  isEquivalent,
  isPristine,
  nonNegative,
  notFuture,
  parseIntegerStrict,
  parseNumeric,
  parseOptionalText,
  parseRegistration,
  required,
  validDate,
  validYear,
  withinRange,
} from "./field-edit";

describe("parseNumeric", () => {
  it("parses a plain number", () => {
    expect(parseNumeric("1250.5")).toBe(1250.5);
  });

  it("strips currency symbol, separators and whitespace", () => {
    expect(parseNumeric("£1,250.50")).toBe(1250.5);
    expect(parseNumeric("  12,000 ")).toBe(12000);
  });

  // GEN-99 UAT 3: "12,000" must not save as 12.
  it("does not truncate a thousands-separated value", () => {
    expect(parseNumeric("12,000")).toBe(12000);
    expect(parseNumeric("45,000")).toBe(45000);
  });

  it("treats empty input as null rather than zero", () => {
    expect(parseNumeric("")).toBeNull();
    expect(parseNumeric("   ")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseNumeric("abc")).toBeUndefined();
    expect(parseNumeric("12abc")).toBeUndefined();
    expect(parseNumeric("1.2.3")).toBeUndefined();
  });

  it("accepts a negative number so the validator can report it", () => {
    expect(parseNumeric("-5")).toBe(-5);
  });
});

describe("parseIntegerStrict", () => {
  it("accepts whole numbers", () => {
    expect(parseIntegerStrict("45000")).toBe(45000);
  });

  it("rejects a fractional value", () => {
    expect(parseIntegerStrict("45.5")).toBeUndefined();
  });

  it("passes empty through as null", () => {
    expect(parseIntegerStrict("")).toBeNull();
  });
});

describe("parseOptionalText", () => {
  it("trims and preserves content", () => {
    expect(parseOptionalText("  Ford  ")).toBe("Ford");
  });

  it("maps blank to null so the column clears", () => {
    expect(parseOptionalText("   ")).toBeNull();
  });
});

describe("parseRegistration", () => {
  it("uppercases and removes spacing", () => {
    expect(parseRegistration("lg17 mka")).toBe("LG17MKA");
  });
});

describe("validators", () => {
  it("required rejects empty values only", () => {
    const v = required("Colour");
    expect(v("")).toBe("Colour is required");
    expect(v(null)).toBe("Colour is required");
    expect(v("Blue")).toBeNull();
  });

  it("nonNegative rejects negatives but allows null and zero", () => {
    const v = nonNegative("Mileage");
    expect(v(-1)).toBe("Mileage cannot be negative");
    expect(v(0)).toBeNull();
    expect(v(null)).toBeNull();
  });

  it("withinRange bounds inclusively", () => {
    const v = withinRange("Keys", 0, 10);
    expect(v(11)).toBe("Keys must be between 0 and 10");
    expect(v(10)).toBeNull();
  });

  it("validYear allows next year but not beyond", () => {
    const v = validYear(new Date("2026-08-25T00:00:00Z"));
    expect(v(2027)).toBeNull();
    expect(v(2028)).toBe("Year must be between 1900 and 2027");
    expect(v(1899)).toBe("Year must be between 1900 and 2027");
  });

  it("notFuture rejects a later date", () => {
    const now = new Date("2026-08-25T00:00:00Z");
    const v = notFuture("Received", now);
    expect(v("2026-09-01")).toBe("Received cannot be in the future");
    expect(v("2026-08-01")).toBeNull();
    expect(v(null)).toBeNull();
  });

  it("validDate rejects unparseable input", () => {
    expect(validDate("MOT expiry")("not-a-date")).toBe(
      "MOT expiry is not a valid date",
    );
    expect(validDate("MOT expiry")("2027-01-01")).toBeNull();
  });

  it("firstError returns the earliest failure", () => {
    const err = firstError(-5, [required("Mileage"), nonNegative("Mileage")]);
    expect(err).toBe("Mileage cannot be negative");
  });

  it("firstError returns null when everything passes", () => {
    expect(firstError(10, [nonNegative("Mileage")])).toBeNull();
  });
});

describe("isEquivalent", () => {
  it("treats null, undefined and empty string as the same", () => {
    expect(isEquivalent(null, undefined)).toBe(true);
    expect(isEquivalent("", null)).toBe(true);
  });

  it("distinguishes empty from a real value", () => {
    expect(isEquivalent(null, 0)).toBe(false);
    expect(isEquivalent("", "a")).toBe(false);
  });

  it("compares real values by identity", () => {
    expect(isEquivalent(5, 5)).toBe(true);
    expect(isEquivalent(5, 6)).toBe(false);
  });
});

describe("diffFields", () => {
  const original: {
    colour: string | null;
    mileage: number | null;
    notes: string | null;
  } = { colour: "Blue", mileage: 40000, notes: null };

  it("returns only changed keys", () => {
    const { patch, changes } = diffFields(original, {
      colour: "Red",
      mileage: 40000,
    });
    expect(patch).toEqual({ colour: "Red" });
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ key: "colour", from: "Blue", to: "Red" });
  });

  // GEN-99 UAT 17: saving with no changes must not write anything.
  it("produces an empty patch when nothing changed", () => {
    const { patch, changes } = diffFields(original, {
      colour: "Blue",
      mileage: 40000,
    });
    expect(patch).toEqual({});
    expect(changes).toHaveLength(0);
  });

  it("does not treat null → empty string as a change", () => {
    const { changes } = diffFields(original, { notes: "" });
    expect(changes).toHaveLength(0);
  });

  it("uses supplied labels for the change record", () => {
    const { changes } = diffFields(
      original,
      { colour: "Red" },
      { colour: "Colour" },
    );
    expect(changes[0].label).toBe("Colour");
  });

  it("records a value being cleared", () => {
    const { patch, changes } = diffFields(original, { colour: null });
    expect(patch).toEqual({ colour: null });
    expect(changes[0]).toMatchObject({ from: "Blue", to: null });
  });
});

describe("isPristine", () => {
  it("is true when the draft matches the original", () => {
    expect(isPristine({ a: 1 }, { a: 1 })).toBe(true);
  });

  it("is false once a value differs", () => {
    expect(isPristine({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe("describeChanges", () => {
  it("renders old and new values for the audit trail", () => {
    const text = describeChanges([
      { key: "buyingPrice", label: "Buying Price", from: 5000, to: 5500 },
    ]);
    expect(text).toBe("Buying Price: 5000 → 5500");
  });

  it("labels empty values readably", () => {
    const text = describeChanges([
      { key: "colour", label: "Colour", from: null, to: "Red" },
    ]);
    expect(text).toBe("Colour: empty → Red");
  });

  it("renders booleans as Yes/No", () => {
    const text = describeChanges([
      { key: "v5Received", label: "V5 Received", from: false, to: true },
    ]);
    expect(text).toBe("V5 Received: No → Yes");
  });

  it("joins multiple changes", () => {
    const text = describeChanges([
      { key: "a", label: "A", from: 1, to: 2 },
      { key: "b", label: "B", from: "x", to: "y" },
    ]);
    expect(text).toBe("A: 1 → 2, B: x → y");
  });
});
