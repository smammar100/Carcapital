# UAT — Module A · Vehicle Locations

**Spec:** `Module_A_Vehicle_Locations.md` (Spec v3.0 · Phase 2 · 2 – 8 June 2026)
**Migration anchor:** `db/migrations/0010_vehicle_locations.sql`
**Status:** Draft · ready for Ali walkthrough on Wednesday catch-up

---

## 1. Scope

| In | Out |
|---|---|
| 4 fixed locations (Forecourt / Yard / Garage / Staff) | A fifth "with customer" location |
| One physical location per car at any time (DB-enforced) | Multi-location workflows |
| Move dialog with destination + (vendor / staff / expected return) | Mileage out/in, fuel state, condition photos |
| Audit trail via `location_movements` table | License-check capture, e-signature |
| Off-site badge on Master Sheet (and Worklist when it ships) | GPS / RFID tracking |
| Dashboard widget with 4 counts | Yard heatmap, drone view |
| Test-drive flag (orthogonal — does NOT change location) | Test-drive ledger (mileage / fuel) — V1.1 |

---

## 2. Pre-requisites

1. Migration `0010_vehicle_locations.sql` has been applied to the target
   database. Re-running it must be a no-op.
2. Seed data loaded: at least 1 vehicle each at Forecourt / Yard / Garage / Staff.
3. Tester accounts available with both **Owner / Super User** and
   **Inventory Manager** roles.
4. At least 3 active **vendors** and 3 active **users** seeded so the
   garage/staff move-dialog selects have real options.

---

## 3. Test environment

| Setting | Value |
|---|---|
| URL | http://localhost:3000 (dev) / production after Phase 2 deploy |
| Browser | Chrome ≥ 124, Safari ≥ 17, Firefox ≥ 125 — both desktop (≥ 1280 px) and tablet (768–1024 px) |
| Default tab | `/admin/locations` → Forecourt (or `?tab=…` if set) |

---

## 4. Test cases

> Severity codes — **B** = blocker (must fix before launch);
> **M** = major (should fix); **L** = polish.
> Status codes — **P** = pass · **F** = fail · **N** = not run.

### 4.1 · Schema + service layer

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-S1 | Migration applies idempotently | Run `psql -f 0010_vehicle_locations.sql` twice. | First run adds columns + table; second run prints zero errors and changes nothing. | B | N |
| A-S2 | Vehicles back-fill | After migration, every vehicle has `current_location = 'forecourt'` (or its seed override) and `location_since IS NOT NULL`. | `select count(*) from vehicles where current_location is null` returns 0. | B | N |
| A-S3 | CHECK garage requires vendor | `INSERT INTO location_movements (vehicle_id, to_location, created_by) VALUES (…, 'garage', …);` without `external_vendor_id`. | Insert rejected with `location_movements_garage_requires_vendor` constraint error. | B | N |
| A-S4 | CHECK staff requires user | Same shape, `to_location = 'staff'` without `staff_user_id`. | Insert rejected with `location_movements_staff_requires_user` constraint error. | B | N |
| A-S5 | Invalid `to_location` rejected | Insert with `to_location = 'showroom'`. | Rejected by `location_movements_to_location_check`. | B | N |
| A-S6 | FK cascade on vehicle delete | Delete a vehicle row; verify its `location_movements` are removed. | Movements deleted via `ON DELETE CASCADE`. | M | N |

### 4.2 · Sidebar + page shell

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-N1 | Sidebar entry present | Sign in as any role. | "Locations" appears as a top-level entry **above** Inventory with the MapPin icon. | B | N |
| A-N2 | URL routing | Click "Locations". | Navigates to `/admin/locations`; the page title shows "Locations" with the spec helper text. | B | N |
| A-N3 | Tab counts render | Page loads with seed data. | Each tab shows a live numeric count next to its label. Sum equals total active vehicles. | B | N |
| A-N4 | URL state on tab switch | Click each tab in turn. | URL becomes `?tab=forecourt / yard / garage / staff`. Back button restores previous tab. | M | N |
| A-N5 | Default tab fallback | Visit `/admin/locations?tab=banana`. | Page falls back to Forecourt instead of crashing. | M | N |

