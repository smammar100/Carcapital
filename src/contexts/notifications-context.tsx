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
import type { Notification } from "@/lib/types";
import { useAuth } from "./auth-context";

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  refresh: () => Promise<void>;
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

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const list = await notificationService.getForUser(user.id);
    setNotifications(list);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await notificationService.markAllRead(user.id);
    await refresh();
  }, [user, refresh]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, refresh, markAllRead }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
