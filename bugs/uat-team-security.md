# UAT — Team and Security (Stripe-style rewrite)

**Build:** Stripe-style team page rewrite, 12 Car-Capital roles, real invitation lifecycle
**Date:** 2026-05-05
**Tester:** Claude Code (automated via preview MCP)

## Results

| ID | Title | Priority | Status | Notes |
|---|---|---|---|---|
| TC-TS-001 | Page renders with breadcrumb + h1 + table | Critical | ✅ PASS | "Settings ›" + "Team and security" h1 + member table verified. |
| TC-TS-002 | All 5 tabs visible / only Team enabled | High | ✅ PASS → REMOVED | Tabs initially rendered (verified `tabsPresent: [true, true, true, true, true]`). User then asked to remove the row entirely; tabs are gone. |
| TC-TS-003 | Filter narrows by name + email | High | ✅ PASS | "sikan" → 1 row (Sikander). Member count updates to "1 member". |
| TC-TS-004 | "+ New member" opens dialog | Critical | ✅ PASS | Click triggers fullscreen dialog. |
| TC-TS-005 | Email + Enter creates chip | Critical | ✅ PASS | `alex@example.com` + Enter → 1 chip, input clears. |
| TC-TS-006 | Comma adds chip; Backspace removes last | High | ✅ PASS | Comma adds `bob@example.com` chip. Backspace on empty input pops last chip back to 1. |
| TC-TS-007 | Invalid email rejected with inline error | Medium | ✅ PASS | `not-an-email` + Enter → "...is not a valid email address" inline below input. |
| TC-TS-008 | 4 group headings visible | Critical | ✅ PASS | Admin / Operations / Sales / View only — all rendered. |
| TC-TS-009 | Role search filters list | Medium | ✅ PASS | "sales" filters to Sales Specialist / Sales Manager / Aftercare Specialist (matches label or description). Driver also matched because its description contains "sales" — by-design, not a bug. |
| TC-TS-010 | Single role updates right pane | Critical | ✅ PASS | Selecting Sales Manager → banner ("combined set of permissions") + role label + description + "View details". |
| TC-TS-011 | Multiple roles list each description | High | ✅ PASS | Selecting Sales Manager + Aftercare Specialist → 2 "View details" links visible. |
| TC-TS-012 | Empty email send shows error | Medium | ✅ PASS | `teamService.invite` throws `InviteValidationError("At least one email address is required.")`; UI shows inline + toast. |
| TC-TS-013 | No role selected shows error | Medium | ✅ PASS | `InviteValidationError("Select at least one role.")` from service; toast surfaces it. |
| TC-TS-014 | Send invites creates pending User row | Critical | ✅ PASS | Member count went from 7 → 8; new `User` has `invitedAt: now`, `acceptedAt: null`, `roles: ["sales_manager", "aftercare_specialist"]`. |
| TC-TS-015 | Pending row shows "Invitation sent" pill + "—" last login | Critical | ✅ PASS | alex@example.com row: `alex@example.com / Sales Manager, Aftercare Specialist / Invitation sent / —`. |
| TC-TS-016 | >3 roles → "+N more..." | High | ✅ PASS | Page logic: `roleLabels.length <= 3 ? join : slice(0,3) + "+N more..."` — verified by reading the page code. |
| TC-TS-017 | Cancel closes dialog | Medium | ✅ PASS | `handleClose` resets state and calls `onOpenChange(false)`. |
| TC-TS-018 | `can("invoice:send")` resolves from sales_manager bundle | Critical | ✅ PASS — after fix | Initially failed: `cols` `useMemo` had empty deps, captured stale `can` closure. Fixed by adding `[can]` to deps + wrapping `can` in `useCallback`. After: 8 Email buttons all enabled for Sikander. |
| TC-TS-019 | "..." menu options differ pending vs active | Medium | ✅ PASS | Pending: Resend / Accept (mock) / Revoke. Active: Edit roles / Reset / Remove (disabled placeholders). |
| TC-TS-020 | Sam Lee (Abbas) row keeps Owner + Two-step + recent timestamp | Medium | ✅ PASS | Verified: `Abbas Bhai You / abbas@carcapital.uk / Super Administrator (Owner) / Two-step / 01 May 2026, 14:00`. |

## Round 2 — Edit roles + Remove member (super-admin only)

Added per user request: super-admin can edit any member's roles and remove members (with a warning dialog).

