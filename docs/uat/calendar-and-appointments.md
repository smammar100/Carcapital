# UAT — Calendar Pages & Appointments

User Acceptance Tests for the calendar UI (rich vs compact event cards) and the appointment lifecycle (book, view, edit). Run these in the running dev build with the seeded mock data.

## How to run

1. Start the dev server (e.g. `bun dev` or `npm run dev`) and open the printed URL.
2. Go to `/login` and pick any demo user — for full coverage use **Abbas Bhai** (Owner, all capabilities).
3. Mock appointments live in `src/lib/mock-data.ts` (`mockAppointments` array). The seed includes appointments at varying dates/times. Maintenance jobs there default to `estimatedDurationHours: 2` so they will trigger rich cards.
4. Pages under test:
   - `/sales/appointments` (Calendar tab + List tab)
   - `/maintenance/calendar`
   - `/admin/master-calendar`

The rich-card threshold is **128 px** of tile height — exactly 2 hours at the calendar's 64 px/hour scale. Anything shorter renders the existing compact tile.

Fill in **Status** (Pass / Fail / Blocked) and **Actual** in your own copy as you run each case.

---

## Suite 1 — Rich vs Compact Card Rendering

Cards must show the linked vehicle image only when the tile is at least 128 px tall **and** the event has a `vehicleId`. Otherwise the existing compact tile (time + title + meta) must show.

| Test ID | Title | Preconditions | Steps | Expected Result | Notes |
|---|---|---|---|---|---|
| CAL-01 | Short event renders compact | A 60-minute appointment exists today (default duration). | 1. Open `/sales/appointments`. 2. Switch to the **Calendar** tab. 3. Switch view to **Weekly**. 4. Locate today's appointment tile. | Tile is ~64 px tall, shows time + customer name + reg plate, **no vehicle image**. | 60 min × (64 px/hr) = 64 px < 128. |
| CAL-02 | Tall event with hero image renders rich | A maintenance job (default 2 h) exists with `dueDate` set on a vehicle that has a generated hero image. | 1. Open `/maintenance/calendar`. 2. Weekly view. 3. Locate the 2 h maintenance tile. | Tile is ~128 px tall and shows time + title + meta **plus the vehicle's hero image filling the bottom of the card**. | Image comes from `<VehicleImage variant="card">`. |
| CAL-03 | Tall event without hero image falls back to Car icon | A maintenance job (≥2 h) on a vehicle whose hero image hasn't been generated yet (or whose generation 404s). | 1. Open `/maintenance/calendar`. 2. Locate the affected job. | Card renders rich layout but with a **muted background + Car icon + RegPlate** in place of the photo. | Verifies `<VehicleImage>` `errored` branch. |
| CAL-04 | Workshop event with no vehicleId stays compact | On `/admin/master-calendar`, the Workshop filter is on and at least one workshop entry is present (≥2 h). | 1. Open `/admin/master-calendar`. 2. Confirm the Workshop chip is enabled. 3. Locate a workshop tile (amber). | Tile is amber, ≥128 px tall, but **never shows an image** (workshop entries have no `vehicleId`). | Confirms the `!!event.vehicleId` guard. |
| CAL-05 | Monthly view never shows rich cards | Any data. | 1. On any of the three calendar pages, switch view to **Monthly**. | Each day cell shows compact event chips (max 3 per cell, with `+N more`). No vehicle image appears anywhere. | `MonthGrid` does not use `EventBlock`. |

---

## Suite 2 — Booking an Appointment

Books from `/sales/appointments`. Validation matches the Zod schema in `src/app/(dashboard)/sales/appointments/page.tsx`.

