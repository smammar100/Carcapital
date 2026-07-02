/**
 * Characterization tests — AutoTrader POST /stock body mapper (pure).
 */
import { describe, expect, it } from "vitest";
import { buildStockCreateBody } from "./autotrader-stock-mapper";
import { makeListing, makeVehicle } from "@/test/factories";

const NOT_PUBLISHED = { status: "NOT_PUBLISHED" };

describe("buildStockCreateBody — fully-populated vehicle", () => {
  const { body, warnings } = buildStockCreateBody({
    vehicle: makeVehicle(),
    listing: makeListing(),
  });

  it("pins the full mapped payload", () => {
    expect(body).toEqual({
      vehicle: {
        vehicleType: "Car",
        registration: "AB12CDE", // whitespace stripped
        make: "Volkswagen", // NOTE below on title-casing
        model: "Golf",
        generation: "Golf VII Facelift (2017)",
        derivative: "GT TDI",
        derivativeId: "at-deriv-9f8e7d",
        fuelType: "Diesel",
        bodyType: "Hatchback",
        transmissionType: "Manual",
        odometerReadingMiles: 42350,
      },
      adverts: {
        retailAdverts: {
          suppliedPrice: { amountGBP: 12495 },
          attentionGrabber: "Full VW service history",
          description:
            "Stunning Golf GT TDI with full service history, two keys and fresh MOT.",
          autotraderAdvert: NOT_PUBLISHED,
          advertiserAdvert: NOT_PUBLISHED,
          locatorAdvert: NOT_PUBLISHED,
          exportAdvert: NOT_PUBLISHED,
          profileAdvert: NOT_PUBLISHED,
        },
      },
      metadata: {
        lifecycleState: "FORECOURT",
        externalStockReference: "CC-2026-0042",
      },
    });
  });

  it("emits no warnings when derivativeId + images exist", () => {
    expect(warnings).toEqual([]);
  });
});

describe("buildStockCreateBody — minimal vehicle (missing optionals)", () => {
  const vehicle = makeVehicle({
    atDerivativeId: null,
    generation: null,
    derivative: null,
    imagesCount: 0,
    heroImageUrl: null,
  });
  const { body, warnings } = buildStockCreateBody({
    vehicle,
    listing: makeListing({ specialFeatures: "" }),
  });
  const v = body.vehicle as Record<string, unknown>;
  const retail = (body.adverts as { retailAdverts: Record<string, unknown> })
    .retailAdverts;

  it("omits generation/derivative/derivativeId keys entirely", () => {
    expect(v).not.toHaveProperty("generation");
    expect(v).not.toHaveProperty("derivative");
    expect(v).not.toHaveProperty("derivativeId");
  });

  it("empty specialFeatures → attentionGrabber undefined", () => {
    expect(retail.attentionGrabber).toBeUndefined();
  });

  it("warns about missing derivativeId AND missing images", () => {
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/derivativeId/);
    expect(warnings[1]).toMatch(/without images/);
  });

  it("warns about images when imagesCount > 0 but no hero URL", () => {
    const r = buildStockCreateBody({
      vehicle: makeVehicle({ heroImageUrl: null }),
      listing: makeListing(),
    });
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/without images/);
  });
});

describe("field normalization / truncation", () => {
  it("attentionGrabber is truncated to 30 characters", () => {
    const { body } = buildStockCreateBody({
      vehicle: makeVehicle(),
      listing: makeListing({
        specialFeatures: "Panoramic roof, heated seats, adaptive cruise control",
      }),
    });
    const retail = (body.adverts as { retailAdverts: Record<string, unknown> })
      .retailAdverts;
    expect(retail.attentionGrabber).toBe("Panoramic roof, heated seats, ");
    expect((retail.attentionGrabber as string).length).toBe(30);
  });

  it("price is rounded to whole GBP", () => {
    const { body } = buildStockCreateBody({
      vehicle: makeVehicle(),
      listing: makeListing({ price: 15999.6 }),
    });
    const retail = (body.adverts as {
      retailAdverts: { suppliedPrice: { amountGBP: number } };
    }).retailAdverts;
    expect(retail.suppliedPrice.amountGBP).toBe(16000);
  });

  it("title-casing lowercases the rest of each word", () => {
    // NOTE: pins existing behavior — possible bug: acronym makes are
    // mangled ("BMW" → "Bmw"), which AutoTrader's taxonomy may reject.
    const { body } = buildStockCreateBody({
      vehicle: makeVehicle({ make: "BMW", model: "X5" }),
      listing: makeListing(),
    });
    const v = body.vehicle as Record<string, unknown>;
    expect(v.make).toBe("Bmw");
    expect(v.model).toBe("X5");
  });

  it.each([
    ["petrol", "Petrol"],
    ["diesel", "Diesel"],
    ["electric", "Electric"],
    ["hybrid", "Petrol Hybrid"], // hybrids always mapped to Petrol Hybrid
  ] as const)("fuelType %s → %s", (input, expected) => {
    const { body } = buildStockCreateBody({
      vehicle: makeVehicle({ fuelType: input }),
      listing: makeListing(),
    });
    expect((body.vehicle as Record<string, unknown>).fuelType).toBe(expected);
  });

  it("van → Van; anything else → Car", () => {
    const van = buildStockCreateBody({
      vehicle: makeVehicle({ vehicleType: "van" }),
      listing: makeListing(),
    });
    expect((van.body.vehicle as Record<string, unknown>).vehicleType).toBe(
      "Van",
    );
  });

  it("bodyType uses the AT vocabulary map (suv → SUV)", () => {
    const { body } = buildStockCreateBody({
      vehicle: makeVehicle({ bodyType: "suv" }),
      listing: makeListing(),
    });
    expect((body.vehicle as Record<string, unknown>).bodyType).toBe("SUV");
  });
});
