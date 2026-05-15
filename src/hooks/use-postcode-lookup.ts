"use client";

import { useCallback, useState } from "react";
import { customerService } from "@/lib/services/customer-service";

interface CannedAddress {
  line1: string;
  line2: string;
  line3: string;
  line4: string;
}

interface UsePostcodeLookupResult {
  /** Trigger a lookup. Resolves to the address (or null if not found). */
  lookup: (postcode: string) => Promise<CannedAddress | null>;
  isLoading: boolean;
  result: CannedAddress | null;
  error: Error | null;
  /** Reset state — clears the last result/error. */
  reset: () => void;
}

/**
 * Manual-trigger postcode lookup. The form's "Lookup" button calls
 * `lookup(postcode)` on click — we don't auto-fire on every keystroke
 * because the stub call is intentionally throttled (200ms) and most
 * users want to confirm the postcode before paying for the lookup.
 *
 * Backed by `customerService.lookupAddressByPostcode` which currently
 * returns canned data for three demo postcodes. Swap in postcodes.io
 * later — the hook signature won't change.
 */
export function usePostcodeLookup(): UsePostcodeLookupResult {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CannedAddress | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const lookup = useCallback(async (postcode: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const address = await customerService.lookupAddressByPostcode(postcode);
      setResult(address);
      return address;
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { lookup, isLoading, result, error, reset };
}