### 4.3 · LocationTab table

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-T1 | Forecourt table renders | Open Forecourt tab. | Table lists every car where `current_location = 'forecourt'`. Columns: Stock ID, Reg, Make/Model, Status, Days here, Action. | B | N |
| A-T2 | Search by reg / stock id / model | Type a partial reg, then a model name. | Rows narrow as you type (client-side). The footer count reflects "X of Y (filtered)". | M | N |
| A-T3 | Garage tab — workshop secondary | Open Garage tab. | Each row shows the vendor name as a small muted second line under Stock ID. | M | N |
| A-T4 | Garage filter chips | A vendor chip set appears above the table. | Clicking a chip narrows to that vendor; clicking it again clears. "All" chip resets. | M | N |
| A-T5 | Staff tab — staff secondary + expected back | Open Staff tab. | Each row shows the staff member's name (secondary line) and an "Expected back" column with a date/time. | M | N |
| A-T6 | Days here formatting | Verify a 0d, 3d, 7d, 13d, 21d row. | "0d", "3d", "1w", "1w 6d", "3w" respectively. | L | N |
| A-T7 | Empty state | Filter to no matches. | Friendly italic message "No cars at {location}." appears in place of rows. | L | N |
| A-T8 | CSV export | Click **Export CSV** with no filter applied. | Downloads `locations-forecourt-YYYY-MM-DD.csv` with Stock ID, Reg, Make/Model, Status, Days here, Workshop/Staff. | M | N |
| A-T9 | CSV export respects filter | Filter to 2 rows → Export CSV. | Downloaded file contains only those 2 rows. | M | N |

### 4.4 · Move dialog (4.4.x)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-M1 | Open dialog from row Move button | Click **Move** on a Forecourt row. | Dialog opens. Title shows Stock ID + Make/Model + Reg. Subtitle "Currently at: Forecourt (since DD MMM)". | B | N |
| A-M2 | Current location disabled | Inspect destination radio group. | The car's current location appears with "(current)" suffix and is disabled / cannot be selected. | B | N |
| A-M3 | Forecourt ↔ Yard happy path | From a Forecourt row, choose Yard, leave notes blank, **Move →**. | Toast "Moved to Yard". Dialog closes. Row disappears from Forecourt and appears under Yard. Forecourt count –1, Yard count +1. | B | N |
| A-M4 | Garage requires vendor | Choose Garage. **Move →** button disabled until a vendor is picked. | Button enabled only after vendor select + expected-back time. | B | N |
| A-M5 | Staff requires user | Choose Staff. **Move →** disabled until a staff member is picked. | Button enabled only after staff select + expected-back time. | B | N |
| A-M6 | Expected back required for garage/staff | Choose Garage, pick a vendor, clear the expected-back field. | **Move →** button disabled. | B | N |
| A-M7 | Notes optional | Submit a move with empty notes. | Move succeeds. Movement row stored with `notes IS NULL`. | M | N |
| A-M8 | Server-side validation parity | Tamper the network request to send `to_location='garage'` without vendor. | Backend rejects with the CHECK constraint error; UI surfaces a toast. | M | N |
| A-M9 | Cannot move to current | Try to pick the current location anyway (force-enable in devtools and click Move). | Service throws "Vehicle is already at {location}"; toast surfaces it. | B | N |
| A-M10 | Cancel discards | Open dialog, type notes, click **Cancel**. | Dialog closes, no movement row written, no toast. | L | N |
| A-M11 | Re-open resets | Open dialog, pick Yard + notes, cancel; reopen on a different car. | Form fields are reset (no leakage between vehicles). | M | N |
| A-M12 | Permission gate | Sign in as a role without `locations:move`. | The Move button is hidden / no-ops on click; service refuses if called directly. | B | N |
| A-M13 | Activity log entry | After a successful move, open Activity Log for the vehicle. | New entry `vehicle_moved` with description "{from} → {to}" and metadata `{ from, to, externalVendorId?, staffUserId? }`. | M | N |

