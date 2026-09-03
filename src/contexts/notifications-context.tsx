"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { notificationService } from "@/lib/services/notification-service";
import { useRealtimeTable } from "@/hooks/use-realtime-table";
import type { Notification } from "@/lib/types";
import { useAuth } from "./auth-context";
import { backupService } from "@/lib/services/backup-service";
import { getBackupStatus } from "@/lib/backup-schedule";

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const NotificationsContext =
  createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx)
    throw new Error(
      "useNotifications must be used inside <NotificationsProvider>",
    );
  return ctx;
}

/** Synthetic id so the header can tell a derived reminder from a real row. */
const BACKUP_REMINDER_ID = "derived:backup-due";

async function buildBackupReminder(
  companyId: string,
  userId: string,
): Promise<Notification | null> {
  const lastBackupAt = await backupService.getLastBackupAt(companyId);
  const status = getBackupStatus(lastBackupAt);
  if (status.urgency === "ok") return null;

  return {
    id: BACKUP_REMINDER_ID,
    companyId,
    userId,
    type: status.urgency === "never" ? "warning" : "urgent",
    title: "Backup due",
    body: status.message,
    link: "/admin/settings",
    read: false,
    createdAt: new Date().toISOString(),
  };
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    // Source the badge from the accurate count query rather than the
    // (capped) list the dropdown renders.
    const [list, count] = await Promise.all([
      notificationService.getForUser(user.id),
      notificationService.getUnreadCount(user.id),
    ]);

    /**
     * The weekly backup reminder (GEN-90) is derived, not stored.
     *
     * A persisted row would need a scheduler to create it and another to
     * clear it, and would go stale the moment someone takes a backup from
     * another device. Computing it from the last recorded backup means the
     * reminder is correct by construction and disappears on its own.
     */
    const backupReminder = user.companyId
      ? await buildBackupReminder(user.companyId, user.id)
      : null;

    setNotifications(backupReminder ? [backupReminder, ...list] : list);
    setUnreadCount(count + (backupReminder ? 1 : 0));
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Notifications are user-scoped — subscribe on user_id so new rows show up
  // without a manual reload. Cleanup is handled inside the hook on unmount.
  useRealtimeTable({
    table: "notifications",
    companyId: user?.id ?? null,
    filterColumn: "user_id",
    invalidatePrefix: "notifications:",
    onChange: () => void refresh(),
  });

  const markRead = useCallback(
    async (id: string) => {
      // The backup reminder is derived, not a row — there is nothing to mark,
      // and it clears itself once a backup is actually taken. Writing here
      // would 404 against a non-existent id.
      if (id === BACKUP_REMINDER_ID) return;
      await notificationService.markRead(id);
      await refresh();
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await notificationService.markAllRead(user.id);
    await refresh();
  }, [user, refresh]);

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, refresh, markRead, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
