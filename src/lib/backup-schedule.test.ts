import { describe, expect, it } from "vitest";
import {
  BACKUP_INTERVAL_DAYS,
  backupFilename,
  getBackupStatus,
  isBackupDue,
} from "./backup-schedule";

const NOW = new Date("2026-08-25T12:00:00Z");
const daysAgo = (n: number) =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("getBackupStatus", () => {
  it("distinguishes never-backed-up from overdue", () => {
    const status = getBackupStatus(null, NOW);
    expect(status.urgency).toBe("never");
    expect(status.daysSince).toBeNull();
    expect(status.message).toMatch(/no backup has been taken yet/i);
  });

  it("treats an unparseable timestamp as never", () => {
    expect(getBackupStatus("not-a-date", NOW).urgency).toBe("never");
  });

  it("is ok immediately after a backup", () => {
    const status = getBackupStatus(daysAgo(0), NOW);
    expect(status.urgency).toBe("ok");
    expect(status.daysSince).toBe(0);
    expect(status.message).toBe("Backed up today.");
  });

  it("stays ok inside the interval", () => {
    const status = getBackupStatus(daysAgo(3), NOW);
    expect(status.urgency).toBe("ok");
    expect(status.daysSince).toBe(3);
    expect(status.daysUntilDue).toBe(4);
  });

  // GEN-90 UAT 4 — seven days past the last backup, the reminder appears.
  it("becomes due exactly on the interval boundary", () => {
    const status = getBackupStatus(daysAgo(BACKUP_INTERVAL_DAYS), NOW);
    expect(status.urgency).toBe("due");
    expect(status.daysUntilDue).toBe(0);
    expect(status.message).toMatch(/your backup is due/i);
  });

  it("is still due well past the interval", () => {
    const status = getBackupStatus(daysAgo(30), NOW);
    expect(status.urgency).toBe("due");
    expect(status.daysSince).toBe(30);
  });

  it("is not due one day short of the interval", () => {
    expect(getBackupStatus(daysAgo(6), NOW).urgency).toBe("ok");
  });

  it("singularises the one-day message", () => {
    expect(getBackupStatus(daysAgo(1), NOW).message).toMatch(/1 day ago/);
  });

  it("pluralises beyond one day", () => {
    expect(getBackupStatus(daysAgo(2), NOW).message).toMatch(/2 days ago/);
  });

  it("clamps a future timestamp rather than reporting negative days", () => {
    const future = new Date(NOW.getTime() + 86_400_000).toISOString();
    const status = getBackupStatus(future, NOW);
    expect(status.daysSince).toBe(0);
    expect(status.urgency).toBe("ok");
  });
});

describe("isBackupDue", () => {
  // GEN-90 UAT 3 — no reminder right after taking one.
  it("is false just after a backup", () => {
    expect(isBackupDue(daysAgo(0), NOW)).toBe(false);
  });

  it("is true once overdue", () => {
    expect(isBackupDue(daysAgo(8), NOW)).toBe(true);
  });

  it("is true when there has never been a backup", () => {
    expect(isBackupDue(null, NOW)).toBe(true);
  });
});

describe("backupFilename", () => {
  it("slugs the company name and stamps the date", () => {
    expect(backupFilename("Car Capital UK", NOW)).toBe(
      "car-capital-uk-backup-2026-08-25.xlsx",
    );
  });

  it("strips punctuation", () => {
    expect(backupFilename("O'Brien & Sons, Ltd.", NOW)).toBe(
      "o-brien-sons-ltd-backup-2026-08-25.xlsx",
    );
  });

  it("falls back when the name has nothing usable", () => {
    expect(backupFilename("!!!", NOW)).toBe("backup-backup-2026-08-25.xlsx");
  });

  // Successive backups must not overwrite each other in the downloads folder.
  it("differs across days", () => {
    const a = backupFilename("Car Capital", new Date("2026-08-25T00:00:00Z"));
    const b = backupFilename("Car Capital", new Date("2026-08-26T00:00:00Z"));
    expect(a).not.toBe(b);
  });
});
