import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  encodeCursor,
  keysetFilterDesc,
  toPage,
} from "./_base";

const row = (n: number) => ({
  id: `id-${n}`,
  createdAt: `2026-07-0${n}T00:00:00.000Z`,
});

describe("cursor encode/decode", () => {
  it("round-trips", () => {
    const c = { createdAt: "2026-07-01T12:00:00.000Z", id: "abc-123" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("rejects garbage and wrong shapes", () => {
    expect(decodeCursor("not-base64!!")).toBeNull();
    expect(decodeCursor(btoa(encodeURIComponent(JSON.stringify({ a: 1 }))))).toBeNull();
    expect(decodeCursor(btoa("plain string"))).toBeNull();
  });
});

describe("keysetFilterDesc", () => {
  it("builds the strictly-after filter for DESC order", () => {
    expect(
      keysetFilterDesc({ createdAt: "T1", id: "X" }),
    ).toBe("created_at.lt.T1,and(created_at.eq.T1,id.lt.X)");
  });
});

describe("toPage", () => {
  it("full page + sentinel row → nextCursor from last KEPT row", () => {
    const page = toPage([row(5), row(4), row(3)], 2);
    expect(page.rows).toHaveLength(2);
    expect(page.rows[1].id).toBe("id-4");
    expect(page.nextCursor).toBe(
      encodeCursor({ createdAt: row(4).createdAt, id: "id-4" }),
    );
  });

  it("short page → last page, no cursor", () => {
    const page = toPage([row(2), row(1)], 5);
    expect(page.rows).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it("exactly `limit` rows without sentinel → no cursor", () => {
    const page = toPage([row(2), row(1)], 2);
    expect(page.nextCursor).toBeNull();
  });

  it("empty → empty page", () => {
    const page = toPage([], 10);
    expect(page.rows).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});
