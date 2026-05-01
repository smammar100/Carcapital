import { mockNotifications } from "@/lib/mock-data";
import type { Notification, UUID } from "@/lib/types";
import { delay } from "./_base";

export const notificationService = {
  async getForUser(userId: UUID): Promise<Notification[]> {
    // TODO: Supabase: from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    await delay(150);
    return mockNotifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getUnreadCount(userId: UUID): Promise<number> {
    // TODO: Supabase: ... .eq('read', false).select('*', { count: 'exact', head: true })
    await delay(100);
    return mockNotifications.filter((n) => n.userId === userId && !n.read)
      .length;
  },

  async markAllRead(userId: UUID): Promise<void> {
    // TODO: Supabase: update().eq('user_id', userId).eq('read', false)
    await delay();
    mockNotifications.forEach((n) => {
      if (n.userId === userId) n.read = true;
    });
  },

  async markRead(id: UUID): Promise<void> {
    // TODO: Supabase: update({ read: true }).eq('id', id)
    await delay(100);
    const n = mockNotifications.find((x) => x.id === id);
    if (n) n.read = true;
  },
};
