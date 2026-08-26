import { describe, expect, it } from "vitest";
import {
  ADVERT_LIMITS,
  MAX_HIGHLIGHTS,
  highlightsError,
  isOverLimit,
  limitError,
  limitFor,
  normaliseHighlights,
  overLimitFields,
} from "./advert-limits";

const repeat = (n: number) => "x".repeat(n);

describe("limits", () => {
  it("exposes AutoTrader's documented field limits", () => {
    expect(limitFor("attentionGrabber")).toBe(30);
    expect(limitFor("keySellingPoint")).toBe(35);
    expect(limitFor("highlight")).toBe(40);
    expect(limitFor("description")).toBe(3000);
  });
});

describe("isOverLimit", () => {
  it("accepts a value exactly at the limit", () => {
    expect(isOverLimit("attentionGrabber", repeat(30))).toBe(false);
  });

  it("rejects one character over", () => {
    expect(isOverLimit("attentionGrabber", repeat(31))).toBe(true);
  });

  it("accepts an empty value", () => {
    expect(isOverLimit("description", "")).toBe(false);
  });
});

describe("limitError", () => {
  it("is null when the value fits", () => {
    expect(limitError("keySellingPoint", "Great condition")).toBeNull();
  });

  // GEN-103 UAT 10 — the message has to say what the limit is, not just "too long".
  it("names the actual and permitted lengths", () => {
    const err = limitError("keySellingPoint", repeat(40));
    expect(err).toBe("Key Selling Point is 40 characters — the limit is 35.");
  });
});

describe("overLimitFields", () => {
  it("returns nothing when everything fits", () => {
    expect(
      overLimitFields({ attentionGrabber: "Low mileage", subtitle: "Tidy car" }),
    ).toEqual([]);
  });

  /**
   * All offending fields at once — otherwise the user fixes one, retries, and
   * discovers the next, one round-trip at a time.
   */
  it("names every offending field together", () => {
    expect(
      overLimitFields({
        attentionGrabber: repeat(31),
        keySellingPoint: repeat(36),
        subtitle: "fine",
      }),
    ).toEqual(["Attention Grabber", "Key Selling Point"]);
  });

  it("ignores fields that were not supplied", () => {
    expect(overLimitFields({ description: repeat(10) })).toEqual([]);
  });
});

describe("normaliseHighlights", () => {
  it("trims and drops blank rows", () => {
    expect(normaliseHighlights([" One ", "", "  ", "Two"])).toEqual(["One", "Two"]);
  });

  it("caps the list at the display maximum", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    expect(normaliseHighlights(six)).toHaveLength(MAX_HIGHLIGHTS);
  });

  it("returns an empty list when everything is blank", () => {
    expect(normaliseHighlights(["", "   "])).toEqual([]);
  });
});

describe("highlightsError", () => {
  it("accepts a valid list", () => {
    expect(highlightsError(["Full service history", "One owner"])).toBeNull();
  });

  it("ignores blanks when counting", () => {
    expect(
      highlightsError(["a", "b", "c", "d", "e", "", "   "]),
    ).toBeNull();
  });

  it("rejects more than the display maximum", () => {
    expect(highlightsError(["a", "b", "c", "d", "e", "f"])).toMatch(
      /only 5 highlights/i,
    );
  });

  it("rejects a bullet over the character limit", () => {
    expect(highlightsError([repeat(41)])).toMatch(/40 characters or fewer/i);
  });

  it("accepts a bullet exactly at the limit", () => {
    expect(highlightsError([repeat(ADVERT_LIMITS.highlight)])).toBeNull();
  });
});
