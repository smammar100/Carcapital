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
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const handleEvent = () => {
      if (invalidatePrefix) invalidate(invalidatePrefix);
      onChange?.();
    };

    const subscribe = () => {
      if (disposed) return;
      channel = supabase
        .channel(`realtime-${table}-${companyId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `company_id=eq.${companyId}`,
          },
          handleEvent,
        )
        .subscribe((status) => {
          // The realtime socket drops on idle timeout / network blips with
          // no built-in recovery — that's why live data went stale until a
          // hard reload. Tear down and re-subscribe on a short backoff so
          // updates resume on their own.
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
              if (disposed) return;
              if (channel) void supabase.removeChannel(channel);
              subscribe();
            }, 2000);
          }
        });
    };

    subscribe();

    // Reconnect immediately when the tab/network returns rather than
    // waiting for the next error tick (debounced so a focus burst doesn't
    // stack channels).
    const onWake = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      )
        return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (disposed) return;
        if (channel) void supabase.removeChannel(channel);
        subscribe();
      }, 500);
    };
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [table, companyId, invalidatePrefix, onChange]);
}