| Test ID | Title | Preconditions | Steps | Expected Result | Notes |
|---|---|---|---|---|---|
| BOOK-01 | Happy path | Logged in. At least one vehicle in status `listed`, `ready`, or `reserved`. | 1. `/sales/appointments`. 2. Click **Book Appointment**. 3. Pick a vehicle. 4. Fill customer name, phone, email. 5. Pick today's date and 14:00. 6. Submit. | Toast: "Booked — WhatsApp ✓ Email ✓". Dialog closes. New row appears at top of List tab; new tile appears at 14:00 in Calendar tab. | |
| BOOK-02 | Vehicle is required | Logged in. | 1. Open booking dialog. 2. Leave vehicle empty. 3. Fill all other fields. 4. Submit. | Form does not submit. The Vehicle Select still shows the placeholder "Pick a listed / ready vehicle". | Zod `vehicleId.min(1)`. |
| BOOK-03 | Email is required | Logged in. | 1. Open booking dialog. 2. Pick vehicle, fill name, phone, date, time. 3. Leave email blank. 4. Submit. | Form does not submit; email field flagged as required. | |
| BOOK-04 | Vehicle list excludes sold/reserved-as-non-bookable | Mixed inventory. | 1. Open booking dialog. 2. Open the Vehicle Select. | Only vehicles with status `listed`, `ready`, or `reserved` appear. Sold / draft / archived vehicles do not. | |
| BOOK-05 | New booking renders with the right tone | Just completed BOOK-01. | 1. Switch to Calendar tab. 2. Find the new tile. | The tile uses the **blue** tone (status `upcoming` → `STATUS_TONE.upcoming`). At 60 min duration it's compact (no image). | |

---

## Suite 3 — Editing an Appointment

The detail dialog now has an **Edit** pencil button that swaps the read-only view for an editable form. Saving calls `appointmentService.update()` and refreshes the list + calendar in place.

| Test ID | Title | Preconditions | Steps | Expected Result | Notes |
|---|---|---|---|---|---|
| EDIT-01 | Edit toggles in and out cleanly | At least one upcoming appointment exists. | 1. Click any appointment tile or row to open the detail dialog. 2. Click the **Edit** pencil button (top-right of the dialog header). 3. Click **Cancel**. | Step 2: read-only fields disappear; form fields appear pre-filled with the appointment's current values. Step 3: form disappears, read-only view returns, no data changed. | |
| EDIT-02 | Update customer name | Detail dialog open on a known appointment. | 1. Click **Edit**. 2. Change the customer name. 3. Click **Save**. | Toast: "Appointment updated". Dialog returns to read-only view with the new name in the title. List row + calendar tile update without reload. | |
| EDIT-03 | Reschedule (date + time) | Detail dialog open. | 1. **Edit**. 2. Change date to tomorrow and time to 16:00. 3. **Save**. 4. Close dialog. 5. Switch Calendar tab to **Weekly**, navigate to tomorrow. | Tile is gone from the original slot and present at tomorrow 16:00. Reload the page → change persists (in-memory store). | |
| EDIT-04 | Change vehicle → image updates on tall tiles | Edit a tile that's ≥128 px tall (or one you'll grow into a longer event by editing time first). | 1. **Edit**. 2. Pick a different vehicle from the Select. 3. **Save**. | Calendar tile (when tall) shows the **new vehicle's** hero image (or fallback). Read-only view in the dialog also shows the new registration. | |
| EDIT-05 | Edit dialog uses full vehicle list | Detail dialog open in edit mode. | 1. **Edit**. 2. Open the Vehicle Select. | All vehicles appear (not just `listed/ready/reserved`). | Edit lets you switch to any vehicle; booking is more constrained. Confirmed by reading both Selects. |

---

## Suite 4 — Viewing an Appointment

The detail dialog (read-only view) is the canonical "view" surface. It can be opened from either the calendar tile or a list-row click.

| Test ID | Title | Preconditions | Steps | Expected Result | Notes |
|---|---|---|---|---|---|
| VIEW-01 | Open from calendar tile | At least one appointment today. | 1. `/sales/appointments` Calendar tab → click a tile. | Detail dialog opens. Header shows customer name + Edit button. Body shows: When (date · time), Vehicle (registration), Phone, Email, Notes if present, notification status (`WhatsApp ✓/✗ · Email ✓/✗`), Set outcome buttons. | |
| VIEW-02 | Open from list row | Same data. | 1. Switch to **List** tab. 2. Click any row. | Same dialog opens with the same fields populated. | |
| VIEW-03 | Notification status visible | Appointment exists. | 1. Open detail dialog. 2. Read the small grey line. | Shows `WhatsApp ✓` and `Email ✓` for booked appointments (mock-fired during create). | Mock always returns success — both ✓. |
| VIEW-04 | Close paths return to underlying view cleanly | Detail dialog open. | 1. Press **Escape**. 2. Re-open. 3. Click outside the dialog. 4. Re-open. 5. Click the X icon. | Each path closes the dialog without changing scroll position, calendar week, or filter chip state. | |

---

## Suite 5 — Multi-source events on Master Calendar

`/admin/master-calendar` overlays appointments (blue), workshop walk-ins (amber), and maintenance jobs (purple). The **Add Event** sheet creates any of the three.

