/**
 * When a data backup is due (GEN-90).
 *
 * Car Capital lost a full database once, and asked for a backup they take
 * themselves rather than one that happens silently — the export carries the
 * whole business, so a person should knowingly ask for it and receive it.
 * That makes the reminder the important half of the feature: without a nudge,
 * a manual backup is a backup nobody takes.
 *
 * Framework-free so the interval rules can be unit-tested.
 */

/** Agreed on the call: a weekly nudge. */
export const BACKUP_INTERVAL_DAYS = 7;

const DAY_MS = 86_400_000;

export type BackupUrgency = "never" | "due" | "ok";

export interface BackupStatus {
  urgency: BackupUrgency;
  /** Whole days since the last backup; null when there has never been one. */
  daysSince: number | null;
  /** Whole days until the next one falls due; 0 when already due. */
  daysUntilDue: number;
  /** Ready-to-render sentence for the bell notification and settings panel. */
  message: string;
}

/**
 * Work out the backup state from the last recorded backup.
 *
 * A company that has never taken one is `never` rather than `due` — the
 * wording differs ("set up your first backup" vs "your backup is due"), and
 * conflating them makes the first-run experience read like a failure.
 */
export function getBackupStatus(
  lastBackupAt: string | null,
  now: Date = new Date(),
): BackupStatus {
  if (!lastBackupAt) {
    return {
      urgency: "never",
      daysSince: null,
      daysUntilDue: 0,
      message: "No backup has been taken yet. Download one to protect your data.",
    };
  }

  const last = new Date(lastBackupAt).getTime();
  if (Number.isNaN(last)) {
    return {
      urgency: "never",
      daysSince: null,
      daysUntilDue: 0,
      message: "No backup has been taken yet. Download one to protect your data.",
    };
  }

  const daysSince = Math.max(0, Math.floor((now.getTime() - last) / DAY_MS));
  const daysUntilDue = Math.max(0, BACKUP_INTERVAL_DAYS - daysSince);

  if (daysSince >= BACKUP_INTERVAL_DAYS) {
    return {
      urgency: "due",
      daysSince,
      daysUntilDue: 0,
      message: `Your backup is due — the last one was ${daysSince} days ago. Kindly download a backup.`,
    };
  }

  return {
    urgency: "ok",
    daysSince,
    daysUntilDue,
    message:
      daysSince === 0
        ? "Backed up today."
        : `Last backup ${daysSince} day${daysSince === 1 ? "" : "s"} ago. Next due in ${daysUntilDue}.`,
  };
}

/** True when the bell should carry a backup reminder. */
export function isBackupDue(
  lastBackupAt: string | null,
  now: Date = new Date(),
): boolean {
  return getBackupStatus(lastBackupAt, now).urgency !== "ok";
}

/** Filename for the export — dated so successive backups do not overwrite. */
export function backupFilename(
  companyName: string,
  now: Date = new Date(),
): string {
  const slug =
    companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "backup";
  const stamp = now.toISOString().slice(0, 10);
  return `${slug}-backup-${stamp}.xlsx`;
}
