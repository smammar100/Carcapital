import { createClient } from "@/lib/supabase/client";
import type { UUID } from "@/lib/types";

export const onboardingService = {
  /**
   * Stamp the user as having been through the tour.
   *
   * Called for a finish AND for a skip: both are the user telling us they are
   * done with it, and re-prompting someone who dismissed it on every sign-in
   * is how a helpful tour turns into an irritation. The Help menu restarts it
   * on demand for anyone who wants it back.
   */
  async markComplete(userId: UUID): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(error.message);
  },
};