| Test ID | Title | Preconditions | Steps | Expected Result | Notes |
|---|---|---|---|---|---|
| MULTI-01 | Add appointment from Master Calendar | Logged in, vehicle inventory present. | 1. `/admin/master-calendar`. 2. Click **+ Add Event**. 3. Select **Appointment** kind. 4. Fill required fields. 5. Save. | Sheet closes; new **blue** event appears at the chosen slot. | Event source is `appointmentService.create`. |
| MULTI-02 | Add workshop walk-in | Same. | 1. **+ Add Event** → **Workshop**. 2. Fill registration, description, date, time. 3. Save. | New **amber** event appears. Even if duration ≥2 h, the tile **does not show an image** (no `vehicleId`). | |
| MULTI-03 | Add maintenance job | Vehicle inventory present. | 1. **+ Add Event** → **Maintenance**. 2. Pick vehicle, set due date, set 2 h duration. 3. Save. | New **purple** event. At ≥128 px height with the vehicle's hero image (or fallback). | |
| MULTI-04 | Filter chips hide/show events | Some of each kind on screen. | 1. Toggle each chip (Appointments / Workshop / Maintenance) off and on. | Each chip toggles only its event class; others unaffected. | |
| MULTI-05 | Long maintenance job uses rich card | A 2 h+ maintenance job with `dueDate` set is visible on master calendar. | 1. Locate the tile in Weekly view. | Tile is purple, ≥128 px tall, **renders the vehicle hero image**. | Cross-check that master-calendar's wiring of `vehicleId` reaches the rich path. |

---

## Suite 6 — Click-to-preview dialog (all calendar pages)

Clicking any event tile opens a preview dialog with a tone pill, key fields, an **Edit** button, and a primary CTA. Closing the dialog returns to the calendar with no state loss.

| Test ID | Title | Preconditions | Steps | Expected Result | Notes |
|---|---|---|---|---|---|
| PREVIEW-01 | Appointment preview on Master Calendar | A future-dated appointment is visible. | 1. `/admin/master-calendar`. 2. Click the appointment tile. | Dialog opens with **Appointment** pill, customer name in the title, rows: When / Vehicle / Phone / Email (+ Notes if present). Footer shows Edit + View Vehicle. | |
| PREVIEW-02 | Maintenance preview on Master Calendar | A maintenance tile is visible. | 1. Click the purple tile. | Dialog opens with **Maintenance** pill, description in the title, rows: Due / Vehicle / Status / Estimated (+ Notes). Footer shows Edit + View Vehicle. | |
| PREVIEW-03 | Workshop preview on Master Calendar | A workshop walk-in tile is visible. | 1. Click the amber tile. | Dialog opens with **Workshop** pill, customer name in the title, rows: When / Vehicle / Phone / Status (+ Notes). Footer shows Edit + Open Workshop (no View Vehicle because workshop has no `vehicleId`). | |
| PREVIEW-04 | Preview on Maintenance Calendar | At least one job visible. | 1. `/maintenance/calendar`. 2. Click any tile. | Dialog opens with status pill (Pending / In progress / Completed / Stalled), description in title, same row set as PREVIEW-02. Footer shows Edit + View Vehicle. | |
| PREVIEW-05 | Preview on Sales Appointments | At least one appointment visible. | 1. `/sales/appointments` Calendar tab. 2. Click any tile. | Dialog opens with customer name in title and inline pencil **Edit** in the header, read-only When / Vehicle / Phone / Email / Notes / notification status, **Set outcome** chip row, and a **View Vehicle** CTA in the footer. | This dialog uses the original inline-edit pattern, not the shared component. |
| PREVIEW-06 | Close paths return cleanly | Dialog open. | 1. Press **Escape**. 2. Re-open. 3. Click outside. 4. Re-open. 5. Click X. | Each path closes the dialog without changing scroll, calendar week, or filter state. | |

---

## Suite 7 — Editing on Master Calendar

The Edit button in the preview now opens an inline `EventEditDialog` (no page navigation). Saving immediately refreshes the calendar so the change is visible without reload.

