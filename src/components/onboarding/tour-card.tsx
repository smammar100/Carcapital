"use client";

import type { CardComponentProps } from "onborda";
import { X, MousePointerClick } from "lucide-react";
import { useOnborda } from "onborda";
import type { GuidedStep } from "@/lib/onboarding/tour-steps";

/**
 * The tour tooltip.
 *
 * Onborda ships its own card, but it is unstyled Tailwind that inherits none
 * of the Genaro tokens. This one is a plain white surface: the overlay behind
 * it is near-black, and a navy card on a navy-dark scrim reads as washed out
 * and low-contrast — white is the only value that stays legible against a
 * dimmed screen whatever is underneath it.
 */
export function TourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda, setCurrentStep } = useOnborda();
  const guided = step as GuidedStep;
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;
  // An action step advances only when the user actually clicks the highlighted
  // nav item, so it deliberately offers no Next button.
  const awaitsAction = Boolean(guided.awaitRoute);

  return (
    <div className="w-[330px] max-w-[calc(100vw-2rem)] rounded-xl bg-white p-4 text-navy-900 shadow-2xl ring-1 ring-black/5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl leading-none">
          {step.icon}
        </span>
        <h2 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug">
          {step.title}
        </h2>
        <button
          type="button"
          onClick={closeOnborda}
          aria-label="Skip the tour"
          className="-m-1 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-black/5 hover:text-navy-900"
        >
          <X className="size-4" />
        </button>
      </div>

      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        {step.content}
      </p>

      {awaitsAction && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-accent-blue/10 px-3 py-2 text-[13px] font-medium text-accent-blue">
          <MousePointerClick className="size-4 shrink-0" />
          <span>
            Click <b>{guided.actionLabel}</b> to carry on
          </span>
        </p>
      )}

      {/* Progress reads as "how much is left", which is the question someone
          decides whether to bail on. Dots rather than a bar: at a dozen steps
          they still resolve, and they show position as well as proportion. */}
      <div className="mt-4 flex items-center gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {Array.from({ length: totalSteps }, (_, i) => (
            <span
              key={i}
              className={
                i === currentStep
                  ? "h-1.5 w-4 rounded-full bg-accent-blue"
                  : i < currentStep
                    ? "h-1.5 w-1.5 rounded-full bg-accent-blue/50"
                    : "h-1.5 w-1.5 rounded-full bg-black/15"
              }
            />
          ))}
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {currentStep + 1} / {totalSteps}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={closeOnborda}
          className="rounded px-1 py-1 text-[12px] text-muted-foreground underline-offset-2 transition-colors hover:text-navy-900 hover:underline"
        >
          Skip tour
        </button>

        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              type="button"
              onClick={prevStep}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-black/5 hover:text-navy-900"
            >
              Back
            </button>
          )}
          {awaitsAction ? (
            // Safety valve: someone who cannot find the highlighted item is
            // otherwise stuck with no way forward but abandoning the tour.
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep + 1)}
              className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-black/5 hover:text-navy-900"
            >
              Skip step
            </button>
          ) : (
            <button
              type="button"
              onClick={isLast ? closeOnborda : nextStep}
              className="rounded-md bg-accent-blue px-3.5 py-1.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              {isLast ? "Finish" : "Next"}
            </button>
          )}
        </div>
      </div>

      {arrow}
    </div>
  );
}
