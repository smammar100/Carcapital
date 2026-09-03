"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { permissionService } from "@/lib/services/permission-service";
import { capabilitiesForRoles } from "@/lib/roles";
import type { Capability } from "@/lib/capabilities";

export interface UsePermissionsResult {
  /** All capabilities granted to the current user (empty for super-users — they bypass). */
  capabilities: Set<Capability>;
  /** True if the user is a super-user (bypass). */
  isSuperUser: boolean;
  /** Capability check. Always true for super-users; otherwise membership in `capabilities`. */
  can: (capability: Capability) => boolean;
  isLoading: boolean;
}

/**
 * v4.1 Gap 3 — capability-based authority.
 *
 * Usage:
 *   const { can } = usePermissions();
 *   if (can("invoice:generate")) { ... }
 *
 * Replaces every `user.role === ...` check throughout the app.
 */
export function usePermissions(): UsePermissionsResult {
  const { user } = useAuth();
  const [capabilities, setCapabilities] = useState<Set<Capability>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCapabilities(new Set());
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    // Effective set = union of role-bundle caps + explicit grants.
    void permissionService
      .getForUser(user.id)
      .then((rows) => {
        const all = capabilitiesForRoles(user.roles);
        for (const r of rows) all.add(r.capability as Capability);
        setCapabilities(all);
        setIsLoading(false);
      })
      .catch((e) => {
        // A failed grants fetch must NOT wedge isLoading=true forever (that
        // disables every gated control). Fall back to role-based caps so the
        // user keeps the authority their roles grant.
        console.warn("[permissions] explicit grants fetch failed:", e);
        setCapabilities(capabilitiesForRoles(user.roles));
        setIsLoading(false);
      });
  }, [user]);

  const isSuperUser = user?.isSuperUser ?? false;

  // Stable across re-renders within the same (capabilities, isSuperUser) cycle
  // so that downstream useMemo hooks listing `can` in their deps don't churn.
  const can = useCallback(
    (capability: Capability): boolean => {
      if (isSuperUser) return true;
      return capabilities.has(capability);
    },
    [capabilities, isSuperUser],
  );

  return { capabilities, isSuperUser, can, isLoading };
}
