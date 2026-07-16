"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, RefreshCw } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { notify } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdvertiserRecord } from "@/lib/types";

const PAGE_SIZE = 20;

interface AdvertiserPageResponse {
  advertisers: AdvertiserRecord[];
  page: number;
  pageSize: number;
  totalResults: number;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * /admin/advertisers — AutoTrader Connect Advertisers (Enhanced Go-Live).
 *
 * Lists the dealers configured on our integration, mirrored locally in
 * `at_advertisers`. "Sync now" pages the AutoTrader Advertisers API and
 * upserts the mirror; the Updated column shows when a row was last refreshed
 * by an advertiser-update notification. Gated by `advertiser:read`; sync gated
 * by `advertiser:sync`.
 */
export default function AdvertisersPage() {
  const { can, isSuperUser, isLoading: permsLoading } = usePermissions();
  const canRead = isSuperUser || can("advertiser:read");
  const canSync = isSuperUser || can("advertiser:sync");

  const [data, setData] = useState<AdvertiserPageResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  // Load failures must render as an ERROR, not as "No advertisers yet" — a
  // toast is transient, and an empty-looking list after a 500 tells the user
  // there are no advertisers when the truth is the data never arrived (GEN-50).
  const [loadError, setLoadError] = useState<string | null>(null);

  // Imperative reload (used after a sync) — setState here is fine outside an
  // effect. The effect below mirrors this but defers setState into .then so it
  // doesn't fire synchronously inside the effect body.
  const load = useCallback(async (p: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/autotrader/advertisers?page=${p}&pageSize=${PAGE_SIZE}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as AdvertiserPageResponse);
    } catch (e) {
      notify.error(`Couldn't load advertisers: ${String(e)}`);
      setLoadError(String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    fetch(`/api/autotrader/advertisers?page=${page}&pageSize=${PAGE_SIZE}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as AdvertiserPageResponse;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setLoadError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        notify.error(`Couldn't load advertisers: ${String(e)}`);
        setLoadError(String(e));
        setData(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, page]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/autotrader/advertisers", {
        method: "POST",
      });
      const body = (await res.json().catch(() => null)) as
        | { synced?: number; error?: string; detail?: string; cfRayId?: string }
        | null;
      if (!res.ok) {
        const ray = body?.cfRayId ? ` (ref ${body.cfRayId})` : "";
        notify.error(
          `Sync failed: ${body?.detail ?? body?.error ?? res.status}${ray}`,
        );
        return;
      }
      notify.success(`Synced ${body?.synced ?? 0} advertiser(s).`);
      setPage(1);
      await load(1);
    } catch (e) {
      notify.error(`Sync failed: ${String(e)}`);
    } finally {
      setSyncing(false);
    }
  }, [load]);

  if (permsLoading) {
    return <div className="text-sm text-muted-foreground">Loading session…</div>;
  }
  if (!canRead) {
    return (
      <div className="text-sm text-muted-foreground">
        You don&apos;t have access to AutoTrader Advertisers.
      </div>
    );
  }

  const advertisers = data?.advertisers ?? [];
  const total = data?.totalResults ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    // Padding comes from the layout's PageShell — pages don't add their own
    // (GEN-61).
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Building2 className="size-5" /> Advertisers
          </h1>
          <p className="text-sm text-muted-foreground">
            Dealers configured on our AutoTrader Connect integration. Sync pulls
            the latest list; updates arrive automatically via notifications.
          </p>
        </div>
        {canSync ? (
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={syncing ? "size-4 animate-spin" : "size-4"} />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        ) : null}
      </header>

      {/* bg-card: this wrapper had a border but no surface, so the table sat
          straight on the page grey (GEN-62). */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Advertiser ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead>Synced</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : loadError ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="flex flex-col items-start gap-2 py-4">
                    <span className="text-sm font-medium text-destructive">
                      Couldn&apos;t load advertisers ({loadError}).
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void load(page)}
                    >
                      <RefreshCw className="size-4" />
                      Retry
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : advertisers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground">
                  No advertisers yet.{" "}
                  {canSync ? "Run a sync to pull them from AutoTrader." : ""}
                </TableCell>
              </TableRow>
            ) : (
              advertisers.map((a) => (
                <TableRow key={a.advertiserId}>
                  <TableCell className="font-mono text-xs">
                    {a.advertiserId}
                  </TableCell>
                  <TableCell>{a.name ?? "—"}</TableCell>
                  <TableCell>
                    {a.status ? (
                      <Badge variant="secondary">{a.status}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{a.postcode ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatWhen(a.syncedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatWhen(a.atUpdatedAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {loadError
            ? "—"
            : `${total} advertiser${total === 1 ? "" : "s"} · page ${
                data?.page ?? page
              } of ${totalPages}`}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || (data?.page ?? page) <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || (data?.page ?? page) >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