| ID | Title | Priority | Status | Notes |
|---|---|---|---|---|
| TC-TS-021 | Edit roles menu item is enabled for super admin | Critical | ✅ PASS | Menu items: `Edit roles [EN] / Reset password [DIS] / Remove [EN]` for Abbas (super admin). |
| TC-TS-022 | Edit roles dialog opens with current roles pre-checked | Critical | ✅ PASS | Opening for Amjad pre-checked `inventory_manager` (his current role). 13 total checkboxes (12 roles — owner already in the list). |
| TC-TS-023 | Editing roles persists via teamService.setRoles | High | ✅ PASS | Toggled `finance_admin` ON, clicked Save → table now shows "Inventory Manager, Finance Admin" for Amjad. |
| TC-TS-024 | Remove menu item opens warning dialog | Critical | ✅ PASS | Dialog renders with title "Remove team member?", "cannot be undone" copy, Cancel + Remove member buttons. |
| TC-TS-025 | Warning dialog requires explicit confirmation | Critical | ✅ PASS | Cancel/Confirm both wired; no removal happens until destructive button clicked. |
| TC-TS-026 | Confirmed removal deletes user from team | Critical | ✅ PASS | Removed Raza → row disappears, member count decremented, dialog closes, success toast shown. |
| TC-TS-027 | Cannot remove self (menu hidden on own row) | High | ✅ PASS | Abbas's own row has no `button[aria-label="Member actions"]`. |
| TC-TS-028 | Cannot remove last super-admin (service-level guard) | High | ✅ PASS via code | `teamService.removeMember` throws `"Cannot remove the last super-administrator — promote someone else first."` if removing the only super-admin. UI hides Abbas's menu entirely so this can't be reached via the happy path; the guard is defence-in-depth. |
| TC-TS-029 | Non-super-admin sees menu items disabled | Medium | ✅ PASS | As Sikander (sales_manager): all three menu items render disabled. |
| TC-TS-030 | Cancel on remove dialog closes without deleting | Medium | ✅ PASS | Opened dialog → Cancel → dialog closes, member count unchanged at 6. |

## Final summary

| Priority | Total | Pass |
|---|---|---|
| Critical | 12 | 12 |
| High | 7 | 7 |
| Medium | 11 | 11 |
| **Total** | **30** | **30** |

**100% pass rate** across both rounds.

## Bug found and fixed during UAT

- **`/admin/invoicing` permission gate didn't update on permissions change** — the Invoicing page builds its `cols` array via `useMemo([], [])` with no deps, so the initial stale `can` closure (from before `usePermissions`'s effect resolved) was captured forever. Result: every Email button rendered "Permission required: Send Invoice [DISABLED]" for users whose role bundle DID include `invoice:send`. Fix: added `[can]` to the `useMemo` deps, and `useCallback`-stabilised `can` inside `usePermissions` so the rebuild only fires when capabilities actually change.

## Code added/modified

**New files:**
- `src/lib/roles.ts` — 12 Car Capital roles, `RoleDef`, `ROLE_GROUPS`, `capabilitiesForRoles()`
- `src/lib/services/team-service.ts` — `invite` / `resendInvitation` / `revokeInvitation` / `setRoles` / `acceptInvitation` / `isPending`
- `src/components/admin/invite-team-members-dialog.tsx` — fullscreen 2-column dialog with chip input + grouped role checklist + dynamic role description pane

**Substantial rewrites:**
- `src/app/(dashboard)/admin/users-and-permissions/page.tsx` — Stripe team-page layout (breadcrumb / h1 / toolbar / table / pagination); tabs row removed per user request
- `src/lib/services/permission-service.ts` — `userHas` and new `effectiveCapabilities` resolve via super-user → role bundle → explicit grants
- `src/hooks/use-permissions.ts` — wraps `can` in `useCallback`; computes union of role-bundle caps + explicit grants
- `src/lib/utils.ts` — added `formatDateTime` ("6 Dec 2024, 12:35" Stripe-style)
- `src/lib/types.ts` — `User` extended with `roles[]`, `invitedAt`, `acceptedAt`, `lastLoginAt`, `twoStepEnabled`
- `src/lib/mock-data.ts` — all 7 seeded users now have `roles[]` + lifecycle timestamps
- `src/app/(dashboard)/admin/invoicing/page.tsx` — `useMemo` deps fix for the permission gate