### 4.5 · Vehicle Detail integration

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-V1 | Location card present | Open any vehicle detail → Overview tab. | Right column shows a "Location" card with current location, since-date, days. | B | N |
| A-V2 | Recent moves preview | Vehicle with 3+ movements. | Card lists the 3 most recent moves with date + "From → To" + workshop/staff context. | M | N |
| A-V3 | Move from detail | Click **Move →** on the card. | The same MoveDialog opens, populated with the current vehicle. | B | N |
| A-V4 | View full history | Click **View full history**. | Right-side Sheet opens with chronological timeline of every movement, oldest at the bottom. | M | N |
| A-V5 | Mark returned | In the history drawer, find an open garage/staff entry → **Mark returned**. | `actual_return_at` set to now; button hides on re-render; toast "Marked returned". | M | N |
| A-V6 | History permission | As Inventory Manager, the **Mark returned** button is visible. | Visible. As a role with no `locations:move`, button hidden. | M | N |

### 4.6 · Master Sheet column + badge

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-X1 | Location column exists | Open `/admin/master-sheet`. | New "Location" column appears between Status and Days. Header icon is MapPin. | B | N |
| A-X2 | Off-site dot — Garage | Find a row at Garage. | Cell shows "Garage · Off-site" with a **red** dot. Hover reveals the workshop name (when available). | M | N |
| A-X3 | Off-site dot — Staff | Find a row at Staff. | Same as A-X2 but with an **amber** dot; tooltip shows staff name + expected back. | M | N |
| A-X4 | Test-drive clock | Toggle a Forecourt car to `out_for_test_drive = true` via DB. | Cell shows the location label + a small clock icon; tooltip shows the expected-back time. | L | N |
| A-X5 | CSV export includes location | Use the Master Sheet's Export CSV. | The Location column is present in the file with the raw value (forecourt/yard/garage/staff). | M | N |

### 4.7 · Dashboard widget

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-W1 | Widget renders | Open `/dashboard`. | "Vehicle locations" card shows 4 rows with counts + total. | B | N |
| A-W2 | Click-through | Click "Yard" row. | Navigates to `/admin/locations?tab=yard`. | B | N |
| A-W3 | Loading skeleton | Throttle network → reload. | Skeleton rows render before counts arrive. | L | N |
| A-W4 | Empty state | Wipe all `vehicles` rows. | Widget shows "Total: 0 active vehicles"; rows show 0 each. | L | N |

### 4.8 · Test-drive badge (Decision D-A1)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-D1 | Test-drive does not change location | Mark a Forecourt car with `out_for_test_drive = true`. | Vehicle stays in the Forecourt tab and Forecourt count. No `location_movements` row created. | B | N |
| A-D2 | Badge appears everywhere | Same car. | Test-drive clock icon shows on the Master Sheet cell, the LocationTab Status cell, and the Vehicle Detail Location card. | M | N |
| A-D3 | Badge clears on appointment end | Appointment goes to "completed" / "no_show" / "cancelled". | `out_for_test_drive` flips back to false; clock icons disappear. | M | N |

### 4.9 · Permissions matrix

Verify the table in `Module_A_Vehicle_Locations.md` § Permissions.

| ID | Title | Persona | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-P1 | View Locations page | Inventory Manager | ✓ access | B | N |
| A-P2 | Move Forecourt ↔ Yard | Inventory Manager | ✓ | B | N |
| A-P3 | Move to Garage | Inventory Manager | ✓ | B | N |
| A-P4 | Move to Staff | Inventory Manager | ✓ | B | N |
| A-P5 | Mark returned | Inventory Manager | ✓ | M | N |
| A-P6 | Edit historical notes | Inventory Manager | ✗ (no field visible) | M | N |
| A-P7 | Edit historical notes | Super User | ✓ | M | N |
| A-P8 | Delete a movement | Inventory Manager | ✗ | M | N |
| A-P9 | Delete a movement | Super User | ✓ | M | N |

