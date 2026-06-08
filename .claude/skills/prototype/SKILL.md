---
name: prototype
description: Use when designing or redesigning ANY UI screen, view, modal, or component for the Car Capital app. Instead of one-shotting a design, build 5 distinct Mobbin-referenced variations side-by-side in the /prototype page so the user picks the winner BEFORE you implement it for real. One feature at a time — never proceed to the next screen without explicit go-ahead.
---

# Prototype-first UI workflow

Never one-shot a screen's design. For EVERY UI feature (login, dashboard, a modal, a
list, a detail page…) follow this loop, **one feature at a time**.

## 1. Reference Mobbin FIRST — this is the most important part
- Use the Mobbin MCP (`search_screens` / `search_flows`, `platform: "web"`) to pull
  4–6 real references for the exact screen type.
- Study the actual UI elements and reproduce them: layout, spacing rhythm, hierarchy,
  control styling, empty/loading states, where actions sit. The variations MUST be
  grounded in these real patterns — cite the apps you drew from.

## 2. Build 5 variations side-by-side in the prototype page
- File: **`src/app/prototype/page.tsx`** — a single, auth-free route at `/prototype`.
  Replace its contents with the CURRENT feature's 5 variations each time.
- Render all 5 **side-by-side** in labelled frames ("Variation A — <name>" … "E"),
  each a realistic, self-contained take on the feature.
- Each variation must:
  - Use the REAL Nord web components (`<nord-*>`) + the app's tokens — not flat mockups.
  - Have correctly-sized controls: form fields are **full-width** (`expand` on
    `nord-input` / `nord-select` / `nord-textarea`), aligned, never cramped/half-width.
  - Be genuinely DISTINCT (different structure, not recolours): e.g. centered card,
    split-screen brand panel, minimal no-card, accent-header card, SSO-led, etc.
  - Look polished and production-real (Mobbin-grade) in BOTH light and dark.
- Keep them presentational (no real data/auth) so the user can compare fast.

## 3. Present + let the user pick
- `pnpm build` + start the prod server, open `/prototype` in Chrome, screenshot it in
  **light AND dark**, and show the user. The user picks the winner (A–E). Never assume.

## 4. Build the winner for real
- Implement the chosen variation as the actual screen, wired to real data/auth/logic
  (reuse `@/components/nord/form/*` adapters, the toast bridge, auth context, etc.).
- Verify: `pnpm tsc --noEmit` + `pnpm lint` + `pnpm build` clean; Chrome check in
  light + dark; console hydration-clean.

## 5. STOP — wait for go-ahead
- Do NOT start the next screen until the user explicitly says go, and confirms the
  current screen is signed off.

## Guardrails
- One feature at a time. Quality bar = Mobbin-grade; components must never look broken,
  cramped, or half-converted.
- Reuse the foundation already in place: the Nord token bridge (`src/app/globals.css`),
  `NordRegister`, the `@/components/nord/form/*` adapters, and the toast bridge.
- Light + dark must both look right (the `.dark` token bridge flips everything).
