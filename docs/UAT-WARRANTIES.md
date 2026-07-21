# UAT — Warranty Module

**Module:** Warranties
**Version under test:** post-dialog-phase (commit SHA: _________________)
**Tester:** _________________
**Date:** _________________
**Sign-off:** ☐ Pass · ☐ Pass with notes · ☐ Fail

---

## How to run UAT

1. Sign in as **Abbas Bhai** (`abbas@carcapital.uk` / `CarCap!demo1`). He's the super-user so every capability gate passes by default. For permission-gating cases (UAT-W-23) you'll switch to a non-admin user.
2. Ensure the demo seed has the **delta** rows applied — there should be **9 in-house** warranties, **5 external** (3 pending, 2 purchased), and **4 claims**. If not, run `npx tsx --env-file=.env.local scripts/seed.ts` (it's idempotent for the warranty delta).
3. For each numbered case below: follow the steps, compare to the expected result, tick **Pass** or **Fail**. Add a note for anything fishy even if you ticked Pass.
4. If a case fails, file a ticket referencing the case ID (`UAT-W-NN`) so the engineer can reproduce.

---

## UAT-W-01 — Sidebar shows three warranty items with live badges

**Precondition:** Logged in. WARRANTIES section in the sidebar.

**Steps:**
1. Open the app sidebar.
2. Expand the **WARRANTIES** group if collapsed.

**Expected:**
- Three items visible: **In-House**, **External**, **Claims** (in that order).
- In-House badge shows total count (e.g. `9`).
- External badge is **amber** when any external warranties are pending (e.g. `3`), neutral grey otherwise.
- Claims badge is **red** when any claims are open (e.g. `1`), neutral grey otherwise.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-02 — Old `/warranties` redirects to `/warranties/in-house`

**Steps:**
1. In the address bar, navigate to `/warranties`.

**Expected:**
- URL changes to `/warranties/in-house` immediately (no flash of broken content).
- In-House view renders.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-03 — KPI strip renders four cards with live counts

**Steps:**
1. Open `/warranties/in-house`.
2. Inspect the KPI strip beneath the page header.

**Expected:** Four cards visible, in order:
- **Active warranties** — total active across both types (e.g. `7 — 5 in-house · 2 external`).
- **Pending purchase** — count of external warranties needing purchase.
- **Open claims** — count of open + under-review claims.
- **Expiring soon** — count of active warranties whose `end_date` is within 30 days.
- All four show real numbers; no spinners after 1 second.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-04 — Pending Purchase card switches to amber accent when count > 0

**Steps:**
1. Open `/warranties/external` (the seed has 3 pending purchases).
2. Inspect the **Pending purchase** KPI card.

**Expected:**
- Card has an **amber-tinted border + background**.
- Subtext reads `Action needed`.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-05 — Open Claims card switches to destructive accent when count > 0

**Steps:**
1. Open any warranty view.
2. Inspect the **Open claims** KPI card.

**Expected:**
- Card has a **destructive-tinted border + background**.
- Subtext reads `Awaiting resolution`.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-06 — New Warranty dialog on In-House: type preselected, provider hidden

**Steps:**
1. On `/warranties/in-house`, click **New warranty** in the page header.
2. Observe the **Type selector** at the top of the dialog.

**Expected:**
- Two cards visible: **In-house** (selected/highlighted) and **External**.
- **Provider** section is NOT rendered.
- **Cost to dealership** field is NOT rendered (only Cost to customer).

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-07 — Vehicle picker filters to ready/listed/sold only

**Steps:**
1. In the open New Warranty dialog, click the vehicle picker (`Pick a vehicle in stock`).
2. Browse the list.

**Expected:**
- All vehicles shown have status `ready`, `listed`, or `sold`.
- Vehicles in `inspection_pending`, `being_prepared`, `returned` etc. do **not** appear.
- Search field at the top filters by registration, make, or model.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-08 — Coverage duration auto-calculates end date

**Steps:**
1. In the dialog, set **Duration** to `12 months`.
2. Observe the **End date** field.
3. Now change Duration to `3 months`.

**Expected:**
- End date auto-updates to start date + 12 months on first change.
- End date auto-updates again when duration changes to 3 months.
- Manually editing End date is still allowed (doesn't revert).

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-09 — Submitting in-house warranty creates the row

**Steps:**
1. Fill in: vehicle (any in-stock), customer name `UAT Test Customer`, phone `07700999001`, duration 3 months, coverage details (any text), cost to customer `0`.
2. Click **Create warranty**.

**Expected:**
- Dialog closes.
- Toast `Warranty for UAT Test Customer created`.
- New row appears in the In-House table within ~2 seconds.
- Sidebar **In-House** badge increments by 1.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-10 — External dialog: type preselected external, provider section shown

**Steps:**
1. On `/warranties/external`, click **New warranty**.

**Expected:**
- Type selector shows **External** highlighted.
- **Provider** section is rendered with the Provider Select + Provider reference input.
- **Cost to dealership** field is rendered alongside Cost to customer.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-11 — New external warranty defaults to purchase_status = pending

**Steps:**
1. From the external view, create a new warranty: any in-stock vehicle, customer `UAT External Test`, provider `Warranty First`, duration 12 months, cost to dealership `200`, cost to customer `300`.

**Expected:**
- Row appears in the External table.
- Purchase column on the row shows **Pending purchase** (amber).
- Pending Purchase KPI count increments by 1.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-12 — Pending Purchase banner shows count, total owed, overdue tally

**Steps:**
1. Open `/warranties/external`.
2. Look at the banner above the table.

**Expected:**
- Banner shows e.g. `3 external warranties pending purchase`.
- Subtext shows the total owed in £ (sum of `costToDealership` for pending rows).
- If any pending row was created 60+ days ago, the banner is destructive-styled and shows `N overdue 60+ days`.
- The seed should include exactly **1** overdue pending warranty (Tom Williams, ~75 days old).

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-13 — "View pending only" filters and hides banner button

**Steps:**
1. From `/warranties/external` with banner visible, click **View pending only**.

**Expected:**
- Filter chip `Pending purchase` becomes active.
- URL query becomes `?filter=pending`.
- The banner button disappears (banner remains visible with summary).
- Table now shows only pending-status warranties.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-14 — Mark Purchased button visible only on pending rows

**Steps:**
1. Look at the rightmost column for each row in `/warranties/external`.

**Expected:**
- Pending rows show a prominent primary **Mark purchased** button.
- Purchased rows show a `…` overflow menu instead (no Mark purchased button visible).

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-15 — Mark Purchased dialog pre-fills cost and date

**Steps:**
1. Click **Mark purchased** on a pending row.

**Expected:**
- Dialog opens with title `Mark warranty as purchased`.
- **Purchase date** defaults to today.
- **Paid by** defaults to the currently logged-in user.
- **Amount paid** defaults to the warranty's existing `costToDealership`.
- **Provider reference** is empty by default (or pre-filled if already set).

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-16 — Marking purchased flips status + updates KPI + logs activity

**Steps:**
1. In the Mark Purchased dialog, set provider reference `UAT-REF-001`, click **Mark purchased**.
2. Confirm the toast.
3. Look at the row in the table.
4. Look at the Pending Purchase KPI count.
5. Navigate to `/admin/activity` (Admin → Activity Log).

**Expected:**
- Toast `Warranty marked as purchased`.
- Row's Purchase pill flips from **Pending** to **Purchased**.
- Pending Purchase KPI count decrements by 1.
- Activity log shows a new `warranty_created` (event metadata says `warranty_purchased`) entry referencing the customer and reference.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-17 — Claims view: filter defaults to Open; complaints filter tints rows red

**Steps:**
1. Open `/warranties/claims`.
2. Note the active filter chip.
3. Click the **Complaints** chip.

**Expected:**
- Default active chip is **Open** (showing open + under-review claims).
- Switching to Complaints shows only rows where `isComplaint = true`.
- Complaint rows have a subtle destructive-tinted background.
- The "Complaint" tag appears under the customer name on each tinted row.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-18 — File Claim dialog: warranty picker filters to active warranties only

**Steps:**
1. On `/warranties/claims`, click **File claim**.
2. Click the warranty picker.

**Expected:**
- List shows only warranties with `status = active`.
- Cancelled and expired warranties do not appear.
- Search filters by customer name or provider.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-19 — Flagging a claim as complaint tints the row red

**Steps:**
1. In the open File Claim dialog, pick a warranty.
2. Fill in issue description `UAT complaint test`.
3. Toggle **Flag as customer complaint** on.
4. Click **File claim**.

**Expected:**
- Toast `Claim filed`.
- New row appears in the Claims table with a red-tinted background and the "Complaint" tag visible.
- Clicking the row opens the WarrantyDetailSheet for the parent warranty.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-20 — Submitting a claim flips parent warranty to "claimed" if previously "active"

**Steps:**
1. Note the status of the parent warranty before filing.
2. File a claim against an active warranty (use UAT-W-19's claim).
3. Refresh `/warranties/in-house` (or external, depending on the parent type).
4. Find that warranty's row.

**Expected:**
- Parent warranty's status was `active` before; the underlying DB row's `status` is now `claimed` (verify in Supabase SQL editor if you can — UI v4.1 derives the "claimed" badge from the open claim, not the row's literal status).
- The In-House/External table row may visually still show "active" — that's per v4.1 spec; the claim list is the source of truth for "currently being claimed against".

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-21 — Detail Sheet: row click opens right-side drawer with all sections

**Steps:**
1. From `/warranties/in-house` (or external), click any table row body (not the action menu).

**Expected:**
- A right-side Sheet slides in (~480px wide).
- Header shows the warranty type, customer name, status pill, close button.
- Sections visible (top to bottom): Vehicle, Customer, Coverage, Pricing, Purchase status (external only), Claims, Footer actions.
- Footer has **File claim** and **Cancel warranty** buttons.
- Pressing Esc or clicking outside the sheet closes it.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-22 — Detail Sheet: Cancel warranty triggers AlertDialog, flips status, logs

**Steps:**
1. Open a Detail Sheet for any active warranty.
2. Click **Cancel warranty** in the footer.
3. Type a reason e.g. `UAT cancellation test`.
4. Click **Cancel warranty** in the confirmation.

**Expected:**
- A second Dialog opens asking for confirmation, with a reason textarea.
- After confirming, toast `Warranty cancelled`.
- The Sheet closes.
- The row's Status pill in the table flips to **Cancelled** (greyed out).
- The Activity Log records the cancellation with the reason.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-23 — Cancel + Mark Purchased disabled for users without `warranty:edit`

**Precondition:** Sign in as a user who does NOT have `warranty:edit` capability — e.g. **Raza** (`raza@carcapital.uk`), who's a driver in the seed.

**Steps:**
1. Open `/warranties/external`.
2. Hover the **Mark purchased** button on a pending row.
3. Open a Detail Sheet for any active warranty.
4. Inspect the **Cancel warranty** footer button.

**Expected:**
- Mark purchased button is **disabled** (greyed out, not clickable).
- Tooltip on hover: `Requires Warranty Edit capability`.
- Cancel warranty button in the sheet footer is also **disabled** with the same tooltip.
- File claim button remains enabled.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-24 — Filter chips + search sync to URL (bookmarkable)

**Steps:**
1. Open `/warranties/external`.
2. Set filter to **Pending**.
3. Type `mary` in the search box.
4. Copy the URL.
5. Open it in a new tab.

**Expected:**
- URL contains `?filter=pending&q=mary`.
- New tab loads with the same filter active and search box pre-filled.
- Reloading the page preserves both.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## UAT-W-25 — Realtime: two-browser test

**Precondition:** Two browser windows side-by-side, both signed in as Abbas.

**Steps:**
1. Window A: open `/warranties/external`.
2. Window B: open `/warranties/external`.
3. In Window A, mark a pending warranty as purchased.
4. Without refreshing Window B, watch its table.

**Expected:**
- Within ~2 seconds, Window B's row reflects the new **Purchased** status.
- Window B's Pending Purchase KPI count decrements.
- No manual refresh is needed.

**Pass:** ☐  **Fail:** ☐  **Notes:** ____________________________________________

---

## GEN-66 — a warranty is created when a sales invoice is closed

Closing a sales invoice declares the buyer's cover in Section F, but until
GEN-66 nothing wrote a `warranties` row — selecting "in-house" produced a PDF
and nothing else, so the In-House tab was only ever populated by hand.

Scope: `/sales/invoice-generation` Section F, `warrantyService.syncFromInvoice`,
migration `0036_warranty_invoice_link.sql`.

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| 26 | In-house creates a record | Generate a sales invoice with **Warranty provided by = Car Capital (in-house)** | A warranty appears under **Warranties → In-House** for that vehicle and customer. | ☐ |
| 27 | Record contents | Open it | Type in-house, provider "Car Capital", cover summary matching Section F, start = invoice date, end = start + the declared duration. | ☐ |
| 28 | Linked to the invoice | On the detail sheet | "Issued by invoice INV-…" links back to it. | ☐ |
| 29 | External still works | Generate an invoice with **External provider** + a provider name | A record appears under **External**, purchase status **Pending**, so Mark Purchased still applies. | ☐ |
| 30 | Provider required | Choose External and leave the provider name blank | Blocked: "Provider name is required for an external warranty". | ☐ |
| 31 | No over-trigger | Generate an invoice with **Non-Warranty Disclaimer** ticked | No warranty record is created. Section F says so before you submit. | ☐ |
| 32 | No duplicates on re-save | Edit and re-save the same invoice | The existing warranty is updated. There is still exactly one. | ☐ |
| 33 | Retracted on edit | Edit an invoice that issued cover, tick the disclaimer, save | Its warranty is **cancelled**, not left live behind an invoice that no longer offers it. | ☐ |
| 34 | Type switch | Edit an in-house invoice to external and save | The record moves to the External tab and its purchase status becomes Pending. An already-purchased policy keeps "purchased". | ☐ |
| 35 | Price carried over | Invoice with a paid Warranty add-on line | Cost to customer equals the add-on total. A free warranty add-on records £0. | ☐ |
| 36 | Month clamping | Invoice dated 31 Jan with 3-month cover | Ends **30 Apr**, not 1 May. | ☐ |

---

## Sign-off

| Field | Value |
|---|---|
| Tester | _________________________ |
| Date | _________________________ |
| Total cases | 36 |
| Passed | ___ / 36 |
| Failed | ___ / 36 |
| Commit SHA tested | _________________________ |
| Notes / outstanding items | _________________________ |

**Module status:**
- ☐ Approved — ready for production rollout
- ☐ Approved with follow-ups (listed in notes)
- ☐ Rejected — return to dev