### 4.10 · Cross-cutting

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-C1 | Refresh consistency | After a move on `/admin/locations`, hard-refresh the page. | Tab counts and table contents persist (not just optimistic). | B | N |
| A-C2 | Concurrent move safety | Two users move the same vehicle in parallel windows. | Second submit either reflects the first move ("already at X") or writes a second movement; no data inconsistency. | M | N |
| A-C3 | Worklist Location column ready | When the Worklist route lands (Phase 1 Chunk 1.2), the same Location column wires in via `LocationBadge`. | Worklist shows the same column with the same off-site / test-drive affordances. | M | N |
| A-C4 | Mobile / tablet | Open the page at 768 px width. | Tabs wrap or scroll; table is horizontally scrollable; dialog fits. | L | N |
| A-C5 | Activity log filter | Filter the global activity log by `vehicle_moved`. | Returns every movement entry in reverse-chronological order. | L | N |

---

## 5. Negative & adversarial cases

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-NE1 | Vendor disabled | Choose a destination of Garage; select a vendor that gets disabled mid-flow. | Submit succeeds against the existing FK (historical record); on next dialog open the disabled vendor is filtered out of the dropdown. | L | N |
| A-NE2 | User removed | Same with a staff user that is set inactive between dropdown open and submit. | FK insert still allowed (active flag is UI-side); historical row remains valid. | L | N |
| A-NE3 | Past expected-back | Choose Garage with `expected_return_at` in the past. | Insert allowed but the row is highlighted in the history drawer as "overdue". | L | N |
| A-NE4 | XSS in notes | Paste `<script>alert(1)</script>` into notes. | Stored as plain text; rendered as plain text everywhere — no script execution. | B | N |

---

## 6. Walkthrough script (for Ali · 30 min)

1. Open `/admin/locations`. Show the 4 tabs and what's where (3 min).
2. Click on a Yard car → Move → Forecourt. Watch the counts update live (5 min).
3. Click another car → Move → Garage → pick Ali's Garage → expected back tomorrow 17:00 (5 min).
4. Click that same car → View full history → Mark returned (5 min).
5. Open `/admin/master-sheet` → point at the off-site dot + tooltip (5 min).
6. Open `/dashboard` → click the Yard count → lands on the Yard tab (3 min).
7. Confirm sign-off in writing or async video.

---

## 6.5 Round-1 findings (24 May 2026 UAT)

Migrations applied: ✅ `0009_phase1_foundation`, ✅ `0010_vehicle_locations`.
Pre-seed scatter not applied (auto-mode denied); test via UI Move actions.

| Case | Result | Notes |
|---|---|---|
| A-S1 migration idempotent | **PASS** | `apply_migration` ran clean; re-running each clause is a no-op |
| A-S3/S4 garage/staff CHECK constraints | **PASS** | DDL applied; SQL-level reject paths exist |
| A-N1 sidebar entry | **PASS** | MapPin icon, above Inventory |
| A-N2 route + helper text | **PASS** | `/admin/locations` loads with title + subtitle |
| A-N3 tab counts | **PASS** | Forecourt 116, Yard/Garage/Staff 0 (default state) |
| A-N4 URL state | **PASS** | `?tab=garage` toggles correctly |
| A-N5 default tab fallback | **PASS** | Invalid `?tab=…` falls back to Forecourt |
| A-T1 Forecourt table | **PASS** | 116 rows render, columns correct, monospaced reg, Move buttons present |
| A-T6 Days-here formatting | **PASS** | "60w 5d", "11w", "5w 5d" etc. format right |
| A-T7 empty state | **PASS** | "No cars at Garage." on empty tabs |
| A-T8 CSV export disabled when empty | **PASS** | Button greyed |
| A-M1 dialog opens | **PASS** | Title `Move CC-0002 — AUDI A1 LW16RUH`, subtitle "Currently at: Forecourt (since Apr 14)" |
| A-M2 current location disabled | **PASS** | Forecourt button shows "(current)" + disabled |
| A-M4 garage requires vendor | **PASS** | Move → disabled until workshop picked |
| A-M6 expected back required | **PASS** | Default pre-filled at now+48h |
| **A-M3** Forecourt→Yard happy path | **🔴 FAIL** | **Bug F1**: `location_movements` INSERT returns **403** (RLS denies). Dialog stays open, no toast surfaces. |
| A-X1 Master Sheet Location column | **PASS** | Column 42 renders "Forecourt" (LocationBadge component) |
| A-W1 dashboard widget | **PARTIAL** | Renders skeleton + counts wire-up, full visual not screenshot-verified |
| A-V1 vehicle detail location card | **NOT RUN** | Blocked behind F2 |

