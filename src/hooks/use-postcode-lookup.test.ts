/**
 * GEN-68 — postcode lookup.
 *
 * The hook's job: spend as few requests as possible, never let a slow response
 * overwrite a fast one, and surface a list the UI can present for selection.
 * The provider is stubbed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { AddressSuggestion } from "@/lib/services/address-lookup-service";

const search = vi.fn();
vi.mock("@/lib/services/address-lookup-service", () => ({
  addressLookupService: {
    search: (pc: string) => search(pc),
    get hasPremiseData() {
      return false;
    },
    get providerName() {
      return "stub";
    },
    toAddressLine: (s: AddressSuggestion) =>
      [s.line1, s.label].filter(Boolean).join(", ").toUpperCase(),
  },
}));

import { clearPostcodeCache, usePostcodeLookup } from "./use-postcode-lookup";

const SUGGESTION: AddressSuggestion = {
  id: "TW34BZ",
  line1: "",
  town: "Hounslow",
  county: "London",
  postcode: "TW3 4BZ",
  label: "Heston East, Hounslow, London",
  isComplete: false,
};

beforeEach(() => {
  // Module-scoped cache lives for the whole session by design, so each test
  // has to start from empty.
  clearPostcodeCache();
  search.mockReset();
  search.mockResolvedValue([SUGGESTION]);
});

describe("lookup", () => {
  it("exposes the suggestions for the UI to list", async () => {
    const { result } = renderHook(() => usePostcodeLookup());
    await act(async () => {
      await result.current.lookup("TW3 4BZ");
    });
    expect(result.current.suggestions).toEqual([SUGGESTION]);
    expect(result.current.notFound).toBe(false);
  });

  it("caches by normalised postcode — spacing and case cost nothing", async () => {
    const { result } = renderHook(() => usePostcodeLookup());
    await act(async () => {
      await result.current.lookup("TW3 4BZ");
      await result.current.lookup("tw34bz");
      await result.current.lookup("  TW3  4BZ ");
    });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("does not cache a miss — a postcode may start resolving later", async () => {
    search.mockResolvedValue([]);
    const { result } = renderHook(() => usePostcodeLookup());
    await act(async () => {
      await result.current.lookup("ZZ1 1ZZ");
      await result.current.lookup("ZZ1 1ZZ");
    });
    expect(search).toHaveBeenCalledTimes(2);
    expect(result.current.notFound).toBe(true);
  });

  it("separates a provider outage from a genuine miss", async () => {
    search.mockRejectedValue(new Error("503"));
    const { result } = renderHook(() => usePostcodeLookup());
    await act(async () => {
      await result.current.lookup("TW3 4BZ");
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.notFound).toBe(false);
    expect(result.current.suggestions).toEqual([]);
  });
});

describe("lookupDebounced", () => {
  it("spends nothing until the postcode is worth asking about", async () => {
    const { result } = renderHook(() => usePostcodeLookup());
    act(() => {
      for (const partial of ["T", "TW"]) {
        result.current.lookupDebounced(partial);
      }
    });
    await new Promise((r) => setTimeout(r, 450));
    expect(search).not.toHaveBeenCalled();
  });

  it("fires on a partial postcode — the list shouldn't wait for the last character", async () => {
    const { result } = renderHook(() => usePostcodeLookup());
    act(() => {
      result.current.lookupDebounced("UB1 3");
    });
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
  });

  it("collapses a burst of keystrokes into one request", async () => {
    const { result } = renderHook(() => usePostcodeLookup());
    act(() => {
      for (let i = 0; i < 5; i++) result.current.lookupDebounced("TW3 4BZ");
    });
    await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
  });

  it("clears stale suggestions when the postcode is deleted back", async () => {
    const { result } = renderHook(() => usePostcodeLookup());
    act(() => result.current.lookupDebounced("TW3 4BZ"));
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
    act(() => result.current.lookupDebounced("TW"));
    expect(result.current.suggestions).toEqual([]);
  });
});

describe("reset", () => {
  it("clears the list so a picked address doesn't leave the dropdown open", async () => {
    const { result } = renderHook(() => usePostcodeLookup());
    await act(async () => {
      await result.current.lookup("TW3 4BZ");
    });
    expect(result.current.suggestions).toHaveLength(1);
    act(() => result.current.reset());
    expect(result.current.suggestions).toEqual([]);
  });
});
