/*
 * Genaro design system — the spec data behind /styleguide.
 *
 * Values mirror the "Genaro branding guidelines" handoff (Direction 05
 * "Grille", 2026-08-22). Colour is deliberately NOT duplicated as hex here:
 * each entry names the CSS custom property declared in globals.css and the
 * page resolves it at runtime, so a token edit moves the guide with it. Sizes
 * and dimensions are literals because that is what the spec fixes.
 */

export type Swatch = {
  /** CSS custom property name, without the leading `--`. */
  token: string;
  label: string;
  use?: string;
};

export const NAVY: readonly Swatch[] = [
  { token: "color-navy-900", label: "Navy 900", use: "Nav rail, primary fill" },
  { token: "color-navy-700", label: "Navy 700", use: "Active nav item" },
  { token: "color-navy-500", label: "Navy 500", use: "In-prep series" },
  { token: "color-navy-200", label: "Navy 200", use: "On-navy de-emphasis" },
  { token: "color-accent-blue", label: "Blue accent", use: "Links, markers" },
];

export const ZINC: readonly Swatch[] = [
  { token: "color-ink", label: "Ink", use: "Primary text" },
  { token: "color-body-text", label: "Body", use: "Secondary text" },
  { token: "color-muted-text", label: "Muted", use: "Meta, labels" },
  { token: "color-faint", label: "Faint", use: "Disabled, de-emphasised" },
  { token: "color-line", label: "Border", use: "All borders" },
  { token: "color-line-soft", label: "Border soft", use: "Internal dividers" },
  { token: "color-surface", label: "Surface", use: "Inset panels, zebra rows" },
  { token: "color-page", label: "Page", use: "Page background" },
];

export type StatusFamily = {
  label: string;
  fg: string;
  bg: string;
  edge: string;
};

export const STATUS: readonly StatusFamily[] = [
  {
    label: "Blocked",
    fg: "color-status-blocked",
    bg: "color-status-blocked-bg",
    edge: "color-status-blocked-edge",
  },
  {
    label: "Warning",
    fg: "color-status-warning",
    bg: "color-status-warning-bg",
    edge: "color-status-warning-edge",
  },
  {
    label: "Clear",
    fg: "color-status-clear",
    bg: "color-status-clear-bg",
    edge: "color-status-clear-edge",
  },
];

export const PLATE: readonly Swatch[] = [
  { token: "color-plate", label: "Plate yellow" },
  { token: "color-plate-edge", label: "Plate edge" },
];

export const STAGES: readonly Swatch[] = [
  { token: "color-stage-ready", label: "Ready" },
  { token: "color-stage-prep", label: "In prep" },
  { token: "color-stage-parts", label: "Awaiting parts" },
  { token: "color-stage-blocked", label: "Blocked" },
];

export const DOTS: readonly Swatch[] = [
  { token: "color-check-passed", label: "Passed" },
  { token: "color-check-partial", label: "Partial" },
  { token: "color-check-failed", label: "Failed" },
  { token: "color-check-none", label: "Not started" },
  { token: "color-check-progress", label: "In progress" },
];

export const ALL_TOKENS: readonly string[] = [
  ...NAVY.map((s) => s.token),
  ...ZINC.map((s) => s.token),
  ...STATUS.flatMap((s) => [s.fg, s.bg, s.edge]),
  ...PLATE.map((s) => s.token),
  ...STAGES.map((s) => s.token),
  ...DOTS.map((s) => s.token),
];

/* ------------------------------------------------------------------- type */

export type TypeRole = {
  role: string;
  /** Applied to the live specimen, in px. */
  size: number;
  weight: number;
  tracking?: string;
  leading?: number;
  mono?: boolean;
  tabular?: boolean;
  upper?: boolean;
  spec: string;
  note?: string;
};