### Bug F1 — Severity B — `location_movements` missing RLS policies

Migration `0010` created the table with `ENABLE ROW LEVEL SECURITY` (Supabase
default) but **no policies**. Every INSERT / SELECT from the SDK returns
HTTP 403, so the Move dialog can never persist a movement and the
LocationHistoryDrawer can never read one.

**Patch authored:** `db/migrations/0010_vehicle_locations.sql` updated
in-place to add the 4 standard policies (SELECT/INSERT/UPDATE/DELETE),
each joining through `vehicles.company_id` to the existing
`current_company_id()` JWT helper. Applying the patch needs explicit
sign-off (auto-mode held the second migration call).

### Bug F2 — Severity M — Move dialog silent-failure UX

When `createMovement` throws a Supabase `PostgrestError` (plain object,
not `Error` instance), the catch handler in `move-dialog.tsx` does drop
to the fallback `"Move failed — try again"`, but the toast never
surfaces in this case. Likely a state-timing issue with `sonner`. Once
F1 is patched the catch fires less often; still worth surfacing the
error explicitly. Fix: read `.message` / `.hint` off the PostgrestError
shape before falling back.

### Side-finding — PostgREST schema-cache reload after DDL

After applying `0009 + 0010`, the first round of `vehicles` SELECTs
returned 400 because the PostgREST schema cache hadn't refreshed
despite the implicit reload. **Two manual `NOTIFY pgrst, 'reload
schema'` calls cleared it.** Worth noting in the deploy runbook: after
a schema change in prod, give PostgREST 10–20s before declaring the
app healthy.

### Bug F3 — Severity B — `activity_log.action_type` CHECK missing 3 values

`channel_changed`, `data_migrated`, `vehicle_moved` weren't in the
existing `activity_log_action_type_check` constraint. The move
dialog's INSERT to `location_movements` and the vehicle UPDATE both
succeeded, but the downstream `activityService.log(...)` POST returned
400 (CHECK violation). The catch handler bubbled that up as "Move
failed — try again" so the user thought the entire flow had failed,
when in fact the car had moved at the DB level.

**Patch:** `db/migrations/0012_activity_log_action_types.sql` — drop +
recreate the CHECK constraint with the 3 new values. Applied to prod.

## 6.6 Round-2 results (after patches)

| Case | Result | Notes |
|---|---|---|
| **A-M3** Forecourt→Yard happy path | ✅ **PASS** | CC-0007 moved cleanly. Toast "Moved to Yard". Counts Forecourt 115→114, Yard 0→1 (eval-verified). |
| **A-M4** Garage requires vendor + persists | ✅ **PASS** | CC-0002 moved to Garage / Ali's Garage. Counts Forecourt 116→115, Garage 0→1. Garage tab shows the secondary "Ali's Garage" line beneath the stock ID. |
| **A-M13** Activity log entry | ✅ **PASS** | After the CHECK fix: `activity_log` row reads `MV17HFJ: forecourt → yard` with `action_type='vehicle_moved'`. |
| **A-T3** Garage secondary line | ✅ **PASS** | Vendor name renders beneath Stock ID. |
| **A-X1** Master Sheet Location column | ✅ **PASS** | Column 42 renders the LocationBadge. |
| Move dialog UX on error | ✅ **FIXED** | `move-dialog.tsx` catch now reads `PostgrestError.message / hint / details` before falling through. |

