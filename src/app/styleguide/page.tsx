"use client";

/*
 * STYLEGUIDE — the living reference for the Genaro design system.
 *
 * Source: the "Genaro branding guidelines" handoff, Direction 05 "Grille"
 * (2026-08-22). Spec data lives in ./genaro.ts; colour is resolved at runtime
 * from the tokens in globals.css so a token edit moves this page with it.
 *
 * TWO THINGS TO KNOW BEFORE READING IT AS TRUTH:
 *
 * 1. This page documents the Genaro system. The PRODUCT does not use it yet —
 *    every screen still resolves colour through @nordhealth/css. Re-pointing
 *    the semantic layer (--primary, --card, --border, …) at these tokens is
 *    the migration, and is deliberately not done here.
 * 2. Genaro defines one light system and no dark variants, so this page does
 *    not flip with the app theme; it renders in brand colour in both. The old
 *    light/dark switch was removed rather than left to imply a dark system
 *    that has not been designed.
 *
 * Sits outside the (dashboard) group so it renders without app chrome. It is
 * still behind auth (middleware protects everything but PUBLIC_PATHS), which
 * is intentional — this is an internal reference, not a public surface.
 */

import * as React from "react";
import {
  BellIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  DownloadIcon,
  PlusIcon,
  SearchIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_TOKENS,
  BADGES,
  type BadgeSpec,
  DEAL_BADGES,
  DOTS,
  NAVY,
  PLATE,
  RADII,
  RULES,
  SPACING_SCALE,
  STAGES,
  STATUS,
  TYPE_SCALE,
  ZINC,
} from "./genaro";
import {
  CopyChip,
  Eyebrow,
  Section,
  SpecRow,
  Specimen,
  TokenSwatch,
  useResolvedTokens,
} from "./parts";

const NAV = [
  { id: "colour", label: "Colour" },
  { id: "typography", label: "Typography" },
  { id: "shape", label: "Spacing & shape" },
  { id: "rules", label: "The six rules" },
  { id: "buttons", label: "Buttons" },
  { id: "badges", label: "Status badges" },
  { id: "cards", label: "Cards" },
  { id: "table", label: "Data table" },
  { id: "chips", label: "Filter chips" },
  { id: "banners", label: "Banners" },
  { id: "chrome", label: "Nav rail & top bar" },
  { id: "voice", label: "Voice" },
] as const;

/* --------------------------------------------------------------- the page */

