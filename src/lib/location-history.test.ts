import { describe, expect, it } from "vitest";
import type { LocationMovement } from "@/lib/types";
import {
  daysAtLocation,
  deriveCurrentState,
  isOutstanding,
  planMovementDeletion,
  sortMovements,
  validateMovementEdit,
} from "./location-history";

function mv(
  id: string,
  createdAt: string,
  overrides: Partial<LocationMovement> = {},
): LocationMovement {
  return {
    id,
    vehicleId: "v1",
    fromLocation: null,
    toLocation: "forecourt",
    externalVendorId: null,
    staffUserId: null,
    expectedReturnAt: null,
    actualReturnAt: null,
    notes: null,
    createdBy: "u1",
    createdAt,
    ...overrides,
  };
}

const history = [
  mv("a", "2026-01-01T10:00:00Z", { toLocation: "forecourt" }),
  mv("b", "2026-02-01T10:00:00Z", { toLocation: "garage" }),
  mv("c", "2026-03-01T10:00:00Z", { toLocation: "yard" }),
];

describe("sortMovements", () => {
  it("orders oldest first", () => {
    const shuffled = [history[2], history[0], history[1]];
    expect(sortMovements(shuffled).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("does not mutate the input", () => {
    const input = [history[2], history[0]];
    const copy = [...input];
    sortMovements(input);
    expect(input).toEqual(copy);
  });

  it("breaks ties deterministically", () => {
    const same = [mv("z", "2026-01-01T10:00:00Z"), mv("a", "2026-01-01T10:00:00Z")];
    expect(sortMovements(same).map((m) => m.id)).toEqual(["a", "z"]);
  });
});

describe("deriveCurrentState", () => {
  it("takes the newest movement as the current location", () => {
    expect(deriveCurrentState(history)).toEqual({
      currentLocation: "yard",
      locationSince: "2026-03-01T10:00:00Z",
    });
  });

  it("is order-independent", () => {
    expect(deriveCurrentState([history[2], history[0], history[1]])).toEqual(
      deriveCurrentState(history),
    );
  });

  it("returns nulls for an empty history rather than inventing a location", () => {
    expect(deriveCurrentState([])).toEqual({
      currentLocation: null,
      locationSince: null,
    });
  });
});

describe("isOutstanding", () => {
  it("is true for a garage movement with no return", () => {
    expect(isOutstanding(mv("x", "2026-01-01T00:00:00Z", { toLocation: "garage" }))).toBe(
      true,
    );
  });

  it("is false once returned", () => {
    expect(
      isOutstanding(
        mv("x", "2026-01-01T00:00:00Z", {
          toLocation: "garage",
          actualReturnAt: "2026-01-05T00:00:00Z",
        }),
      ),
    ).toBe(false);
  });

  it("is false for forecourt and yard, which are not loans", () => {
    expect(isOutstanding(mv("x", "2026-01-01T00:00:00Z", { toLocation: "yard" }))).toBe(
      false,
    );
  });
});

describe("validateMovementEdit", () => {
  it("accepts a date between its neighbours", () => {
    expect(
      validateMovementEdit(history, "b", { createdAt: "2026-02-15T10:00:00Z" }),
    ).toBeNull();
  });

  // GEN-101 UAT 4 — history cannot be reordered by editing a date.
  it("rejects a date after the following movement", () => {
    expect(
      validateMovementEdit(history, "b", { createdAt: "2026-04-01T10:00:00Z" }),
    ).toMatch(/cannot be dated after/i);
  });

  it("rejects a date before the preceding movement", () => {
    expect(
      validateMovementEdit(history, "b", { createdAt: "2025-12-01T10:00:00Z" }),
    ).toMatch(/cannot be dated before/i);
  });

  it("allows the newest movement to move freely forward", () => {
    expect(
      validateMovementEdit(history, "c", { createdAt: "2026-06-01T10:00:00Z" }),
    ).toBeNull();
  });

  it("rejects an unparseable date", () => {
    expect(validateMovementEdit(history, "b", { createdAt: "nope" })).toMatch(
      /not a valid date/i,
    );
  });

  it("rejects an unknown movement", () => {
    expect(validateMovementEdit(history, "zzz", { notes: "x" })).toMatch(
      /no longer exists/i,
    );
  });

  it("rejects an expected return before the movement itself", () => {
    expect(
      validateMovementEdit(history, "b", {
        expectedReturnAt: "2026-01-15T10:00:00Z",
      }),
    ).toMatch(/before the movement/i);
  });

  it("rejects a return date before the movement itself", () => {
    expect(
      validateMovementEdit(history, "b", {
        actualReturnAt: "2026-01-15T10:00:00Z",
      }),
    ).toMatch(/before the movement/i);
  });

  it("rejects marking a forecourt movement returned", () => {
    expect(
      validateMovementEdit(history, "a", {
        actualReturnAt: "2026-01-05T10:00:00Z",
      }),
    ).toMatch(/only garage and staff/i);
  });

  it("accepts a valid return on a garage movement", () => {
    expect(
      validateMovementEdit(history, "b", {
        actualReturnAt: "2026-02-10T10:00:00Z",
      }),
    ).toBeNull();
  });

  it("accepts a notes-only edit", () => {
    expect(validateMovementEdit(history, "b", { notes: "Bodyshop" })).toBeNull();
  });
});

describe("planMovementDeletion", () => {
  // GEN-101 UAT 6 — deleting the newest entry reverts the car to the previous one.
  it("reverts to the previous location when deleting the newest", () => {
    const outcome = planMovementDeletion(history, "c");
    expect(outcome.allowed).toBe(true);
    expect(outcome.nextState).toEqual({
      currentLocation: "garage",
      locationSince: "2026-02-01T10:00:00Z",
    });
  });

  // GEN-101 UAT 7 — deleting mid-history must not change where the car is now.
  it("leaves the current location untouched when deleting mid-history", () => {
    const outcome = planMovementDeletion(history, "b");
    expect(outcome.allowed).toBe(true);
    expect(outcome.nextState).toEqual({
      currentLocation: "yard",
      locationSince: "2026-03-01T10:00:00Z",
    });
  });

  it("refuses to delete the only movement on record", () => {
    const outcome = planMovementDeletion([history[0]], "a");
    expect(outcome.allowed).toBe(false);
    expect(outcome.reason).toMatch(/only movement/i);
  });

  it("refuses an unknown movement", () => {
    const outcome = planMovementDeletion(history, "zzz");
    expect(outcome.allowed).toBe(false);
    expect(outcome.reason).toMatch(/no longer exists/i);
  });
});

describe("daysAtLocation", () => {
  it("counts whole days", () => {
    expect(
      daysAtLocation("2026-03-01T10:00:00Z", new Date("2026-03-11T10:00:00Z")),
    ).toBe(10);
  });

  it("floors a partial day to zero", () => {
    expect(
      daysAtLocation("2026-03-01T10:00:00Z", new Date("2026-03-01T20:00:00Z")),
    ).toBe(0);
  });

  it("never returns a negative for a future date", () => {
    expect(
      daysAtLocation("2026-04-01T10:00:00Z", new Date("2026-03-01T10:00:00Z")),
    ).toBe(0);
  });

  it("returns zero for an invalid date", () => {
    expect(daysAtLocation("nope")).toBe(0);
  });
});
