"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/lib/toast";
import { useAuth } from "@/contexts/auth-context";
import { backupService } from "@/lib/services/backup-service";
import {
  backupFilename,
  getBackupStatus,
  type BackupStatus,
} from "@/lib/backup-schedule";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

/**
 * Settings › Backup (GEN-90).
 *
 * A deliberately manual export: the user asks for it and receives the file
 * directly. The panel's real job is making the *state* legible — when the last
 * backup was, and whether one is due — because a manual backup nobody is
 * reminded about is a backup nobody takes.
 */
export function BackupPanel() {
  const { company, user } = useAuth();
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  /**
   * `loading` starts true and is only cleared after the await, so nothing sets
   * state synchronously inside the effect body — that pattern triggers a
   * cascading re-render on mount.
   */
  const refresh = useCallback(async () => {
    const companyId = company?.id;
    if (!companyId) return;
    const at = await backupService.getLastBackupAt(companyId);
    setLastBackupAt(at);
    setLoading(false);
  }, [company]);

  useEffect(() => {
    let cancelled = false;
    const companyId = company?.id;
    if (!companyId) return;
    void backupService.getLastBackupAt(companyId).then((at) => {
      if (cancelled) return;
      setLastBackupAt(at);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [company]);

  async function handleDownload() {
    if (!company?.id || !user?.id) return;
    setBusy(true);
    try {
      const result = await backupService.createBackup(
        company.id,
        user.id,
        backupFilename(company.name),
      );
      if (result.recorded) {
        toast.success(
          `Backup downloaded — ${result.rows.toLocaleString()} rows across ${result.sheets} sheets.`,
        );
      } else {
        // The file is in the user's hands, which is what matters; be honest
        // that the reminder cannot reset until the migration is applied.
        toast.success(
          "Backup downloaded, but it could not be recorded — the reminder will stay due.",
        );
      }
      await refresh();
    } catch {
      toast.error("Could not build the backup. Nothing was downloaded.");
    } finally {
      setBusy(false);
    }
  }

  const status: BackupStatus = getBackupStatus(lastBackupAt);
  const needsAttention = status.urgency !== "ok";

  return (
    <Card
      className={cn(
        needsAttention && !loading && "border-amber-400/60 bg-amber-50/50",
      )}
    >
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-md border bg-card",
              needsAttention ? "text-amber-600" : "text-emerald-600",
            )}
          >
            {needsAttention ? (
              <TriangleAlert className="size-4" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-base font-semibold">Data backup</div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              Download a complete copy of your data — vehicles, inspections,
              deals, invoices, customers and more — as an Excel workbook. Take
              one weekly so a problem can never cost you more than a week.
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </div>
          <div
            className="mt-1 text-sm"
            data-testid="backup-status"
            aria-live="polite"
          >
            {loading ? "Checking…" : status.message}
          </div>
          {lastBackupAt && !loading && (
            <div className="mt-1 text-xs text-muted-foreground">
              Last backup: {formatDateTime(lastBackupAt)}
            </div>
          )}
        </div>

        <div>
          <Button onClick={() => void handleDownload()} disabled={busy || loading}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {busy ? "Preparing backup…" : "Download data backup"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
