/**
 * GEN-68 — postcode lookup responsiveness.
 *
 * The hook's job is to spend as few requests as possible and never let a slow
 * one overwrite a fast one. Tested at the hook's logic level; the provider
 * itself is stubbed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const lookupAddressByPostcode = vi.fn();
vi.mock("@/lib/services/customer-service", () => ({
  customerService: {
    lookupAddressByPostcode: (pc: string) => lookupAddressByPostcode(pc),
  },
}));

import { clearPostcodeCache, usePostcodeLookup } from "./use-postcode-lookup";

const ADDRESS = {
  line1: "",
  line2: "Heston East",
  line3: "Hounslow",
  line4: "London, TW3 4BZ",
};

beforeEach(() => {
  // The cache is module-scoped and deliberately lives for the whole session,
  // so each test has to start from empty.
  clearPostcodeCache();
  lookupAddressByPostcode.mockReset();
  lookupAddressByPostcode.mockResolvedValue(ADDRESS);
});

describe("lookup", () => {
  it("resolves an address and exposes it", async () => {
    const { result } = renderHook(() => usePostcodeLookup());
    await act(async () => {
      await result.current.lookup("TW3 4BZ");
    });
    expect(result.current.result).toEqual(ADDRESS);
    expect(result.current.notFound).toBe(false);
  });

  it("caches by normalised postcode — spacing and case don't cost a request", async () => {
    const { result } = renderHook(() => usePostcodeLookup());
    await act(async () => {
      await result.current.lookup("TW3 4BZ");
      await result.current.lookup("tw34bz");
      await result.current.lookup("  TW3  4BZ ");
    });
    expect(lookupAddressByPostcode).toHaveBeenCalledTimes(1);
  });

  it("reports a miss rather than looking like a failure", async () => {
    lookupAddressByPostcode.mockResolvedValue(null);
    const { result } = renderHook(() => usePostcodeLookup());
    await act(async () => {
      await result.current.lookup("ZZ1 1ZZ");
    });
    expect(result.current.notFound).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("surfaces a provider outage as an error, not a miss", async () => {
    lookupAddressByPostcode.mockRejectedValue(new Error("503"));
    const { result } = renderHook(() => usePostcodeLookup());
    await act(async () => {
      await result.current.lookup("TW3 4BZ");
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.notFound).toBe(false);
  });
});

describe("lookupDebounced", () => {
  it("spends nothing on a half-typed postcode", async () => {
    const { result } = renderHook(() => usePostcodeLookup());
    act(() => {
      for (const partial of ["T", "TW", "TW3", "TW3 ", "TW3 4"]) {
        result.current.lookupDebounced(partial);
      }
    });
    await new Promise((r) => setTimeout(r, 500));
    expect(lookupAddressByPostcode).not.toHaveBeenCalled();
  });

  it("fires once the postcode is complete, and hands back the address", async () => {
    const onResult = vi.fn();
    const { result } = renderHook(() => usePostcodeLookup());
    act(() => {
      result.current.lookupDebounced("TW3 4BZ", onResult);
    });
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(ADDRESS));
    expect(lookupAddressByPostcode).toHaveBeenCalledTimes(1);
  });

  it("collapses a burst of keystrokes into one request", async () => {
    const { result } = renderHook(() => usePostcodeLookup());
    act(() => {
      // Every one of these is individually valid — without debouncing that's
      // five requests for one postcode.
      for (let i = 0; i < 5; i++) result.current.lookupDebounced("TW3 4BZ");
    });
    await waitFor(() =>
      expect(lookupAddressByPostcode).toHaveBeenCalledTimes(1),
    );
  });

  it("does not call back when the postcode matches nothing", async () => {
    lookupAddressByPostcode.mockResolvedValue(null);
    const onResult = vi.fn();
    const { result } = renderHook(() => usePostcodeLookup());
    act(() => {
      result.current.lookupDebounced("ZZ1 1ZZ", onResult);
    });
    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(onResult).not.toHaveBeenCalled();
  });
});
