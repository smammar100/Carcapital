import type { Step, Tour } from "onborda/dist/types";
import { navTourId, requiredCapsForPath } from "@/components/layout/sidebar-config";
import type { Capability } from "@/lib/capabilities";

/**
 * Onborda matches steps with `querySelector`, so the anchor needs its `#`.
 * Wrapping `navTourId` keeps the id itself defined in one place -- the sidebar,
 * which is what renders it.
 */
const navSelector = (href: string) => `#${navTourId(href)}`;

/** The single tour every new user is walked through on first sign-in. */
export const WELCOME_TOUR = "welcome";

/**
 * A step the user has to *do*, not just read.
 *
 * `awaitRoute` is the route they must reach by clicking the highlighted nav
 * item themselves. While it is set the card shows no Next button, so the only
 * way forward is the real click — which is the entire point. Reading "Leads
 * lives under Sales" teaches nothing; moving your hand there eleven times is
 * what survives to Monday morning.
 */
export interface GuidedStep extends Step {
  awaitRoute?: string;
  /** What to click, named in the card so the instruction is unambiguous. */
  actionLabel?: string;
}

/**
 * The guided tour of Car Capital.
 *
 * WHY IT FOLLOWS A CAR, NOT THE FEATURE LIST
 * The nav is ordered by a vehicle's life through the business (see
 * SIDEBAR_GROUPS), and the tour walks that same path in the same order:
 * arrive, inspect, prep, sell, aftercare, review. Teaching the order someone
 * actually works in is what turns into muscle memory — a tour of every screen
 * in menu order teaches a menu, which nobody remembers.
 *
 * WHY THE USER CLICKS INSTEAD OF PRESSING NEXT
 * Every middle step highlights a nav item and waits for the user to click it.
 * They arrive at each page by the route they will use every day afterwards,
 * with their own hand, rather than watching the app navigate itself.
 *
 * Steps deliberately do NOT depend on any record existing. The database ships
 * empty, and a tour that says "open your first vehicle" breaks on day one.
 */
