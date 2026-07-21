# UAT — Vehicle picker (GEN-79 search · GEN-85 dialog overflow)

Scope: `src/components/shared/vehicle-picker.tsx`, used by
Leads → **Create Lead** → Vehicle, and Leads → **Update status** →
Appointment Booked → **Stock vehicle**.

Pre-reqs: signed in with lead-create permission. Stock of ~100+ vehicles so
the list is long enough to be worth searching.

Two things are being checked together: **the search works** (GEN-79, shipped)
and **the dropdown sits correctly inside its dialog** (GEN-85, open).

---

## A. Search behaviour — GEN-79

Registrations are stored inconsistently in this data — some with a space
(`FG68 RGY`), some without (`NA66XGM`). Search must not care.

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| A1 | Reg, no space | Type `NA66XGM` | Narrows to that car (BMW X5, CC-0018). | ☐ |
| A2 | Reg, with space | Type `NA66 XGM` | Same single result. The space must not matter. | ☐ |
| A3 | Reg, lower case | Type `na66xgm` | Same single result. | ☐ |
| A4 | Reg stored WITH a space, typed without | Type `FG68RGY` | Finds `FG68 RGY` (BMW 3 Series). This is the case the naive version missed. | ☐ |
| A5 | Stock ID | Type `CC-0018` | Finds that car. | ☐ |
| A6 | Make + model | Type `bmw x5` | Finds matching cars. | ☐ |
| A7 | Partial | Type `NA66` | Matches while still incomplete. | ☐ |
| A8 | Enter selects | Type a reg until one match, press **Enter** | That vehicle is selected without touching the mouse. | ☐ |
| A9 | Selection reads cleanly | After selecting | Field shows `NA66XGM — BMW X5 (CC-0018)` — the reg appears **once**, not duplicated. | ☐ |
| A10 | Interest auto-fills | After selecting in Create Lead | **Vehicle interest** populates as `BMW X5 (NA66XGM)`. | ☐ |
| A11 | Clear | Click the ✕ in the field | Selection clears; the lead can still be created with free text. | ☐ |
| A12 | No match | Type `ZZ99 ZZZ` | "No vehicle matches — leave blank to use free text." Not an empty void. | ☐ |
| A13 | Row contents | Open the list | Each row shows the reg plate, make/model and stock ID. | ☐ |
| A14 | Inspection hint | Look for a car mid-inspection (e.g. CC-0119) | Shows `insp 0/20` in amber. Cars never inspected show nothing (see [UAT-prep-and-repair.md](UAT-prep-and-repair.md)). | ☐ |

---

## B. Dropdown layout — GEN-85 (currently failing)

**These are expected to FAIL until GEN-85 is fixed.** Recorded here so the fix
has something to be verified against.

Measured on 2026-07-21 at 900×700: popup overflows the dialog's right edge by
**22px**, is **47px wider** than its own input, and each row is inset **36px**
against the input's ~12px — a ~24px dead gutter.

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| B1 | Contained horizontally | Create Lead → click **Vehicle** | Dropdown's left and right edges sit inside the dialog's edges. Nothing hangs over the modal or backdrop. | ☐ |
| B2 | Width matches the field | Same | Dropdown is the same width as the input above it and aligned on both edges. | ☐ |
| B3 | No dead gutter | Look at the left edge of the rows | Reg plates line up with the search icon in the input — no unexplained indent. | ☐ |
| B4 | Footer reachable | Open the picker, then go for **Cancel** / **Create** | Either not covered, or Esc / click-away restores access. Never unreachable. | ☐ |
| B5 | Short viewport | Resize to ~900×700, reopen | List is bounded by the dialog and scrolls internally; doesn't run past the dialog's bottom. | ☐ |
| B6 | Large viewport | 1440×900, then 1920×1080 | Same alignment; no regression. | ☐ |
| B7 | Flip up | Scroll the Vehicle field near the bottom, open | Opens upward, still inside the dialog. | ☐ |
| B8 | Long list | Open with all ~120 vehicles | List scrolls within its own bounds; the dialog doesn't grow or gain a scrollbar. | ☐ |
| B9 | Resize on filter | Type `BMW`, then clear | Popup shrinks and grows back, staying inside the dialog throughout. | ☐ |
| B10 | Selected row | Select one, reopen | Selected row is marked without adding a gutter to every other row. | ☐ |
| B11 | Dark mode | Repeat B1–B3 in dark mode | Same geometry; border and shadow read correctly against the dialog. | ☐ |

---

## C. Second dialog

The same component is used in the appointment flow, so it can regress
independently of Create Lead.

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| C1 | Appointment picker — search | Leads → a lead with **no** vehicle → **Update status** → Appointment Booked → **Stock vehicle** | Reg / stock ID / make search all behave as section A. | ☐ |
| C2 | Appointment picker — layout | Same | All of section B holds here too. | ☐ |
| C3 | Booking still works | Pick a vehicle, set date/time, confirm | Appointment is created against the chosen vehicle. | ☐ |

---

## Sign-off

| Field | Value |
|---|---|
| Tester | _________________________ |
| Date | _________________________ |
| Total cases | 28 |
| Passed | ___ / 28 |
| Failed | ___ / 28 |
| Commit SHA tested | _________________________ |
| Notes | _________________________ |

**Status:**
- ☐ Approved
- ☐ Approved with follow-ups
- ☐ Rejected — return to dev