export const TYPE_SCALE: readonly TypeRole[] = [
  {
    role: "Page title",
    size: 40,
    weight: 700,
    tracking: "-0.03em",
    leading: 1.05,
    spec: "40 / 700 / −0.03em · 1.05",
  },
  {
    role: "Section",
    size: 22,
    weight: 600,
    tracking: "-0.022em",
    spec: "22 / 600 / −0.022em",
  },
  {
    role: "Card title",
    size: 15,
    weight: 600,
    tracking: "-0.01em",
    spec: "15 / 600 / −0.01em",
  },
  {
    role: "Hero figure",
    size: 34,
    weight: 600,
    tracking: "-0.032em",
    tabular: true,
    spec: "34 / 600 / −0.032em · tabular",
  },
  {
    role: "Stat",
    size: 27,
    weight: 600,
    tracking: "-0.028em",
    tabular: true,
    spec: "27 / 600 / −0.028em · tabular",
  },
  {
    role: "Body",
    size: 13,
    weight: 400,
    leading: 1.55,
    spec: "13 / 400 · 1.55",
  },
  {
    role: "Meta",
    size: 12,
    weight: 400,
    spec: "12 / 400",
    note: "Always muted",
  },
  {
    role: "Eyebrow",
    size: 11,
    weight: 600,
    tracking: "0.12em",
    mono: true,
    upper: true,
    spec: "Mono 11 / 600 / 0.12em",
  },
];

/* ------------------------------------------------------------------ shape */

export const SPACING_SCALE = [
  4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 32, 40,
] as const;

export const RADII: readonly { px: number; label: string; use: string }[] = [
  { px: 4, label: "4px", use: "Chips, thumbnails" },
  { px: 6, label: "6px", use: "Inputs, buttons" },
  { px: 8, label: "8px", use: "Inner panels, banners" },
  { px: 10, label: "10px", use: "Cards" },
  { px: 12, label: "12px", use: "Cards, large" },
  { px: 999, label: "999px", use: "Pills" },
];

/* ------------------------------------------------------------------ rules */

export const RULES: readonly { title: string; body: string }[] = [
  {
    title: "No hairlines inside cards",
    body: "Section and card headers keep one bottom border. Repeated rows never get one — separate them with spacing, or on dense tables a faint alternating background. Stacked hairlines make the page look busy.",
  },
  {
    title: "One primary action per screen",
    body: "Navy fill marks the single thing the user most likely came to do. Everything else is secondary, subtle, or a plain link.",
  },
  {
    title: "Every figure gets a comparison",
    body: "A number alone cannot be judged. Pair it with a target, a range, a previous value, or a share of a total.",
  },
  {
    title: "Status colour means status",
    body: "Red, amber and green never appear as decoration, as chart fills for neutral categories, or as brand accents.",
  },
  {
    title: "Yellow is for plates",
    body: "Plate yellow appears on registration plates and nowhere else, so a plate is always recognisable at a glance.",
  },
  {
    title: "Empty states say what would appear",
    body: "Never “no data”. Name the thing that is absent and the condition that would put it there.",
  },
];

/* -------------------------------------------------------------- components */

export type BadgeSpec = {
  label: string;
  bg: string;
  fg: string;
  height: number;
  size: number;
  tracking?: string;
  upper?: boolean;
};

export const BADGES: readonly BadgeSpec[] = [
  {
    label: "2 blocking",
    bg: "#FEE2E2",
    fg: "#7F1D1D",
    height: 20,
    size: 11,
    tracking: "0.02em",
    upper: true,
  },
  {
    label: "Not advertised",
    bg: "#FEE2E2",
    fg: "#7F1D1D",
    height: 26,
    size: 12,
  },
  {
    label: "Awaiting parts",
    bg: "#FEF9C3",
    fg: "#713F12",
    height: 26,
    size: 12,
  },
  { label: "Ready to sell", bg: "#DCFCE7", fg: "#14532D", height: 26, size: 12 },
  {
    label: "In preparation",
    bg: "#DBEAFE",
    fg: "#1E3A8A",
    height: 26,
    size: 12,
  },
  {
    label: "163 days in stock",
    bg: "#F4F4F5",
    fg: "#3F3F46",
    height: 26,
    size: 12,
  },
  { label: "Sold", bg: "#F4F4F5", fg: "#A1A1AA", height: 26, size: 12 },
];

export const DEAL_BADGES: readonly BadgeSpec[] = [
  { label: "Deposit taken", bg: "#F3E8FF", fg: "#581C87", height: 26, size: 12 },
  { label: "Collection", bg: "#F3E8FF", fg: "#581C87", height: 26, size: 12 },
  { label: "Completed", bg: "#D1FAE5", fg: "#064E3B", height: 26, size: 12 },
  { label: "Test drive", bg: "#FEF9C3", fg: "#713F12", height: 26, size: 12 },
  { label: "Contacted", bg: "#E0F2FE", fg: "#0C4A6E", height: 26, size: 12 },
  { label: "Lost", bg: "#FEE2E2", fg: "#7F1D1D", height: 26, size: 12 },
];