export const GUIDED_STEPS: GuidedStep[] = [
  {
    icon: "👋",
    title: "Welcome to Car Capital",
    content: (
      <>
        This is your whole business in one place — every car from the day it
        arrives to the day it drives away. The next two minutes walk you through
        it, and you will be doing the clicking.
      </>
    ),
    selector: "#tour-brand",
    // Onborda does not clamp the card to the viewport, and the brand sits in
    // the top-left corner: "right" centres it and loses the top, "bottom"
    // centres it and loses the left, "right-bottom" anchors its base to the
    // brand and loses the top again. "right-top" hangs it downward into the
    // open page, which is the only direction with room.
    side: "right-top",
    pointerPadding: 8,
    pointerRadius: 8,
  },
  {
    icon: "🧭",
    title: "The rail follows the car",
    content: (
      <>
        Read it top to bottom and you are reading a car&apos;s life:{" "}
        <b>Inventory</b> as it arrives, <b>Maintenance</b> while it is inspected
        and prepped, <b>Sales</b> when it goes out, then <b>Warranties</b>. A
        normal day moves down this list, not around it.
      </>
    ),
    selector: "#tour-nav",
    side: "right-top",
    pointerPadding: 6,
    pointerRadius: 10,
  },
  {
    icon: "➕",
    title: "Every car starts here",
    content: (
      <>
        <b>Add Vehicle</b> is the front door. Type a registration and the details
        are pulled in for you — you are only confirming what arrived and what you
        paid.
      </>
    ),
    selector: "#tour-add-vehicle",
    // Add Vehicle sits hard against the right edge of the header, and "bottom"
    // centres the card on its anchor, so the right half hung off the viewport
    // and the copy was cut in half (B-1). "bottom-right" pins the card's right
    // edge to the button's and lets it grow leftwards into the page instead.
    side: "bottom-right",
    pointerPadding: 6,
    pointerRadius: 8,
  },
  {
    icon: "🚗",
    title: "Everything you have taken in",
    content: (
      <>
        Every car, sold or unsold, in one grid — edit a cell in place, sort by a
        heading, pick your columns.
      </>
    ),
    selector: navSelector("/vehicles"),
    // Every nav step hangs its card downward from the item. Nav rows sit high
    // in a tall rail, so a vertically-centred card loses its top edge off the
    // screen — the same clipping the welcome step hits.
    side: "right-top",
    pointerPadding: 6,
    pointerRadius: 8,
    awaitRoute: "/vehicles",
    actionLabel: "All Vehicles",
  },
  {
    icon: "🔍",
    title: "First stop: inspection",
    content: (
      <>
        A car that has arrived is not stock yet. It queues here until someone
        walks it with the checklist — what they log decides the prep work and the
        true cost.
      </>
    ),
    selector: navSelector("/maintenance/inspection"),
    side: "right-top",
    pointerPadding: 6,
    pointerRadius: 8,
    awaitRoute: "/maintenance/inspection",
    actionLabel: "Inspection Queue",
  },
  {
    icon: "🔧",
    title: "Then prep and repair",
    content: (
      <>
        Everything the inspection raised becomes a job here. Each cost you record
        lands on that car&apos;s financials, so the profit figure you see later is
        the real one.
      </>
    ),
    selector: navSelector("/maintenance/prep"),
    side: "right-top",
    pointerPadding: 6,
    pointerRadius: 8,
    awaitRoute: "/maintenance/prep",
    actionLabel: "Prep & Repair",
  },
  {
    icon: "📣",
    title: "Now it can sell",
    content: (
      <>
        Every buyer starts as a lead — log them even when the call goes nowhere,
        because this is what tells you which cars people actually ring about.
      </>
    ),
    selector: navSelector("/sales/leads"),
    side: "right-top",
    pointerPadding: 6,
    pointerRadius: 8,
    awaitRoute: "/sales/leads",
    actionLabel: "Leads",
  },
  {
    icon: "📅",
    title: "Viewings and test drives",
    content: (
      <>
        A lead worth having becomes a booking. Appointments are checked against
        your opening hours, so you cannot promise a Sunday morning you do not
        open for.
      </>
    ),
    selector: navSelector("/sales/appointments"),
    side: "right-top",
    pointerPadding: 6,
    pointerRadius: 8,
    awaitRoute: "/sales/appointments",
    actionLabel: "Appointments",
  },
  {
    icon: "🤝",
    title: "Closing the deal",
    content: (
      <>
        The pipeline shows every live deal by stage, so you can see what is close
        and what has gone quiet. Move a deal to sold and the car leaves your
        forecourt figures.
      </>
    ),
    selector: navSelector("/sales/pipeline"),
    side: "right-top",
    pointerPadding: 6,
    pointerRadius: 8,
    awaitRoute: "/sales/pipeline",
    actionLabel: "Pipeline",
  },
  {
    icon: "🛡️",
    title: "After it drives away",
    content: (
      <>
        The car is sold but not finished. Warranties and claims live here — this
        is the group you will open when a customer rings three months later.
      </>
    ),
    selector: navSelector("/warranties/in-house"),
    side: "right-top",
    pointerPadding: 6,
    pointerRadius: 8,
    awaitRoute: "/warranties/in-house",
    actionLabel: "In-House",
  },
  {
    icon: "📊",
    title: "The whole picture",
    content: (
      <>
        The <b>Master Sheet</b> is every field on every car in one wide grid — the
        view for a stock take or a spreadsheet export, rather than day-to-day
        work.
      </>
    ),
    selector: navSelector("/admin/master-sheet"),
    side: "right-top",
    pointerPadding: 6,
    pointerRadius: 8,
    awaitRoute: "/admin/master-sheet",
    actionLabel: "Master Sheet",
  },
  {
    icon: "🔎",
    title: "One shortcut worth keeping",
    content: (
      <>
        When you already know the car, skip the rail entirely — type a
        registration here to jump straight to it. That is the whole tour. You can
        replay it any time from the menu under your name.
      </>
    ),
    selector: "#tour-search",
    // Same reasoning as the Add Vehicle step: the search box lives in the
    // right-hand side of the header, so the card has to open leftwards.
    side: "bottom-right",
    pointerPadding: 6,
    pointerRadius: 8,
  },
];

export const TOURS: Tour[] = [{ tour: WELCOME_TOUR, steps: GUIDED_STEPS }];

/**
 * The steps this particular user can actually complete.
 *
 * The tour is one fixed script, but the nav is not: a member only sees the
 * items their capabilities allow. A step whose target is hidden is not a
 * cosmetic problem — every middle step sets `awaitRoute`, which removes the
 * Next button so the only way onward is clicking the highlighted item. Point
 * that at something the user cannot see and the tour is a dead end they have
 * to skip out of. A sales member was being told "Click All Vehicles to carry
 * on" with no All Vehicles in their rail (GEN-127).
 *
 * So: drop the steps whose destination this user has no route to, and keep the
 * order. Everyone still gets the arrive → inspect → prep → sell → aftercare
 * spine, just the part of it that is theirs.
 */
export function guidedStepsFor(
  capabilities: ReadonlySet<Capability>,
  isSuperUser: boolean,
): GuidedStep[] {
  if (isSuperUser) return GUIDED_STEPS;

  const canReach = (href: string): boolean => {
    const required = requiredCapsForPath(href);
    // null = no gate on that route (e.g. the dashboard).
    return required === null || required.some((c) => capabilities.has(c));
  };

  return GUIDED_STEPS.filter((step) => {
    // Add Vehicle is a button, not a nav row, so it has no route to check.
    if (step.selector === "#tour-add-vehicle") {
      return capabilities.has("inventory:add");
    }
    return step.awaitRoute ? canReach(step.awaitRoute) : true;
  });
}
