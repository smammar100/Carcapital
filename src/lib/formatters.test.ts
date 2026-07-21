/**
 * GEN-67 — the phone validator rejected real numbers. It stripped whitespace
 * only, so any hyphen or bracket failed, and it accepted mobiles exclusively,
 * so every landline was "invalid".
 *
 * The UAT cases are pinned here alongside the formats people actually type.
 */
import { describe, expect, it } from "vitest";
import { isValidUkMobile, isValidUkPhone, normaliseUkPhone } from "./formatters";

describe("normaliseUkPhone", () => {
  it("reduces every way of writing the same number to one national form", () => {
    for (const input of [
      "07712 345678",
      "07712345678",
      "07712-345678",
      "(07712) 345678",
      "07712.345678",
      "+44 7712 345678",
      "+447712345678",
      "0044 7712 345678",
      "44 7712 345678",
      "  07712 345678  ",
    ]) {
      expect(normaliseUkPhone(input), input).toBe("07712345678");
    }
  });

  it("returns null for input that isn't a number at all", () => {
    for (const input of ["", "   ", "abc", "hello world", "07712 34567a", "+++"]) {
      expect(normaliseUkPhone(input), input).toBeNull();
    }
  });
});

describe("isValidUkPhone — the UAT cases", () => {
  it("accepts a standard UK mobile (case 1)", () => {
    expect(isValidUkPhone("07123 456789")).toBe(true);
  });

  it("accepts a number with country code (case 2)", () => {
    expect(isValidUkPhone("+44 7123 456789")).toBe(true);
  });

  it("accepts common separators — the actual bug (case 3)", () => {
    expect(isValidUkPhone("0161-496-0123")).toBe(true);
    expect(isValidUkPhone("(01234) 567890")).toBe(true);
    expect(isValidUkPhone("020 7946 0958")).toBe(true);
    expect(isValidUkPhone("07123.456789")).toBe(true);
  });

  it("rejects clearly invalid input (case 4)", () => {
    expect(isValidUkPhone("not a phone")).toBe(false);
    expect(isValidUkPhone("!!!")).toBe(false);
    expect(isValidUkPhone("07712 34567X")).toBe(false);
  });
});

describe("isValidUkPhone — landlines and non-geographic", () => {
  it("accepts landlines, which the old mobile-only rule rejected outright", () => {
    expect(isValidUkPhone("020 7946 0958")).toBe(true); // London
    expect(isValidUkPhone("0161 496 0123")).toBe(true); // Manchester
    expect(isValidUkPhone("01234 567890")).toBe(true); // Bedford
    expect(isValidUkPhone("016977 3456")).toBe(true); // 10-digit area code
  });

  it("accepts non-geographic ranges", () => {
    expect(isValidUkPhone("0800 123456")).toBe(true);
    expect(isValidUkPhone("0333 123 4567")).toBe(true);
  });

  it("rejects unallocated prefixes and international dialling", () => {
    expect(isValidUkPhone("04123 456789")).toBe(false);
    expect(isValidUkPhone("06123 456789")).toBe(false);
    expect(isValidUkPhone("0012 3456789")).toBe(false);
  });

  it("rejects numbers of the wrong length", () => {
    expect(isValidUkPhone("0123")).toBe(false);
    expect(isValidUkPhone("012345678901234")).toBe(false);
    // A 10-digit "07…" is a typo, not a short mobile.
    expect(isValidUkPhone("0771234567")).toBe(false);
  });

  it("requires a leading zero once the country code is gone", () => {
    expect(isValidUkPhone("7712345678")).toBe(false);
  });
});

describe("isValidUkMobile", () => {
  it("still accepts mobiles, now regardless of separators", () => {
    expect(isValidUkMobile("07712 345678")).toBe(true);
    expect(isValidUkMobile("07712-345678")).toBe(true);
    expect(isValidUkMobile("+44 7712 345678")).toBe(true);
  });

  it("rejects landlines — that's the point of the mobile-specific check", () => {
    expect(isValidUkMobile("020 7946 0958")).toBe(false);
    expect(isValidUkMobile("01234 567890")).toBe(false);
  });
});
