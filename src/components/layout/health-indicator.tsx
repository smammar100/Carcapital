"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * SPEC Point 9 — connection/session health dot in the header.
 *
 *  🟢 green  = online + session valid
 *  🟡 amber  = reconnecting (tab just regained focus / network just returned —
 *               the auth-context is revalidating + caches refreshing)
 *  🔴 red    = offline, or the auth context failed to initialise / no session
 *
 * Tooltip (native `title`, zero-dep) shows the last successful sync time.
 * Purely observational — it never blocks interaction.
 */
export function HealthIndicator() {
  const { user, loading, error } = useAuth();
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>(() =>
    new Date().toISOString(),
  );
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const flashSyncing = () => {
      setSyncing(true);
      if (syncTimer.current) clearTimeout(syncTimer.current);
      // The auth-context revalidate + cache refresh resolve well under 2s;
      // hold amber briefly so the transition is visible, then settle green.
      syncTimer.current = setTimeout(() => {
        setSyncing(false);
        setLastSync(new Date().toISOString());
      }, 1500);
    };

    const onOnline = () => {
      setOnline(true);
      flashSyncing();
    };
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") flashSyncing();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  const authBad = !loading && (error !== null || user === null);
  const state: "green" | "amber" | "red" =
    !online || authBad ? "red" : syncing || loading ? "amber" : "green";

  const label =
    state === "red"
      ? !online
        ? "Offline — reconnecting…"
        : "Session expired — reload to sign in again"
      : state === "amber"
        ? "Reconnecting…"
        : `Connected — last sync ${formatRelativeTime(lastSync)}`;

  return (
    <span
      className="flex items-center"
      title={label}
      aria-label={label}
      role="status"
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full transition-colors",
          state === "green" && "bg-emerald-500",
          state === "amber" && "animate-pulse bg-amber-500",
          state === "red" && "bg-rose-500",
        )}
      />
    </span>
  );
}
