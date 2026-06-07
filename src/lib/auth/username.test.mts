import { test } from "node:test";
import assert from "node:assert/strict";
import {
  syntheticEmail,
  normalizeUsername,
  isValidUsername,
  looksLikeEmail,
  suggestUsername,
  INTERNAL_EMAIL_DOMAIN,
  DEFAULT_ORG_SLUG,
} from "./username.ts";

// The login page and the create route MUST derive the same synthetic email for
// a (slug, username) pair — otherwise a username user could be created but never
// log in. This locks that contract.
test("syntheticEmail is deterministic and matches the documented format", () => {
  assert.equal(
    syntheticEmail("car-capital-uk", "ahmed.khan"),
    "ahmed.khan@car-capital-uk.staff.carcapital.uk",
  );
});

test("syntheticEmail lower-cases the username part", () => {
  assert.equal(
    syntheticEmail("car-capital-uk", "Ahmed.Khan"),
    "ahmed.khan@car-capital-uk.staff.carcapital.uk",
  );
});

test("defaults align with migration 0026 (slug) + the internal domain", () => {
  assert.equal(DEFAULT_ORG_SLUG, "car-capital-uk");
  assert.equal(INTERNAL_EMAIL_DOMAIN, "staff.carcapital.uk");
});

test("isValidUsername mirrors the DB CHECK constraint", () => {
  assert.equal(isValidUsername("ahmed.khan"), true);
  assert.equal(isValidUsername("a.b"), true); // 3 chars, ok
  assert.equal(isValidUsername("user_01"), true);
  assert.equal(isValidUsername("ab"), false); // too short (<3)
  assert.equal(isValidUsername("_ab"), false); // must start alphanumeric
  assert.equal(isValidUsername("ab-"), false); // must end alphanumeric
  assert.equal(isValidUsername("ahmed khan"), false); // no spaces
  assert.equal(isValidUsername("a".repeat(33)), false); // too long (>32)
});

test("looksLikeEmail distinguishes an email from a username", () => {
  assert.equal(looksLikeEmail("admin@carcapital.uk"), true);
  assert.equal(looksLikeEmail("ahmed.khan"), false);
});

test("suggestUsername derives a handle from a person's name", () => {
  assert.equal(suggestUsername("Ahmed Khan"), "ahmed.khan");
  assert.equal(suggestUsername("  Mary-Jane  O'Neil "), "mary.jane.o.neil");
});

test("normalizeUsername trims and lower-cases", () => {
  assert.equal(normalizeUsername("  Ahmed.Khan "), "ahmed.khan");
});
