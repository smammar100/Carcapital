"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

/** The four stages a car passes through, in the order the sidebar lists them. */
const LIFECYCLE = ["Arrives", "Inspected", "Prepped", "Sold"];

/**
 * First-run screen, shown in place of the dashboard while there is not a
 * single vehicle on the system. The nav rail is hidden around it (see the
 * dashboard layout) so the whole window is this one question.
 *
 * WHY THE PLATE IS THE CONTROL, NOT A BUTTON
 * Every other empty state describes the action; this one IS the action. A
 * dealer's instinct with a new car is to reach for the registration, and a UK
 * plate is the one control that already looks like the thing in their hand.
 * Typing it and pressing Enter goes straight to the arrival form with the DVLA
 * and AutoTrader lookup already running — the Add Vehicle dialog, which exists
 * only to collect these same two fields, never has to open.
 *
 * There is deliberately no tour offered here. The tour highlights nav items,
 * and this is the one screen with no nav to highlight.
 */
export function DashboardWelcome() {
  const router = useRouter();
  const { user, company } = useAuth();
  const [reg, setReg] = React.useState("");
  const [mileage, setMileage] = React.useState("");
  const [going, setGoing] = React.useState(false);

  // Same normalisation and bounds the Add Vehicle dialog applies, so the two
  // entry points accept exactly the same registrations.
  const cleanedReg = reg.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const canLookup = cleanedReg.length >= 4 && cleanedReg.length <= 8;

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? null;

  function go(withLookup: boolean): void {
    if (withLookup && !canLookup) return;
    const params = new URLSearchParams();
    if (withLookup) {
      params.set("reg", cleanedReg);
      const m = Number(mileage);
      if (Number.isFinite(m) && m > 0) params.set("mileage", String(Math.round(m)));
    }
    const qs = params.toString();
    setGoing(true);
    router.push(`/inventory/add-vehicle${qs ? `?${qs}` : ""}`);
  }

  return (
    <div className="relative -m-4 flex min-h-[calc(100vh-56px)] flex-col overflow-hidden bg-navy-900 text-white sm:-m-6">
      {/* Brand wash and grid. Pure CSS — no asset to load or go stale. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            // Centred on the plate rather than the top edge. A wash strongest
            // at 0% would meet the flat navy header in a visible line.
            "radial-gradient(95% 75% at 50% 38%, rgba(11,92,255,0.38) 0%, transparent 68%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(70% 60% at 50% 30%, #000 0%, transparent 78%)",
          WebkitMaskImage:
            "radial-gradient(70% 60% at 50% 30%, #000 0%, transparent 78%)",
        }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        {/* Brand lockup */}
        <div className="flex items-center gap-2.5">
          {company?.logoMarkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoMarkUrl}
              alt=""
              className="size-8 rounded-lg object-contain"
            />
          ) : (
            <span className="grid size-8 place-items-center rounded-lg bg-navy-700 text-[12px] font-bold">
              CC
            </span>
          )}
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-200">
            {company?.name ?? "Car Capital UK"}
          </span>
        </div>

        {/* Two sentences, two lines. Left to wrap on its own the greeting and
            the instruction break mid-phrase ("…Abbas. Start / with a
            registration."), which reads as a mistake rather than a rhythm. */}
        <h1 className="mt-8 text-3xl font-semibold leading-[1.1] tracking-tight sm:text-[44px]">
          {firstName ? `Welcome, ${firstName}.` : "Welcome."}
          <span className="mt-1 block text-navy-200">
            Start with a registration.
          </span>
        </h1>

        <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-navy-200">
          Type the plate and we&apos;ll pull the make, model, derivative, tax and
          MOT for you. Everything else in Car Capital hangs off that first car.
        </p>

        {/* The plate. A real UK number plate: reflective yellow with the blue
            GB band, which is why the one bright thing on a navy screen is also
            the thing to type into. */}
        <form
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:items-stretch"
          onSubmit={(e) => {
            e.preventDefault();
            go(true);
          }}
        >
          <div className="flex h-[60px] items-stretch overflow-hidden rounded-xl border-[3px] border-navy-900 bg-[#ffd400] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] focus-within:ring-4 focus-within:ring-accent-blue/50">
            <span
              aria-hidden
              className="flex w-[38px] shrink-0 flex-col items-center justify-center gap-1 bg-[#0b3fbf] text-[9px] font-bold leading-none tracking-wide text-white"
            >
              <span className="text-[7px] leading-[1.1]">★</span>
              <span>GB</span>
            </span>
            <input
              value={reg}
              onChange={(e) => setReg(e.target.value.toUpperCase())}
              placeholder="AK69 HZH"
              aria-label="Registration"
              autoComplete="off"
              spellCheck={false}
              autoFocus
              // The placeholder is deliberately washed out. At full strength
              // an example plate reads as a registration already typed in,
              // which contradicts the disabled Look up button beside it.
              className="w-[240px] bg-transparent text-center font-mono text-[26px] font-semibold uppercase tracking-[0.08em] text-navy-900 outline-none placeholder:font-medium placeholder:text-navy-900/35"
            />
          </div>

          <input
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
            placeholder="Mileage"
            inputMode="numeric"
            aria-label="Mileage"
            className="h-[60px] w-[240px] rounded-xl border border-white/15 bg-white/5 px-4 text-center font-mono text-[16px] text-white outline-none transition-colors placeholder:text-navy-200/70 focus:border-accent-blue focus:bg-white/10 sm:w-[130px]"
          />

          <button
            type="submit"
            disabled={!canLookup || going}
            className="group inline-flex h-[60px] items-center justify-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-navy-900 transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-white/50 disabled:hover:scale-100"
          >
            {going ? "Opening…" : "Look up"}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 group-disabled:translate-x-0" />
          </button>
        </form>

        <button
          type="button"
          onClick={() => go(false)}
          className="mt-5 text-[13.5px] text-navy-200 underline-offset-4 transition-colors hover:text-white hover:underline"
        >
          Don&apos;t have the plate? Enter it by hand
        </button>
      </div>

      {/* The lifecycle as a footer rule — the same order as the nav groups, so
          the sequence is met here before it is met in the rail. */}
      <div className="relative border-t border-white/10">
        <ol className="mx-auto grid max-w-4xl grid-cols-2 sm:grid-cols-4">
          {LIFECYCLE.map((stage, i) => (
            <li
              key={stage}
              className="flex items-center justify-center gap-2 border-b border-white/[0.07] px-4 py-4 text-[13px] sm:border-b-0 sm:border-r sm:last:border-r-0"
            >
              <span className="font-mono text-[11px] text-navy-200/50 tabular-nums">
                0{i + 1}
              </span>
              <span className="font-medium text-navy-200">{stage}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
