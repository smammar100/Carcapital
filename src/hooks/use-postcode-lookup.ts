"use client";

import { useCallback, useRef, useState } from "react";
import { customerService } from "@/lib/services/customer-service";
import { isValidPostcode } from "@/lib/formatters";

interface CannedAddress {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
}

interface UsePostcodeLookupResult {
  /** Trigger a lookup. Resolves to the address (or null if not found). */
  lookup: (postcode: string) => Promise<CannedAddress | null>;
  /**
   * Debounced auto-lookup — call on every keystroke. Fires only once the
   * postcode is well-formed, so it costs nothing while the user is still
   * typing. Removes the extra "Lookup" click the flow used to need (GEN-68).
   */
  lookupDebounced: (
    postcode: string,
    onResult?: (address: CannedAddress) => void,
  ) => void;
  isLoading: boolean;
  result: CannedAddress | null;
  error: Error | null;
  /** True when a lookup completed and the postcode matched nothing. */
  notFound: boolean;
  /** Reset state — clears the last result/error. */
  reset: () => void;
}

/** Wait this long after the last keystroke before spending a request. */
const DEBOUNCE_MS = 350;

/**
 * Postcodes are immutable, so a result is cached for the session. Re-checking
 * one you've already looked up is then instant rather than another round trip
 * — which is most of the "it's slow" complaint on a form you revisit.
 */
const cache = new Map<string, CannedAddress>();

const cacheKey = (postcode: string) =>
  postcode.toUpperCase().replace(/\s+/g, "");

/** Drop the cache. Exists so tests start from a known state. */
export function clearPostcodeCache(): void {
  cache.clear();
}

/**
 * Postcode → address lookup.
 *
 * Backed by postcodes.io, which is a GEOGRAPHIC API: it resolves a postcode to
 * its ward, district and county. It does not hold street names, house numbers
 * or flat numbers — no free UK API does, that's Royal Mail PAF data. So this
 * fills the town/county part and the user still types their own house number
 * and street. Picking a specific address from a list of premises needs a paid
 * PAF provider (getAddress.io, Ideal Postcodes, Loqate).
 */
export function usePostcodeLookup(): UsePostcodeLookupResult {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CannedAddress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against an earlier, slower request overwriting a later one.
  const latest = useRef(0);

  const lookup = useCallback(async (postcode: string) => {
    const key = cacheKey(postcode);
    if (!key) return null;

    // Only hits are cached. Caching a miss would keep saying "no match" for
    // the rest of the session even after the postcode starts resolving.
    const hit = cache.get(key);
    if (hit) {
      setResult(hit);
      setNotFound(false);
      setError(null);
      setIsLoading(false);
      return hit;
    }

    const ticket = ++latest.current;
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const address = await customerService.lookupAddressByPostcode(postcode);
      if (address) cache.set(key, address);
      // A stale response must not clobber a newer one.
      if (ticket !== latest.current) return address;
      setResult(address);
      setNotFound(address === null);
      return address;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (ticket === latest.current) setError(e);
      return null;
    } finally {
      if (ticket === latest.current) setIsLoading(false);
    }
  }, []);

  const lookupDebounced = useCallback(
    (postcode: string, onResult?: (address: CannedAddress) => void) => {
      if (timer.current) clearTimeout(timer.current);
      // Don't spend a request on a half-typed postcode.
      if (!isValidPostcode(postcode)) {
        setNotFound(false);
        return;
      }
      timer.current = setTimeout(() => {
        void lookup(postcode).then((address) => {
          if (address && onResult) onResult(address);
        });
      }, DEBOUNCE_MS);
    },
    [lookup],
  );

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setResult(null);
    setError(null);
    setNotFound(false);
  }, []);

  return { lookup, lookupDebounced, isLoading, result, error, notFound, reset };
}
