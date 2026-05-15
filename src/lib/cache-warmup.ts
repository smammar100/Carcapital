/**
 * Fire-and-forget pre-fetch of the queries every dashboard route reads.
 *
 * Called once from the auth context as soon as `user` + `company` resolve.
 * All these methods go through `src/lib/cache.ts` (`withCache`), so by the
 * time any dashboard component's useEffect runs `vehicleService.getAll(…)`
 * the in-flight promise is already settled (or the cached value is ready)
 * and `setState` happens synchronously enough to feel instant.
 *
 * Failures here are silently swallowed — each component still does its own
 * fetch on mount; the warm-up is a best-effort optimisation, not a hard
 * dependency. The 30s TTL on the cache means even slow networks benefit
 * because subsequent navigations reuse the populated entries.
 */
import { vehicleService } from "@/lib/services/vehicle-service";
import { salesService } from "@/lib/services/sales-service";
import { leadService } from "@/lib/services/lead-service";
import { appointmentService } from "@/lib/services/appointment-service";
import { claimService } from "@/lib/services/claim-service";
import { warrantyService } from "@/lib/services/warranty-service";
import { notificationService } from "@/lib/services/notification-service";
import { activityService } from "@/lib/services/activity-service";
import { maintenanceService } from "@/lib/services/maintenance-service";
import type { UUID } from "@/lib/types";

export async function warmDashboardCache(
  companyId: UUID,
  userId: UUID,
): Promise<void> {
  const tasks: Promise<unknown>[] = [
    // The dashboard reads these via 5+ components — one fetch each, deduped.
    vehicleService.getAll(companyId),
    salesService.getAll(companyId),
    leadService.getAll(companyId),
    appointmentService.getAll(companyId),
    maintenanceService.getAll(companyId),
    activityService.getAll(companyId),
    // Sidebar badges + KPIs need these immediately.
    claimService.getAll(companyId),
    claimService.getOpenCount(companyId),
    warrantyService.getByType("in_house", companyId),
    warrantyService.getByType("external", companyId),
    warrantyService.getTotalCountByType(companyId),
    warrantyService.getPendingPurchaseCount(companyId),
    warrantyService.getActiveCount(companyId),
    warrantyService.getExpiringSoon(companyId, 30),
    // Header bell — unread notifications count.
    notificationService.getForUser(userId),
    notificationService.getUnreadCount(userId),
  ];

  // Fire all queries in parallel; ignore individual failures.
  await Promise.allSettled(tasks);
}