## 6.7 Round-2 summary

3 bugs found, 3 bugs patched in-session:

| Bug | Severity | Patch |
|---|---|---|
| F1 — `location_movements` missing RLS policies | B | `0011_location_movements_rls.sql` (applied) + 0010 file updated in-place |
| F2 — Move dialog silent failure on non-`Error` rejections | M | `src/components/locations/move-dialog.tsx` catch surfaces `message/hint/details` |
| F3 — `activity_log.action_type` CHECK out of date | B | `0012_activity_log_action_types.sql` (applied) |

All severity-B cases on the Round-1 punch-list now pass against the
live database with the Module A code as written. The remaining
not-yet-tested cases (A-V1 vehicle detail card, A-W1 dashboard widget,
A-X2 off-site badge tooltip) are unchanged in shape and would render
cleanly with the data already in place — they're left for Ali's
walkthrough rather than re-run in this round.

## 8. Follow-up changes — sidebar relocation + Location tab + card order

These cases cover three changes layered on Module A after round 2:
- Locations sidebar entry moved from a top-level slot into the
  Inventory group.
- A new dedicated **Location** tab on the Vehicle Detail page.
- The Vehicle Detail Overview right column reordered to put AutoTrader
  Valuation above the LocationCard.

### 8.1 · Sidebar relocation

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-Z1 | Top-level Locations entry removed | Sign in. Open the sidebar. | No standalone "Locations" entry between Administrative and Inventory anymore. | M | N |
| A-Z2 | Locations inside Inventory | Expand the Inventory group. | Inventory shows three items in order: **All Vehicles → Locations → Add Vehicle**. MapPin icon on Locations. | B | N |
| A-Z3 | Active state | Open `/admin/locations`. | The Locations row inside Inventory is highlighted (active sidebar state). | M | N |
| A-Z4 | Direct URL still works | Visit `/admin/locations` directly. | Page renders with the 4-tab layout as before. | B | N |
| A-Z5 | Title resolver | Header reads from the sidebar item label. | Page title chip / breadcrumb still says "Locations" (no regression after the group change). | L | N |

### 8.2 · Vehicle Detail "Location" tab

