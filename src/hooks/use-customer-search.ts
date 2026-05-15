"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import {
  customerService,
  type CustomerSearchResult,
} from "@/lib/services/customer-service";

interface UseCustomerSearchResult {
  results: CustomerSearchResult[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Debounced customer search used by the Add Enquiry modal's dedup step.
 *
 * - 300ms debounce so the user can finish typing before we fire a query.
 * - Only fires when `query.trim().length >= 2`; below that we return an
 *   empty result set immediately and skip the network call.
 * - Cancels stale requests via a ref counter so out-of-order responses
 *   don't overwrite the latest results.
 *
 * Service-layer matching (digits-only phone, lowercased email, normalised
 * postcode, name substring) lives in `customer-service.searchCustomers`.
 */
export function useCustomerSearch(
  query: string,
  limit: number = 10,
): UseCustomerSearchResult {
  const { company } = useAuth();
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!company?.id || trimmed.length < 2) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const currentRequestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    const handle = setTimeout(() => {
      customerService
        .searchCustomers(company.id, trimmed, limit)
        .then((rows) => {
          if (currentRequestId !== requestIdRef.current) return;
          setResults(rows);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (currentRequestId !== requestIdRef.current) return;
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(handle);
    };
  }, [query, limit, company?.id]);

  return { results, isLoading, error };
}
