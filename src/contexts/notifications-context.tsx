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
    setNotifications(list);
    setUnreadCount(count);
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