| Test ID | Title | Preconditions | Steps | Expected Result | Notes |
|---|---|---|---|---|---|
| MEDIT-01 | Edit appointment from Master Calendar | An upcoming appointment exists. | 1. Click the appointment tile. 2. Click **Edit**. 3. Change customer name and time. 4. **Save**. | Toast: "Appointment updated". Edit dialog closes. The original tile on `/admin/master-calendar` updates in place — new time slot, new title — without reload. | |
| MEDIT-02 | Edit workshop walk-in | A workshop event exists. | 1. Click the amber tile → **Edit**. 2. Change scheduled date and description. 3. **Save**. | Toast: "Workshop job updated". Tile moves to the new date on the calendar. | |
| MEDIT-03 | Edit maintenance job | A maintenance event exists. | 1. Click the purple tile → **Edit**. 2. Change due date, estimated hours, notes. 3. **Save**. | Toast: "Maintenance job updated". Tile reflows to the new date and (if duration crosses 2 h) shows the rich vehicle image card. | |
| MEDIT-04 | Cancel keeps original | Edit dialog open with changed values. | 1. Click **Cancel**. | Dialog closes. Tile and underlying entity are unchanged on reload. | |
| MEDIT-05 | Vehicle change updates linked thumbnail | A 2 h+ maintenance event with rich card. | 1. **Edit** → change vehicle to one with a different reg. 2. **Save**. | Calendar tile updates registration plate AND swaps the vehicle hero image (or fallback) to the newly selected vehicle's. | |

---

## Suite 8 — Editing on Maintenance Calendar

`/maintenance/calendar` Edit button on the preview opens the same `EventEditDialog` in maintenance mode.

| Test ID | Title | Preconditions | Steps | Expected Result | Notes |
|---|---|---|---|---|---|
| MAINT-EDIT-01 | Open edit form pre-populated | Job visible on calendar. | 1. Click the tile. 2. Click **Edit**. | Dialog opens titled "Edit Maintenance Job" with Vehicle / Description / Due date / Estimated hours / Notes pre-filled from the job. | |
| MAINT-EDIT-02 | Reschedule via due date | Job in upcoming week. | 1. **Edit** → change due date to a different day in the same week. 2. **Save**. | Tile disappears from the original day and reappears on the new day. | |
| MAINT-EDIT-03 | Update notes | Any job. | 1. **Edit** → set Notes to a unique string. 2. **Save**. 3. Re-open the preview. | The new Notes string is visible in the preview row. | |
| MAINT-EDIT-04 | Validation: missing description | Edit dialog open. | 1. Clear the Description field. 2. **Save**. | Form blocks submission with a Zod error on Description. | |
| MAINT-EDIT-05 | Cross-page consistency | Edited a job in MAINT-EDIT-02 (date change). | 1. After save, navigate to `/admin/master-calendar`. | The same job appears on the new day there too — both pages share the same mock store. | |

---

## Suite 9 — Editing on Sales Appointments (existing inline dialog)

The Sales Appointments dialog uses its own inline edit form (not the shared `EventEditDialog`). These cases re-verify it after the recent refactors.

| Test ID | Title | Preconditions | Steps | Expected Result | Notes |
|---|---|---|---|---|---|
| AEDIT-01 | Pencil opens form | Appointment open in detail dialog. | 1. Click the **Edit** pencil button. | Read-only fields are replaced with form inputs prefilled with current values. | |
| AEDIT-02 | Save → list + calendar refresh | Edit dialog open. | 1. Change customer name. 2. **Save**. | Toast: "Appointment updated". Dialog returns to read-only view with new name in the title; List tab row and Calendar tile both show the new name without page reload. | |
| AEDIT-03 | Reschedule (date + time) | Edit dialog open. | 1. Change date to tomorrow and time to 16:00. 2. **Save**. | Tile moves to tomorrow 16:00 in the Calendar tab. | |
| AEDIT-04 | Vehicle swap shows in tile meta | Edit dialog open. | 1. Pick a different vehicle. 2. **Save**. | Tile meta line shows the new registration. | |
| AEDIT-05 | Cancel keeps original | Edit dialog open with unsaved changes. | 1. Click **Cancel**. | Dialog returns to read-only view; no changes saved. | |

---

## Known gaps / non-goals

- Status field (`upcoming` / `completed` / `cancelled` / `no_show`) is not directly editable from the dialog — `setOutcome` flips status to `completed` as a side-effect of choosing an outcome, and there is currently no separate status setter UI. Out of scope for this UAT.
- The **+ Add Job** button on `/maintenance/calendar` is currently unwired (renders but does nothing). Confirm it's wired before adding test cases against it.
- Role enforcement: the `view_only` role exists in `src/lib/roles.ts` but is not enforced on these pages — a `view_only` user can still book/edit. Flag this to product but do not block UAT.
