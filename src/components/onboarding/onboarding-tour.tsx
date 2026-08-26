"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Onborda, OnbordaProvider, useOnborda } from "onborda";
import { useAuth } from "@/contexts/auth-context";
import { onboardingService } from "@/lib/services/onboarding-service";
import { GUIDED_STEPS, TOURS, WELCOME_TOUR } from "@/lib/onboarding/tour-steps";
import { useIsWelcomeScreen } from "@/hooks/use-has-vehicles";
import { TourCard } from "./tour-card";

/**
 * Starts the tour for anyone who has never taken it, advances it when the user
 * performs a step's action, and records completion when it ends.
 *
 * Must live INSIDE OnbordaProvider — `useOnborda` reads that context — which
 * is why the provider and this controller are separate components.
 */
function TourController() {
  const { user, revalidate } = useAuth();
  const { startOnborda, isOnbordaVisible, currentStep, setCurrentStep } =
    useOnborda();
  const pathname = usePathname();

  const userId = user?.id ?? null;
  // Not while the first-run screen is up. Every step after the second
  // highlights a nav item, and that screen deliberately has no nav — the tour
  // would spotlight nothing at all. It starts on the dashboard proper, once
  // there is a car to look at and a rail to teach.
  const isWelcome = useIsWelcomeScreen(pathname);
  const needsTour = Boolean(
    user && user.onboardingCompletedAt === null && !isWelcome,
  );

  // Guards against re-opening the tour the instant it is dismissed: closing it
  // writes the completion date, but until that refetch lands `needsTour` is
  // still true and the effect would fire straight back up.
  //
  // It re-arms when the user becomes un-onboarded again, which is what makes
  // "Replay the tour" work — that clears the date, and this effect is the one
  // and only thing that starts a tour. A latch that never released would leave
  // replay silently doing nothing on a session that had already been through it.
  const startedRef = React.useRef(false);

  React.useEffect(() => {
    if (!needsTour) {
      startedRef.current = false;
      return;
    }
    // Start from the dashboard only. The Add Vehicle step points at the
    // greeting's button, and starting on an arbitrary deep link would
    // highlight an element that is not there.
    if (startedRef.current || pathname !== "/dashboard") return;
    startedRef.current = true;
    startOnborda(WELCOME_TOUR);
  }, [needsTour, pathname, startOnborda]);

  // Advance when the user reaches the route the current step asked for. This
  // is what makes the middle of the tour a tutorial rather than a slideshow:
  // the step is satisfied by the real click on the real nav item, and pressing
  // Next is not offered as a substitute.
  React.useEffect(() => {
    if (!isOnbordaVisible) return;
    const step = GUIDED_STEPS[currentStep];
    if (!step?.awaitRoute || pathname !== step.awaitRoute) return;
    // Let the destination paint before moving the spotlight, otherwise the
    // pointer measures the outgoing page and lands in the wrong place.
    setCurrentStep(currentStep + 1, 450);
  }, [pathname, currentStep, isOnbordaVisible, setCurrentStep]);

  // Persist completion by watching the tour close rather than by wiring a
  // callback into every exit path. Onborda ends in three ways — Finish, Skip
  // and the X — and all three land here, so none can slip through and leave
  // the user marked un-onboarded.
  const wasVisible = React.useRef(false);
  React.useEffect(() => {
    if (isOnbordaVisible) {
      wasVisible.current = true;
      return;
    }
    if (!wasVisible.current || !userId) return;
    wasVisible.current = false;
    void onboardingService
      .markComplete(userId)
      .then(() => revalidate())
      // A failed write is not worth interrupting the user for: the cost is
      // being offered the tour again next time, not lost work.
      .catch(() => {});
  }, [isOnbordaVisible, userId, revalidate]);

  return null;
}

/**
 * Returns a callback that replays the tour from the top.
 *
 * Lives here rather than in the header so the "get to the dashboard first"
 * rule sits next to the auto-start that shares it: the Add Vehicle step points
 * at the greeting's button, which exists on no other page. Starting while the
 * navigation is still in flight makes Onborda measure the outgoing page and
 * render the first card half off-screen, so a replay from elsewhere waits for
 * the route to commit before it begins.
 *
 * It starts the tour directly instead of clearing the user's completion date
 * and letting the auto-start effect notice — the signed-in user is cached, so
 * that refetch is not reliable and the replay silently did nothing. Closing it
 * writes a fresh completion date exactly as a first run does.
 */
export function useReplayTour(): () => void {
  const router = useRouter();
  const pathname = usePathname();
  const { startOnborda } = useOnborda();
  const pending = React.useRef(false);

  React.useEffect(() => {
    if (!pending.current || pathname !== "/dashboard") return;
    pending.current = false;
    startOnborda(WELCOME_TOUR);
  }, [pathname, startOnborda]);

  return React.useCallback(() => {
    if (pathname === "/dashboard") {
      startOnborda(WELCOME_TOUR);
      return;
    }
    pending.current = true;
    router.push("/dashboard");
  }, [pathname, router, startOnborda]);
}

/**
 * Wraps the dashboard in the guided tour.
 *
 * `interact` is ON because the tour is click-driven — without it the overlay
 * swallows the very clicks each step is waiting for.
 *
 * The transition is a short tween, not a spring. Onborda dims the page with
 * one enormous animated `box-shadow`, which the compositor cannot cache and
 * must repaint at full viewport size every frame; a spring keeps that repaint
 * running for its whole settle time and is what makes the tour feel heavy.
 */
export function OnboardingTour({ children }: { children: React.ReactNode }) {
  return (
    <OnbordaProvider>
      <Onborda
        steps={TOURS}
        cardComponent={TourCard}
        interact
        shadowRgb="12,21,44"
        shadowOpacity="0.6"
        cardTransition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
      >
        <TourController />
        {children}
      </Onborda>
    </OnbordaProvider>
  );
}
