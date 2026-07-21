"use client";

import { useCallback, useRef, useState } from "react";
import {
  addressLookupService,
  type AddressSuggestion,
} from "@/lib/services/address-lookup-service";

interface UsePostcodeLookupResult {
  /** Trigger a search. Resolves to the suggestions (empty when nothing matched). */
  lookup: (postcode: string) => Promise<AddressSuggestion[]>;
  /**
   * Debounced search — call on every keystroke. Fires as soon as the postcode
   * has a plausible outward code, so the list appears while typing and there's
   * no button to press (GEN-68).
   */
  lookupDebounced: (postcode: string) => void;
  /** Addresses to choose from. */
  suggestions: AddressSuggestion[];
  isLoading: boolean;
  error: Error | null;
  /** True when a search completed and matched nothing. */
  notFound: boolean;
  /** Whether the provider can return per-premise addresses. */
  hasPremiseData: boolean;
  reset: () => void;
}

/** Wait this long after the last keystroke before spending a request. */
const DEBOUNCE_MS = 300;

/**
 * Enough of a postcode to be worth asking about.
 *
 * Deliberately looser than a full-postcode check: the outward code plus the
 * start of the inward ("UB1 3") is enough for a provider to work with, and
 * waiting for the last character makes the list feel like it arrives late.
 */
function isSearchable(postcode: string): boolean {
  const c = postcode.toUpperCase().replace(/\s+/g, "");
  return /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9]?[A-Z]{0,2}$/.test(c) && c.length >= 4;
}

/**
 * Suggestions are cached per postcode for the session — postcodes don't move,
 * and re-checking one you've already looked up should be instant. Misses are
 * NOT cached: a postcode that starts resolving later must not keep reporting
 * "no match" until reload.
 */
const cache = new Map<string, AddressSuggestion[]>();

const cacheKey = (postcode: string) =>
  postcode.toUpperCase().replace(/\s+/g, "");

/** Drop the cache. Exists so tests start from a known state. */
export function clearPostcodeCache(): void {
  cache.clear();
}

export function usePostcodeLookup(): UsePostcodeLookupResult {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against an earlier, slower request overwriting a later one.
  const latest = useRef(0);

  const lookup = useCallback(async (postcode: string) => {
    const key = cacheKey(postcode);
    if (!key) return [];

    const hit = cache.get(key);
    if (hit) {
      setSuggestions(hit);
      setNotFound(hit.length === 0);
      setError(null);
      setIsLoading(false);
      return hit;
    }

    const ticket = ++latest.current;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const found = await addressLookupService.search(postcode);
      if (found.length > 0) cache.set(key, found);
      // A stale response must not clobber a newer one.
      if (ticket !== latest.current) return found;
      setSuggestions(found);
      setNotFound(found.length === 0);
      return found;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (ticket === latest.current) {
        setError(e);
        setSuggestions([]);
      }
      return [];
    } finally {
      if (ticket === latest.current) setIsLoading(false);
    }
  }, []);

  const lookupDebounced = useCallback(
    (postcode: string) => {
      if (timer.current) clearTimeout(timer.current);
      if (!isSearchable(postcode)) {
        // Typing backwards past a usable postcode clears the stale list rather
        // than leaving suggestions for a postcode no longer on screen.
        setSuggestions([]);
        setNotFound(false);
        return;
      }
      timer.current = setTimeout(() => void lookup(postcode), DEBOUNCE_MS);
    },
    [lookup],
  );

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setSuggestions([]);
    setError(null);
    setNotFound(false);
  }, []);

  return {
    lookup,
    lookupDebounced,
    suggestions,
    isLoading,
    error,
    notFound,
    hasPremiseData: addressLookupService.hasPremiseData,
    reset,
  };
}
