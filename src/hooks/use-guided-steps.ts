"use client";

import { useMemo } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { guidedStepsFor, type GuidedStep } from "@/lib/onboarding/tour-steps";

/**
 * The tour steps for the signed-in user.
 *
 * Both the tour and the sidebar index the running tour by `currentStep`, so
 * they have to be looking at the same array. When the tour ran a filtered list
 * and the sidebar still read the full one, step 3 of five resolved against
 * step 3 of twelve: the sidebar opened the wrong group, or none, and the step
 * pointed at a nav item that was never rendered (GEN-127).
 *
 * One hook, so they cannot drift again.
 */
export function useGuidedSteps(): GuidedStep[] {
  const { capabilities, isSuperUser } = usePermissions();
  return useMemo(
    () => guidedStepsFor(capabilities, isSuperUser),
    [capabilities, isSuperUser],
  );
}