export default function StyleguidePage(): React.ReactElement {
  const values = useResolvedTokens(ALL_TOKENS);
  const active = useActiveSection(NAV.map((n) => n.id));

  return (
    <div className="min-h-full bg-page text-ink">
      <a
        className="sr-only rounded-[6px] bg-navy-900 px-3 py-2 text-[13px] text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        href="#content"
      >
        Skip to content
      </a>

      <Header active={active} />

      <div className="container flex gap-10 py-10">
        <SideNav active={active} />

        <main
          className="flex min-w-0 flex-1 flex-col gap-12 pb-24"
          id="content"
          tabIndex={-1}
        >
          <Intro />
          <ColourSection values={values} />
          <TypographySection />
          <ShapeSection />
          <RulesSection />
          <ButtonsSection />
          <BadgesSection />
          <CardsSection />
          <TableSection />
          <ChipsSection />
          <BannersSection />
          <ChromeSection />
          <VoiceSection />
        </main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ chrome */

function Header({ active }: { active: string | null }): React.ReactElement {
  return (
    <header className="sticky top-0 z-40 border-line border-b bg-page/88 backdrop-blur-sm">
      <div className="container flex h-14 items-center justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="truncate font-semibold text-[15px] tracking-[-0.01em]">
            Genaro
          </span>
          <span className="truncate text-[12px] text-muted-text max-sm:hidden">
            Design system · Direction 05 “Grille”
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 font-mono text-[10px] text-muted-text uppercase tracking-[0.12em] ring-1 ring-line">
          Light only
        </span>
      </div>

      {/* Below lg the side rail is gone, so the same jump links ride along as a
          scrolling strip — 12 sections with no nav is a lot of thumb. */}
      <div className="container flex gap-1 overflow-x-auto pb-2 lg:hidden">
        {NAV.map((item) => (
          <a
            aria-current={active === item.id ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-[6px] px-2 py-1 text-[12px] text-muted-text outline-none transition-[color,background-color] focus-visible:ring-2 focus-visible:ring-accent-blue",
              active === item.id && "bg-white font-medium text-ink",
            )}
            href={`#${item.id}`}
            key={item.id}
          >
            {item.label}
          </a>
        ))}
      </div>
    </header>
  );
}

function SideNav({ active }: { active: string | null }): React.ReactElement {
  return (
    <nav
      aria-label="Sections"
      className="sticky top-24 hidden h-fit w-44 shrink-0 flex-col gap-0.5 lg:flex"
    >
      {NAV.map((item) => (
        <a
          aria-current={active === item.id ? "true" : undefined}
          className={cn(
            "rounded-[6px] px-2.5 py-1.5 text-[13px] text-muted-text outline-none transition-[color,background-color] hover:bg-white hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-blue",
            active === item.id && "bg-white font-medium text-ink",
          )}
          href={`#${item.id}`}
          key={item.id}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

/** Highlights the section currently nearest the top of the viewport. */
function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = React.useState<string | null>(ids[0] ?? null);
  const key = ids.join(",");

  React.useEffect(() => {
    const sectionIds = key.split(",");
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Top band only: a section counts as "current" once its heading reaches
      // the header, not when any part of it is anywhere on screen.
      { rootMargin: "-72px 0px -70% 0px", threshold: 0 },
    );
    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key]);

  return active;
}

function Intro(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-bold text-[40px] leading-[1.05] tracking-[-0.03em]">
        The Genaro system
      </h1>
      <p className="max-w-[65ch] text-[13px] text-body-text leading-[1.55]">
        Navy carries the brand, zinc carries the interface, three status colours
        carry meaning. Nothing else. Screens are designed at 1442px content
        width with a 260px fixed nav rail and a 52px top bar.
      </p>
      <div className="rounded-[8px] border border-status-warning-edge bg-[#FEFCE8] p-4">
        <p className="max-w-[70ch] text-[13px] text-status-warning leading-[1.5]">
          <strong className="font-semibold">
            The product does not use this yet.
          </strong>{" "}
          Every screen still resolves colour through{" "}
          <span className="font-mono text-[12px]">@nordhealth/css</span>. The
          tokens below are declared in{" "}
          <span className="font-mono text-[12px]">globals.css</span> and are
          real, but nothing consumes them outside this page. Re-pointing the
          semantic layer at them is the migration, and it is a separate change.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- sections */

function ColourSection({
  values,
}: {
  values: Record<string, string>;
}): React.ReactElement {
  return (
    <Section
      id="colour"
      lede="Four families, each with one job. A colour used outside its family is a bug, not a variation."
      title="Colour"
    >
      <Specimen
        note="Brand, nav rail, primary actions, and the one framing figure per screen."
        title="Navy"
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
          {NAVY.map((s) => (
            <TokenSwatch
              key={s.token}
              label={s.label}
              token={s.token}
              use={s.use}
              value={values[s.token]}
            />
          ))}
        </div>
      </Specimen>

      <Specimen
        note="Text, borders and surfaces — the whole interface outside of status."
        title="Zinc"
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {ZINC.map((s) => (
            <TokenSwatch
              key={s.token}
              label={s.label}
              token={s.token}
              use={s.use}
              value={values[s.token]}
            />
          ))}
        </div>
      </Specimen>

      <Specimen
        note="Meaning only, never decoration. Each family is a foreground, a tinted background, and a matched border for that background."
        title="Status"
      >
        <div className="flex flex-col">
          {STATUS.map((s) => (
            <SpecRow key={s.label} label={s.label}>
              <div
                className="flex items-center gap-3 rounded-[8px] border px-3 py-2"
                style={{
                  backgroundColor: `var(--${s.bg})`,
                  borderColor: `var(--${s.edge})`,
                }}
              >
                <span
                  className="font-medium text-[13px]"
                  style={{ color: `var(--${s.fg})` }}
                >
                  {s.label}
                </span>
              </div>
              <CopyChip
                className="text-muted-text"
                label={values[s.fg]?.toUpperCase() || "—"}
                value={values[s.fg] || `var(--${s.fg})`}
              />
              <CopyChip
                className="text-muted-text"
                label={values[s.bg]?.toUpperCase() || "—"}
                value={values[s.bg] || `var(--${s.bg})`}
              />
              <CopyChip
                className="text-muted-text"
                label={values[s.edge]?.toUpperCase() || "—"}
                value={values[s.edge] || `var(--${s.edge})`}
              />
            </SpecRow>
          ))}
        </div>
      </Specimen>

      <Specimen
        note="Registration plates and nowhere else, so a plate is always recognisable at a glance."
        title="Plate"
      >
        <div className="flex flex-wrap items-center gap-8">
          <RegPlate reg="LT19 XKR" />
          <div className="grid grid-cols-2 gap-4">
            {PLATE.map((s) => (
              <TokenSwatch
                key={s.token}
                label={s.label}
                token={s.token}
                value={values[s.token]}
              />
            ))}
          </div>
        </div>
      </Specimen>

      <Specimen
        note="Stock stages. The amber here is the stage amber, not plate yellow — deliberately distinct so plate yellow stays unique to plates."
        title="Chart series"
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {STAGES.map((s) => (
            <TokenSwatch
              key={s.token}
              label={s.label}
              token={s.token}
              value={values[s.token]}
            />
          ))}
        </div>
      </Specimen>

      <Specimen title="Inspection dots">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {DOTS.map((s) => (
            <span className="flex items-center gap-2" key={s.token}>
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: `var(--${s.token})` }}
              />
              <span className="text-[13px] text-body-text">{s.label}</span>
              <span className="font-mono text-[11px] text-faint">
                {values[s.token]?.toUpperCase() || "—"}
              </span>
            </span>
          ))}
        </div>
      </Specimen>
    </Section>
  );
}

function TypographySection(): React.ReactElement {
  return (
    <Section
      id="typography"
      lede="Geist for everything; Geist Mono for registrations, stock IDs, eyebrows and any figure in a fixed column. Every figure that sits in a column or updates in place is tabular."
      title="Typography"
    >
      <Specimen title="Scale">
        <div className="flex flex-col">
          {TYPE_SCALE.map((t) => (
            <div
              className="grid gap-x-6 gap-y-2 border-line-soft border-t py-4 first:border-t-0 first:pt-0 last:pb-0 sm:grid-cols-[8rem_1fr_13rem] sm:items-baseline"
              key={t.role}
            >
              <span className="font-medium text-[12px] text-muted-text">
                {t.role}
              </span>
              <span
                className={cn(
                  "min-w-0 truncate",
                  t.mono ? "font-mono" : "font-sans",
                )}
                style={{
                  fontSize: t.size,
                  fontWeight: t.weight,
                  letterSpacing: t.tracking,
                  lineHeight: t.leading,
                  textTransform: t.upper ? "uppercase" : undefined,
                  fontVariantNumeric: t.tabular ? "tabular-nums" : undefined,
                  color: t.role === "Meta" ? "var(--color-muted-text)" : undefined,
                }}
              >
                {t.tabular ? "£512,400" : "63 cars on the forecourt"}
              </span>
              <span className="font-mono text-[11px] text-faint tabular-nums">
                {t.spec}
              </span>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen
        note="Tabular figures keep columns from shuffling as values change. The top row is tabular, the bottom is not — watch the decimal points."
        title="Tabular numerals"
      >
        <div className="flex flex-col gap-2">
          {[true, false].map((tabular) => (
            <div
              className="flex gap-6 text-[15px]"
              key={String(tabular)}
              style={{
                fontVariantNumeric: tabular ? "tabular-nums" : "normal",
              }}
            >
              <span className="w-24 shrink-0 font-mono text-[11px] text-faint">
                {tabular ? "tabular" : "proportional"}
              </span>
              <span>11,118</span>
              <span>47,900</span>
              <span>163</span>
            </div>
          ))}
        </div>
      </Specimen>
    </Section>
  );
}

function ShapeSection(): React.ReactElement {
  return (
    <Section
      id="shape"
      lede="Page padding 24px, card padding 16–20px, dense table cells 8–10px vertical and 12–16px horizontal."
      title="Spacing & shape"
    >
      <Specimen title="Spacing scale">
        <div className="flex flex-wrap items-end gap-4">
          {SPACING_SCALE.map((n) => (
            <div className="flex flex-col items-center gap-1.5" key={n}>
              <div
                className="rounded-[2px] bg-navy-500"
                style={{ height: n, width: n }}
              />
              <span className="font-mono text-[11px] text-faint tabular-nums">
                {n}
              </span>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen title="Radius">
        <div className="flex flex-wrap gap-6">
          {RADII.map((r) => (
            <div className="flex flex-col gap-1.5" key={r.px}>
              <div
                className="size-16 border border-line bg-surface"
                style={{ borderRadius: r.px }}
              />
              <span className="font-mono text-[11px] text-ink tabular-nums">
                {r.label}
              </span>
              <span className="text-[11px] text-muted-text">{r.use}</span>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen
        note="Almost none. Cards are 1px of border on white. The single shadow in the system is on the calendar date chip — if a new surface seems to need one, it needs a border instead."
        title="Elevation"
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col gap-1.5">
            <div className="h-16 w-32 rounded-[10px] border border-line bg-white" />
            <span className="text-[11px] text-muted-text">
              Card — 1px border, no shadow
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="h-16 w-32 rounded-[5px] border border-line bg-white shadow-chip" />
            <span className="text-[11px] text-muted-text">
              Date chip — the one shadow
            </span>
          </div>
        </div>
      </Specimen>
    </Section>
  );
}

function RulesSection(): React.ReactElement {
  return (
    <Section
      id="rules"
      lede="The part most likely to be lost in implementation. These are not stylistic preferences — every screen depends on them."
      title="The six rules"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {RULES.map((rule, i) => (
          <div
            className="flex flex-col gap-2 rounded-[10px] border border-line bg-white p-5"
            key={rule.title}
          >
            <span className="font-mono font-semibold text-[11px] text-navy-500 tracking-[0.12em]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="font-semibold text-[15px] tracking-[-0.01em]">
              {rule.title}
            </h3>
            <p className="text-[13px] text-body-text leading-[1.55]">
              {rule.body}
            </p>
          </div>
        ))}
      </div>

      <Specimen
        note="Rule 1 in practice. Left: a border under every row. Right: the same rows separated by a faint alternating background. Same information, half the noise."
        title="Hairlines — wrong and right"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <DontLabel>Border on every row</DontLabel>
            <div className="mt-2 overflow-hidden rounded-[8px] border border-line">
              {["LT19 XKR", "BD68 ZPL", "MK21 HRV"].map((reg) => (
                <div
                  className="flex items-center justify-between border-line border-b px-3 py-2 text-[13px] last:border-b-0"
                  key={reg}
                >
                  <span className="font-mono text-[12px] font-semibold">
                    {reg}
                  </span>
                  <span className="text-muted-text">In prep</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <DoLabel>Zebra, no row borders</DoLabel>
            <div className="mt-2 overflow-hidden rounded-[8px] border border-line">
              {["LT19 XKR", "BD68 ZPL", "MK21 HRV"].map((reg, i) => (
                <div
                  className={cn(
                    "flex items-center justify-between px-3 py-2 text-[13px]",
                    i % 2 === 1 && "bg-surface",
                  )}
                  key={reg}
                >
                  <span className="font-mono text-[12px] font-semibold">
                    {reg}
                  </span>
                  <span className="text-muted-text">In prep</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Specimen>

      <Specimen
        note="Rule 3 in practice. A figure with nothing to measure it against cannot be acted on."
        title="Figures — wrong and right"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <DontLabel>No comparison</DontLabel>
            <div className="mt-2 rounded-[8px] border border-line p-4">
              <Eyebrow>Avg days in stock</Eyebrow>
              <div className="mt-1 font-semibold text-[27px] tracking-[-0.028em] tabular-nums">
                47
              </div>
            </div>
          </div>
          <div>
            <DoLabel>Paired with a target</DoLabel>
            <div className="mt-2 rounded-[8px] border border-line p-4">
              <Eyebrow>Avg days in stock</Eyebrow>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-semibold text-[27px] tracking-[-0.028em] tabular-nums">
                  47
                </span>
                <span className="font-medium text-[12px] text-status-clear tabular-nums">
                  13 under the 60-day target
                </span>
              </div>
            </div>
          </div>
        </div>
      </Specimen>
    </Section>
  );
}

function ButtonsSection(): React.ReactElement {
  return (
    <Section
      id="buttons"
      lede="34px tall, 6px radius, 14px horizontal padding, 8px gap to a leading 14px icon. One navy fill per screen."
      title="Buttons"
    >
      <Specimen title="Variants">
        <div className="flex flex-col">
          <SpecRow label="Primary">
            <GButton variant="primary">
              <PlusIcon aria-hidden="true" size={14} strokeWidth={1.7} />
              Add vehicle
            </GButton>
            <span className="text-[11px] text-muted-text">
              Navy fill, white 13/600 — the one thing the user came to do
            </span>
          </SpecRow>
          <SpecRow label="Secondary">
            <GButton variant="secondary">
              <DownloadIcon aria-hidden="true" size={14} strokeWidth={1.7} />
              Export
            </GButton>
            <span className="text-[11px] text-muted-text">
              White, 1px border, 13/500
            </span>
          </SpecRow>
          <SpecRow label="Link">
            <button
              className="cursor-pointer font-medium text-[13px] text-accent-blue outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-blue"
              type="button"
            >
              View all deals
            </button>
            <span className="text-[11px] text-muted-text">
              No fill, no border, 13/500
            </span>
          </SpecRow>
        </div>
      </Specimen>

      <Specimen
        note="Rule 2. Two navy fills in one view make the user choose between them, which is the opposite of what the fill is for."
        title="One primary per screen"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <DontLabel>Two primaries</DontLabel>
            <div className="mt-2 flex gap-2 rounded-[8px] border border-line p-4">
              <GButton variant="primary">Export</GButton>
              <GButton variant="primary">Add vehicle</GButton>
            </div>
          </div>
          <div>
            <DoLabel>One primary, one secondary</DoLabel>
            <div className="mt-2 flex gap-2 rounded-[8px] border border-line p-4">
              <GButton variant="secondary">Export</GButton>
              <GButton variant="primary">Add vehicle</GButton>
            </div>
          </div>
        </div>
      </Specimen>
    </Section>
  );
}

function BadgesSection(): React.ReactElement {
  return (
    <Section
      id="badges"
      lede="Pills at 999px radius, 8px horizontal padding, weight 500. Colour states the condition — it is never chosen for contrast or variety."
      title="Status badges"
    >
      <Specimen title="Vehicle states">
        <div className="flex flex-wrap items-center gap-3">
          {BADGES.map((b) => (
            <GBadge key={b.label} spec={b} />
          ))}
        </div>
      </Specimen>

      <Specimen
        note="A wider set, because a deal stage is a position in a sequence rather than a pass/fail."
        title="Deal stages"
      >
        <div className="flex flex-wrap items-center gap-3">
          {DEAL_BADGES.map((b) => (
            <GBadge key={b.label} spec={b} />
          ))}
        </div>
      </Specimen>
    </Section>
  );
}

function CardsSection(): React.ReactElement {
  return (
    <Section
      id="cards"
      lede="White, 1px border, 10–12px radius. The header keeps its single bottom border; the content below it does not repeat that line."
      title="Cards"
    >
      <Specimen title="Anatomy">
        <div className="max-w-[420px] overflow-hidden rounded-[12px] border border-line bg-white">
          <div className="flex items-center justify-between border-line border-b px-5 py-3.5">
            <div className="flex items-baseline gap-2">
              <h3 className="font-semibold text-[15px] tracking-[-0.01em]">
                Appointments
              </h3>
              <span className="text-[12px] text-muted-text">4 today</span>
            </div>
            <a
              className="font-medium text-[12px] text-accent-blue outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-blue"
              href="#cards"
            >
              View all
            </a>
          </div>
          <div className="flex flex-col gap-3 p-5">
            {[
              { day: "TUE", date: "12", name: "R. Whitfield", time: "09:30" },
              { day: "TUE", date: "12", name: "A. Kaur", time: "11:15" },
              { day: "WED", date: "13", name: "M. Osei", time: "14:00" },
            ].map((a) => (
              <div className="flex items-center gap-3" key={a.name + a.time}>
                <DateChip date={a.date} day={a.day} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{a.name}</div>
                  <div className="truncate text-[12px] text-muted-text">
                    Volvo XC40 · LT19 XKR
                  </div>
                </div>
                <span className="text-[13px] tabular-nums">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </Specimen>

      <Specimen
        note="Rule 6. Name the thing that is absent and the condition that would put it there."
        title="Empty state"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <DontLabel>Says nothing</DontLabel>
            <div className="mt-2 rounded-[8px] border border-line p-6 text-center text-[13px] text-muted-text">
              No data
            </div>
          </div>
          <div>
            <DoLabel>Names the absence and its condition</DoLabel>
            <div className="mt-2 rounded-[8px] border border-line p-6 text-center">
              <p className="text-[13px] text-body-text leading-[1.55]">
                No appointments booked for today. Bookings made from a lead or a
                vehicle page appear here from the moment they are confirmed.
              </p>
            </div>
          </div>
        </div>
      </Specimen>
    </Section>
  );
}

function TableSection(): React.ReactElement {
  const rows = [
    { reg: "LT19 XKR", model: "Volvo XC40 D3 Momentum", days: 163, price: 18995 },
    { reg: "BD68 ZPL", model: "Ford Kuga 1.5T Titanium", days: 47, price: 12450 },
    { reg: "MK21 HRV", model: "Honda HR-V 1.5 SE", days: 12, price: 16750 },
    { reg: "SA20 NWD", model: "Škoda Octavia 2.0 TDI SE", days: 88, price: 14200 },
  ];

  return (
    <Section
      id="table"
      lede="Mono uppercase header on the surface tone, zebra body, no row borders. Numeric columns are right-aligned and tabular."
      title="Data table"
    >
      <Specimen title="Dense rows">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="border-line border-b bg-surface">
                {["Vehicle", "Status", "Days", "Retail"].map((h, i) => (
                  <th
                    className={cn(
                      "px-4 py-2.5 font-mono font-medium text-[11px] text-muted-text uppercase tracking-[0.06em]",
                      i > 1 && "text-right",
                    )}
                    key={h}
                    scope="col"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr className={cn(i % 2 === 1 && "bg-surface")} key={r.reg}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div
                        aria-hidden="true"
                        className="h-[33px] w-[44px] shrink-0 rounded-[4px] bg-line"
                      />
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-[12px]">
                          {r.reg}
                        </div>
                        <div className="truncate text-[12px] text-muted-text">
                          {r.model}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <GBadge
                      spec={
                        i === 0
                          ? BADGES[1]
                          : i === 1
                            ? BADGES[2]
                            : BADGES[3]
                      }
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right text-[13px] tabular-nums">
                    {r.days}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[13px] tabular-nums">
                    £{r.price.toLocaleString("en-GB")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Specimen>
    </Section>
  );
}

function ChipsSection(): React.ReactElement {
  const [active, setActive] = React.useState("All");
  const chips = [
    { label: "All", count: 63 },
    { label: "Ready", count: 28 },
    { label: "In prep", count: 21 },
    { label: "Blocked", count: 9 },
    { label: "Sold", count: 5 },
  ];

  return (
    <Section
      id="chips"
      lede="30px tall, 6px radius, 12px horizontal padding, 13px text. Counts follow the label in a lighter tone."
      title="Filter chips"
    >
      <Specimen title="Group">
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => {
            const on = active === c.label;
            return (
              <button
                aria-pressed={on}
                className={cn(
                  "inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[6px] px-3 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue",
                  on
                    ? "bg-navy-900 font-semibold text-white"
                    : "border border-line bg-white text-[#3F3F46]",
                )}
                key={c.label}
                onClick={() => setActive(c.label)}
                type="button"
              >
                {c.label}
                <span
                  className={cn(
                    "tabular-nums",
                    on ? "text-navy-200" : "text-faint",
                  )}
                >
                  {c.count}
                </span>
              </button>
            );
          })}
          <button
            className="inline-flex h-[30px] cursor-pointer items-center rounded-[6px] px-3 text-[13px] text-muted-text outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent-blue"
            type="button"
          >
            + Add filter
          </button>
        </div>
      </Specimen>
    </Section>
  );
}

function BannersSection(): React.ReactElement {
  const banners = [
    {
      family: STATUS[0],
      tint: "#FEF9F8",
      Icon: CircleAlertIcon,
      text: "Two required photographs were never taken, so the advert has sat unpublished.",
      action: "Open photo list",
    },
    {
      family: STATUS[1],
      tint: "#FEFCE8",
      Icon: TriangleAlertIcon,
      text: "The MOT expires in 11 days. A vehicle cannot be handed over inside that window.",
      action: "Book test",
    },
    {
      family: STATUS[2],
      tint: "#F6FDF8",
      Icon: CircleCheckIcon,
      text: "All 14 preparation checks passed. The car is ready to advertise.",
      action: undefined,
    },
  ];

  return (
    <Section
      id="banners"
      lede="Tinted background with a matched border, 12–16px padding, 8px radius. The text states the condition and its consequence, not a category."
      title="Banners"
    >
      <Specimen title="Variants">
        <div className="flex flex-col gap-3">
          {banners.map(({ family, tint, Icon, text, action }) => (
            <div
              className="flex items-start gap-3 rounded-[8px] border p-4"
              key={family.label}
              style={{
                backgroundColor: tint,
                borderColor: `var(--${family.edge})`,
              }}
            >
              <span
                className="flex size-[18px] shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `var(--${family.fg})` }}
              >
                <Icon
                  aria-hidden="true"
                  className="text-white"
                  size={12}
                  strokeWidth={1.7}
                />
              </span>
              <p
                className="flex-1 text-[13px] leading-[1.5]"
                style={{ color: `var(--${family.fg})` }}
              >
                {text}
              </p>
              {action ? (
                <button
                  className="shrink-0 cursor-pointer font-medium text-[13px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent-blue"
                  style={{ color: `var(--${family.fg})` }}
                  type="button"
                >
                  {action}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </Specimen>
    </Section>
  );
}

function ChromeSection(): React.ReactElement {
  return (
    <Section
      id="chrome"
      lede="A 260px fixed navy rail and a 52px top bar frame every screen."
      title="Nav rail & top bar"
    >
      <Specimen
        note="Active item is a lighter navy fill with a 3px blue left marker. Group labels are Mono 10/600/0.14em uppercase."
        title="Nav rail — 260px"
      >
        <div className="w-[260px] overflow-hidden rounded-[8px] bg-navy-900 py-2">
          <div className="flex items-center gap-2.5 px-3 pt-1 pb-3">
            <div className="flex size-[34px] items-center justify-center rounded-[6px] bg-navy-500 font-semibold text-[13px] text-white">
              G
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-[13px] text-white">
                Riverside Motors
              </div>
              <div className="truncate text-[11px] text-[#8B9AB8]">
                sam@riversidemotors.co.uk
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <span className="font-mono font-semibold text-[10px] text-[#6B7A99] uppercase tracking-[0.14em]">
              Inventory
            </span>
            <ChevronDownIcon
              aria-hidden="true"
              className="text-[#6B7A99]"
              size={14}
              strokeWidth={1.7}
            />
          </div>

          {[
            { label: "Vehicles", active: true },
            { label: "Add vehicle", active: false },
            { label: "Master sheet", active: false },
          ].map((item) => (
            <div
              className={cn(
                "relative flex h-[34px] items-center px-2 text-[13px]",
                item.active
                  ? "bg-navy-700 font-medium text-white"
                  : "text-navy-200",
              )}
              key={item.label}
            >
              {item.active ? (
                <span className="absolute top-0 bottom-0 left-0 w-[3px] bg-accent-blue" />
              ) : null}
              <span className="pl-2">{item.label}</span>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen
        note="Three-zone grid (1fr auto 1fr) so the search sits optically centred on the content area regardless of what flanks it. The count badge sits OUTSIDE the bell's box — overlapping it makes the bell unreadable."
        title="Top bar — 52px"
      >
        <div className="grid h-[52px] grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-[8px] border border-line bg-white px-4">
          <span className="truncate font-semibold text-[18px] tracking-[-0.012em]">
            Vehicles
          </span>

          <div className="flex h-[30px] w-[320px] max-w-full items-center gap-2 rounded-[6px] border border-line px-2.5">
            <SearchIcon
              aria-hidden="true"
              className="shrink-0 text-muted-text"
              size={13}
              strokeWidth={1.7}
            />
            <span className="truncate text-[13px] text-muted-text">
              Search registration, stock ID or model
            </span>
          </div>

          <div className="flex items-center justify-end gap-3">
            <span className="relative flex size-[30px] items-center justify-center">
              <BellIcon
                aria-hidden="true"
                className="text-body-text"
                size={18}
                strokeWidth={1.7}
              />
              <span className="-top-[2px] -right-[3px] absolute flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-status-blocked px-1 font-semibold text-[9px] text-white ring-2 ring-white tabular-nums">
                3
              </span>
            </span>
            <span className="flex size-[26px] items-center justify-center rounded-full bg-line-soft font-semibold text-[11px] text-body-text">
              SW
            </span>
          </div>
        </div>
      </Specimen>

      <Specimen
        note="34px wide, used in appointment rows. Carries the only shadow in the system."
        title="Calendar date chip"
      >
        <div className="flex gap-3">
          <DateChip date="12" day="TUE" />
          <DateChip date="13" day="WED" />
          <DateChip date="14" day="THU" />
        </div>
      </Specimen>
    </Section>
  );
}

function VoiceSection(): React.ReactElement {
  return (
    <Section
      id="voice"
      lede="Plain, factual, specific. Name the thing and the condition. No exclamation marks, no encouragement, no abstraction — and every figure carries its unit and its comparison."
      title="Voice"
    >
      <Specimen title="Say / do not say">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <DontLabel>Abstract</DontLabel>
            <p className="mt-2 rounded-[8px] border border-line p-4 text-[13px] text-body-text leading-[1.55]">
              Action required — incomplete listing.
            </p>
          </div>
          <div>
            <DoLabel>Names the thing and the condition</DoLabel>
            <p className="mt-2 rounded-[8px] border border-line p-4 text-[13px] text-body-text leading-[1.55]">
              Two required photographs were never taken, so the advert has sat
              unpublished.
            </p>
          </div>
        </div>
      </Specimen>
    </Section>
  );
}

/* ----------------------------------------------------------------- pieces */

function GButton({
  variant,
  children,
}: {
  variant: "primary" | "secondary";
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <button
      className={cn(
        "inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-[6px] px-3.5 text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2",
        variant === "primary"
          ? "bg-navy-900 font-semibold text-white hover:bg-navy-700"
          : "border border-line bg-white font-medium text-[#3F3F46] hover:bg-surface",
      )}
      type="button"
    >
      {children}
    </button>
  );
}

function GBadge({ spec }: { spec: BadgeSpec }): React.ReactElement {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 font-medium whitespace-nowrap"
      style={{
        backgroundColor: spec.bg,
        color: spec.fg,
        height: spec.height,
        fontSize: spec.size,
        letterSpacing: spec.tracking,
        textTransform: spec.upper ? "uppercase" : undefined,
      }}
    >
      {spec.label}
    </span>
  );
}

/** UK front plate: yellow is reserved for this and nothing else (rule 5). */
function RegPlate({ reg }: { reg: string }): React.ReactElement {
  return (
    <span
      className="inline-flex h-[34px] items-center rounded-[4px] border px-3 font-mono font-semibold text-[15px] text-ink tabular-nums"
      style={{
        backgroundColor: "var(--color-plate)",
        borderColor: "var(--color-plate-edge)",
      }}
    >
      {reg}
    </span>
  );
}

function DateChip({
  day,
  date,
}: {
  day: string;
  date: string;
}): React.ReactElement {
  return (
    <span className="flex w-[34px] shrink-0 flex-col overflow-hidden rounded-[5px] border border-line bg-white shadow-chip">
      <span className="flex h-[13px] items-center justify-center bg-[#3B5BA9] font-semibold text-[8px] text-white uppercase tracking-[0.07em]">
        {day}
      </span>
      <span className="flex h-[25px] items-center justify-center font-semibold text-[15px] text-ink tracking-[-0.02em] tabular-nums">
        {date}
      </span>
    </span>
  );
}

function DoLabel({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <span className="font-mono font-semibold text-[11px] text-status-clear uppercase tracking-[0.12em]">
      {children}
    </span>
  );
}

function DontLabel({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <span className="font-mono font-semibold text-[11px] text-status-blocked uppercase tracking-[0.12em]">
      {children}
    </span>
  );
}
