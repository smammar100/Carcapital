import { describe, expect, test } from "vitest";
import {
  syntheticEmail,
  normalizeUsername,
  isValidUsername,
  looksLikeEmail,
  suggestUsername,
  INTERNAL_EMAIL_DOMAIN,
  DEFAULT_ORG_SLUG,
} from "./username";

describe("username helpers", () => {
  // The login page and the create route MUST derive the same synthetic email for
  // a (slug, username) pair — otherwise a username user could be created but never
  // log in. This locks that contract.
  test("syntheticEmail is deterministic and matches the documented format", () => {
    expect(syntheticEmail("car-capital-uk", "ahmed.khan")).toBe(
      "ahmed.khan@car-capital-uk.staff.carcapital.uk",
    );
  });

  test("syntheticEmail lower-cases the username part", () => {
    expect(syntheticEmail("car-capital-uk", "Ahmed.Khan")).toBe(
      "ahmed.khan@car-capital-uk.staff.carcapital.uk",
    );
  });

  test("defaults align with migration 0026 (slug) + the internal domain", () => {
    expect(DEFAULT_ORG_SLUG).toBe("car-capital-uk");
    expect(INTERNAL_EMAIL_DOMAIN).toBe("staff.carcapital.uk");
  });

  test("isValidUsername mirrors the DB CHECK constraint", () => {
    expect(isValidUsername("ahmed.khan")).toBe(true);
    expect(isValidUsername("a.b")).toBe(true); // 3 chars, ok
    expect(isValidUsername("user_01")).toBe(true);
    expect(isValidUsername("ab")).toBe(false); // too short (<3)
    expect(isValidUsername("_ab")).toBe(false); // must start alphanumeric
    expect(isValidUsername("ab-")).toBe(false); // must end alphanumeric
    expect(isValidUsername("ahmed khan")).toBe(false); // no spaces
    expect(isValidUsername("a".repeat(33))).toBe(false); // too long (>32)
  });

  test("looksLikeEmail distinguishes an email from a username", () => {
    expect(looksLikeEmail("admin@carcapital.uk")).toBe(true);
    expect(looksLikeEmail("ahmed.khan")).toBe(false);
  });

  test("suggestUsername derives a handle from a person's name", () => {
    expect(suggestUsername("Ahmed Khan")).toBe("ahmed.khan");
    expect(suggestUsername("  Mary-Jane  O'Neil ")).toBe("mary.jane.o.neil");
  });

  test("normalizeUsername trims and lower-cases", () => {
    expect(normalizeUsername("  Ahmed.Khan ")).toBe("ahmed.khan");
  });
});
