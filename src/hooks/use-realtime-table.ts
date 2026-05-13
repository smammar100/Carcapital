"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { invalidate } from "@/lib/cache";

/**
 * Subscribe to postgres_changes on a Supabase table for a given company and
 * fire `onChange` for every insert/update/delete that lands.
 *
 * Pairs with the shared cache (`src/lib/cache.ts`): when an event arrives we
 * invalidate the namespace so the next read fetches fresh data, then call
 * the consumer-supplied callback (typically a refetch or router.refresh).
 *
 * Realtime must be enabled for the table in Supabase:
 *   Database → Replication → supabase_realtime publication.
 * The Phase 1 migration handles `warranties` and `warranty_claims`.
 */
export function useRealtimeTable(opts: {
  table: string;
  companyId: string | null | undefined;
  /** Cache prefix to invalidate on each event (e.g. "warranties:"). */
  invalidatePrefix?: string;
  /** Called after the cache is invalidated. Use for refetches / refresh. */
  onChange?: () => void;
}) {
  const { table, companyId, invalidatePrefix, onChange } = opts;
  useEffect(() => {
    if (!companyId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`realtime-${table}-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          if (invalidatePrefix) invalidate(invalidatePrefix);
          onChange?.();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, companyId, invalidatePrefix, onChange]);
}