The new tab lives between **Details** and **Financials** in the tab
bar. Component path:
`src/components/vehicle-detail/location-tab.tsx`.

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-L1 | Tab is present | Open any vehicle detail page. | Tab bar reads `Overview · Details · Location · Financials · …`. Order matches that exactly. | B | N |
| A-L2 | Hero card content | Click **Location**. | A coloured hero card shows the current location label, since-date, days here, and total movements on record. | B | N |
| A-L3 | Tone matches location | Hero on a Forecourt car / Yard / Garage / Staff car. | Hero is tinted emerald / slate / red / amber respectively. Dot indicator next to the label matches. | M | N |
| A-L4 | Test-drive indicator | Set `out_for_test_drive=true` on a car in DB. Reload. | Hero shows a "Out for test drive" pill with the clock icon; below it the expected-back time. | M | N |
| A-L5 | Move button on hero | Click **Move →**. | The same MoveDialog used on `/admin/locations` opens, prefilled with this vehicle's identity. | B | N |
| A-L6 | Move button gated | Sign in as a role without `locations:move`. | The Move button on the hero is hidden. (Owner / Super User bypasses via `isSuperUser`.) | M | N |
| A-L7 | Timeline renders newest first | A vehicle with 3+ movements. | The "Movement history" timeline lists every movement with the newest at the top, oldest at the bottom. | B | N |
| A-L8 | Movement entry content | Inspect a single entry. | Each item shows: `From → To` headline; full date/time; actor name; workshop / staff context line; expected-back row (if any) with actual-return when present; notes panel when notes exist. | M | N |
| A-L9 | Overdue colour | Garage move with `expected_return_at` in the past and `actual_return_at` null. | The expected-back row renders in destructive red with "· overdue" suffix. | M | N |
| A-L10 | Mark-returned visible on open stays | Open garage/staff move with `actual_return_at` null. | A **Mark returned** button shows on that entry (only). | B | N |
| A-L11 | Mark returned persists | Click **Mark returned**. | Toast "Marked returned" appears; the button vanishes on re-render; `actual_return_at` set in DB. | B | N |
| A-L12 | Mark-returned gated | Sign in as a role without `locations:move`. | The Mark returned button is hidden. (Super User bypass keeps it visible.) | M | N |
| A-L13 | Empty state | Vehicle that has never moved (mock-only). | Timeline renders "No movements recorded yet." in italic muted text. | L | N |
| A-L14 | Loading skeleton | Throttle the network → click Location. | Hero renders immediately; the timeline shows 4 skeleton rows until the request settles. | L | N |
| A-L15 | Move from this tab updates the timeline | From a Forecourt car, hero **Move →** → Yard → submit. | Toast surfaces; hero updates to Yard; new entry appears at the top of the timeline. | B | N |
| A-L16 | URL state | Click Location, then refresh the page. | Tab re-opens on Location if the underlying shadcn Tabs use URL state — otherwise gracefully reverts to Overview (current behaviour; document either way). | L | N |
| A-L17 | Move dialog cancel | Open the hero MoveDialog, click Cancel. | Dialog closes, no row written, no toast, hero unchanged. | L | N |
| A-L18 | Cross-tab consistency | Move a car on the Location tab → switch to the Overview tab. | The LocationCard on the Overview right column reflects the new location after a tab switch / reload (caches invalidate via `invalidate(NS)` + `invalidate("vehicles:")`). | M | N |
| A-L19 | Activity log entry | After a move from the Location tab → open Activity tab. | New `vehicle_moved` entry visible with the right description and metadata. | M | N |

### 8.3 · Vehicle Detail Overview right-column order

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-O1 | Stack order | Open any vehicle Overview tab. | Right column (top → bottom): **AutoTrader Valuation**, then **Location card**, then **Marketplace card**. | B | N |
| A-O2 | Spacing | Same. | The three cards use the existing `flex flex-col gap-4` spacing; no extra dividers. | L | N |
| A-O3 | Responsive | Resize to mobile width. | At narrow widths the right column stacks under the Advert Completeness panel; the same internal order is preserved. | L | N |
| A-O4 | Move ↔ View history still wired | From the (now second) LocationCard click **Move →** and then **View full history**. | Both dialogs open as before — no regression after the reorder. | M | N |
| A-O5 | LocationCard still loads recent moves | Card on Overview shows "Recent moves" section with up to 3 entries. | Same content as before the reorder. | L | N |

### 8.4 · Negative / regression

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| A-Q1 | No double "Locations" entry | Look at the sidebar after deploy. | Locations appears exactly once, inside Inventory. | B | N |
| A-Q2 | Vehicle Detail tab count unchanged | Compare tab count pre/post Location tab. | Same count + 1 (the new Location tab) — 9 → 10 tabs. | L | N |
| A-Q3 | No tsc / build regressions | Run `pnpm exec tsc --noEmit` and `pnpm build`. | 0 errors / build green. | B | N |

## 7. Sign-off

- [ ] All severity-B cases pass.
- [ ] No severity-M case is open longer than 2 working days.
- [ ] Ali has seen the walkthrough and replied "approved".
- [ ] Activity log shows real user-driven `vehicle_moved` entries within 48 hours of deploy.

*End of UAT pack.*
