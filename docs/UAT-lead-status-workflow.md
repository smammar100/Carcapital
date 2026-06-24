# UAT — Lead status workflow

Covers the **Update lead status** flow on `/sales/leads`: moving a lead through
`New → Contacted → Appointment Booked → Lost`, the appointment booking that
auto-creates a calendar entry, and the required Lost reason.

Each lead row carries a status; the detail panel's **Update status** button opens
a dialog where the user picks the target status. Side-effects per target:

| Target | Extra input | Side-effects |
|---|---|---|
| New | — | status → new, activity logged |
| Contacted | — | status → contacted, activity logged |
| Appointment Booked | date + time (+ vehicle if none linked) | creates an appointment (Appointments calendar), links vehicle to lead if needed, status → appointment_booked, activity logged |
| Lost | reason (required, ≥5 chars) | status → lost, reason appended to Notes as `[Lost YYYY-MM-DD] …`, activity logged |

## Pre-conditions
- Signed in as a user who can manage leads (e.g. Sales / super-user).
- At least one lead in each status; some **with** a linked stock vehicle and some **without**.

## Test cases

### TC-1 — Dialog opens with current status marked
1. Select any lead → click **Update status**.
- ✅ Dialog lists New / Contacted / Appointment Booked / Lost; the lead's current status shows a "current" chip; the natural next status is preselected.

### TC-2 — New → Contacted
1. Select a **New** lead → Update status → choose **Contacted** → **Update status**.
- ✅ Toast "Lead moved to Contacted"; the lead's dot/detail now shows Contacted; Activity log has a `lead_status_changed` entry "moved new → contacted".

### TC-3 — Contacted → Appointment Booked (vehicle already linked)
1. Select a lead **with a linked vehicle** → Update status → **Appointment Booked**.
- ✅ Date/time shown (date prefilled today, time 10:00); **no** vehicle picker.
2. Set a date + time → **Book appointment**.
- ✅ Toast "Appointment booked — added to the calendar"; lead status → Appointment Booked; the appointment appears under **Sales → Appointments**; lead now shows "Appointment booked — see the Appointments calendar."

### TC-4 — New → Appointment Booked (NO vehicle linked)
1. Select a lead with **no** linked vehicle → Update status → **Appointment Booked**.
- ✅ A required **Stock vehicle** picker appears.
2. Leave vehicle = "Pick a vehicle…" → **Book appointment**.
- ✅ Inline error: "Pick a stock vehicle — an appointment is booked against a car." No appointment created.
3. Pick a vehicle + date + time → **Book appointment**.
- ✅ Appointment created; the chosen vehicle is now linked to the lead (visible in "Vehicle of interest"/Create deal becomes available); status → Appointment Booked.

### TC-5 — Appointment date/time validation
1. Appointment Booked target, clear the date (or time) → **Book appointment**.
- ✅ Error "Date and time are required…"; nothing booked.

### TC-6 — Lost requires a full reason
1. Select a lead → Update status → **Lost**.
- ✅ Required reason textarea appears.
2. Submit empty or < 5 chars → **Mark as Lost**.
- ✅ Error "Please enter a full reason…"; no change.
3. Enter a full reason → **Mark as Lost**.
- ✅ Toast "Lead marked Lost — reason saved"; status → Lost; the **Notes** field now ends with `[Lost YYYY-MM-DD] <reason>`; Activity log entry includes the reason.

### TC-7 — Reopen a Lost lead
1. Select a **Lost** lead → Update status → **Contacted** → submit.
- ✅ Status → Contacted; the earlier `[Lost …]` note is **retained** (history preserved); new activity entry logged.

### TC-8 — Cancel is a no-op
1. Open Update status, change selection/fields → **Cancel**.
- ✅ Dialog closes, lead unchanged.

### TC-9 — No double-submit
1. Submit any transition and observe while it saves.
- ✅ Buttons show "Saving…" and are disabled; exactly one change/appointment is created.

### TC-10 — Create deal still works
1. Select a vehicle-linked lead → **Create deal in pipeline**.
- ✅ Deal created; navigates to **Sales → Pipeline**.

### TC-11 — Filters + search after a change
1. Set Status filter = **New**; mark a visible lead **Contacted**.
- ✅ That lead leaves the filtered list; selection falls back to the next lead; counts/ordering update. Search by name/phone/vehicle still filters correctly.

### TC-12 — Freshness
1. After any status change, the left list dot and right detail reflect the new status without a manual refresh.
- ✅ (leads cache is invalidated on write and re-fetched.)

## Known limitations (by design, for now)
- **Moving *out* of Appointment Booked** (e.g. to Lost/Contacted) does **not** auto-cancel the existing appointment — cancel it from Appointments if needed.
- **Lost reason** is stored in `notes` (dated marker) + activity log; there is no dedicated `lost_reason` column yet. A future migration can promote it to a first-class field (and a structured reason list) without changing this UI.
- **Past dates** are accepted by the appointment date field; add a min-date guard if back-dating should be blocked.
