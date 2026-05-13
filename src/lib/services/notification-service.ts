import { createClient } from "@/lib/supabase/client";
import type { Notification, UUID } from "@/lib/types";

const SELECT = `
  id,
  companyId:company_id,
  userId:user_id,
  type,
  title,
  body,
  link,
  read,
  createdAt:created_at
`;

export const notificationService = {
  async getForUser(userId: UUID): Promise<Notification[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select(SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Notification[];
  },

  async getUnreadCount(userId: UUID): Promise<number> {
    const supabase = createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (error) throw error;
    return count ?? 0;
  },

  async markAllRead(userId: UUID): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    if (error) throw error;
  },

  async markRead(id: UUID): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);
    if (error) throw error;
  },
};
