# UAT — Modules C (Lead Channel) + D (External Invoicing) + E (UI Cleanup)

**Spec:** `Module_C_Lead_Channel.md`, `Module_D_External_Invoicing.md`,
`Module_E_UI_Cleanup.md` (Spec v3.0 · Phase 3 / 4 · 24 May 2026)
**Migration anchors:**
- `db/migrations/0013_lead_channels_canonical_seed.sql`
- `db/migrations/0014_lead_channels_rls.sql`
- `db/migrations/0015_external_invoices.sql`
- `db/migrations/0016_vendors_unique_name_per_company.sql` (F-D4 fix)

**Status:** Draft · ready for Ali walkthrough on Wednesday catch-up
**Author:** Claude · 2026-05-26

---

## 1. Scope

| In | Out |
|---|---|
| 9 canonical lead channels with hex colours | Per-company custom channels (Phase 2+) |
| ChannelDropdown on Create Lead + ChannelChip on row | Channel-level analytics dashboard |
| External invoices: auction-purchase + external-job kinds | Tax-period roll-ups (V2) |
| Generated `pre_vat_pence` column + 4 CHECK constraints | Per-line items (D2 spec was flat-amount) |
| 4 RLS policies on `external_invoices` via vehicles.company_id | Vendor balance ledger (V2) |
| Supabase Storage bucket `external-invoices` (10 MB, JPG/PNG/PDF) | Multi-attachment per invoice (V2) |
| 4 storage RLS policies (folder prefix = companyId) | Email-to-invoice ingestion |
| 3 new caps (create / edit_any / delete) + role grants | Approval workflow (V2) |
| ExternalInvoiceForm with vendor + vehicle pickers + inline vendor add | Bulk import |
| ExternalInvoiceList with search + vendor filter | Soft-delete + restore |
| Three-tab invoicing page (Sales / Purchase / External Job) | Refactor of legacy "Sales" tab |
| Per-vehicle section on Financials tab | Auto-populate from vehicle PDF receipts |
| 301 redirect `/admin/inventory/listings` → `/vehicles` | Wider sidebar IA overhaul |
| `PageHelper` italic clarifier line | New typography scale |
| Sticky filter + pagination layout primitives | Full-table virtualisation |

---

## 2. Pre-requisites

1. Migrations `0013`, `0014`, `0015` applied to the target database
   (idempotent — re-run prints zero errors). Confirmed live on prod
   project `tbhtdurpvysfuqzfvaol` ("Carcapital").
2. Storage bucket `external-invoices` exists with 10 MB limit + allowed
   MIME of `image/jpeg`, `image/png`, `application/pdf`, plus 4 RLS
   policies on `storage.objects` scoped by company folder prefix.
3. `activity_log_action_type_check` includes the three new action types
   `external_invoice_created`, `external_invoice_updated`,
   `external_invoice_deleted`, plus `channel_changed`.
4. At least 1 vehicle and 1 vendor seeded per company under test.
5. Tester accounts available with all four personas:
   - **Owner / Super User** (bypasses all caps)
   - **Administrator** (has all three `external_invoice:*` caps)
   - **Inventory Manager** (has `external_invoice:create` only)
   - **Sales Manager** (has no `external_invoice:*` caps — for negative tests)

---

## 3. Test environment

| Setting | Value |
|---|---|
| URL | `http://localhost:3000` (dev) / production after Phase 4 deploy |
| Browser | Chrome ≥ 124, Safari ≥ 17, Firefox ≥ 125 — both desktop (≥ 1280 px) and tablet (768 – 1024 px) |
| Default tab on `/admin/invoicing` | Sales |

---

## 4. Test cases

> Severity codes — **B** = blocker (must fix before launch);
> **M** = major (should fix); **L** = polish.
> Status codes — **P** = pass · **F** = fail · **N** = not run.

### 4.1 · Schema + service layer (Module C)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| C-S1 | Migration 0013 idempotent | Run `apply_migration` twice. | First run reseeds 9 canonical channels with hex colours; second run prints zero errors and changes nothing. | B | P (verified live) |
| C-S2 | Migration 0014 idempotent | Run twice. | First run adds 4 RLS policies on `lead_channels`; second is a no-op via `IF NOT EXISTS`. | B | P (verified live) |
| C-S3 | 9 canonical channels seeded | `SELECT count(*) FROM lead_channels WHERE company_id = $1`. | Returns 9. Slugs match: `walk_in / phone / website / autotrader / facebook / instagram / ebay / referral / other`. | B | P (verified live) |
| C-S4 | Hex colour on every row | `SELECT colour_hex FROM lead_channels`. | All 9 rows have a non-null 7-char hex string. | B | P |
| C-S5 | RLS allows read for in-company auth user | Sign in as Inventory Manager → query `lead_channels`. | Returns the 9 channels (was the F4 bug fix). | B | P (verified live) |
| C-S6 | Cross-company RLS isolation | Authenticate as Company B user → query Company A's channels. | Returns empty (RLS scopes by `current_company_id()`). | B | N |

### 4.2 · Lead Channel UI (Module C)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| C-U1 | ChannelDropdown shows 9 options | Open Create Lead form. | The "Channel" `<Select>` lists all 9 canonical channels with their colour swatch. | B | P (verified live) |
| C-U2 | Submit Create Lead with channel | Fill the form including a channel, submit. | Lead row written with `lead_channel_id = <picked>`. Toast "Lead created". | B | P (verified live) |
| C-U3 | ChannelChip on lead row | Open `/sales/leads`. | Each lead row shows a ChannelChip with the channel label + colour. | M | P (verified live) |
| C-U4 | Channel filter on leads page | Apply a channel filter. | List narrows to leads with that channel. | M | N |
| C-U5 | Inactive channel still labels old leads | Toggle a channel `enabled = false`. | Existing leads keep their label + chip (the chip uses the row's `lead_channel_id`, not enabled state). | L | N |

### 4.3 · Schema + service layer (Module D)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| D-S1 | Migration 0015 idempotent | Run twice. | First run creates table + 4 CHECK + 4 RLS + storage bucket + 4 storage policies + 3 new activity action types; second run is a no-op. | B | P (verified live) |
| D-S2 | All 4 CHECKs present | `SELECT conname FROM pg_constraint WHERE conrelid='external_invoices'::regclass AND contype='c'`. | Returns 4 names: `external_invoices_kind_check`, `external_invoices_total_nonneg`, `external_invoices_vat_nonneg`, `external_invoices_vat_within_total`. | B | P (verified live) |
| D-S3 | `kind` rejects bad value | `INSERT … invoice_kind = 'bogus_kind'`. | `check_violation` raised. | B | P (verified live via DO-block probe) |
| D-S4 | Negative total rejected | `INSERT … total_pence = -100`. | `check_violation` raised. | B | P (verified live) |
| D-S5 | Negative VAT rejected | `INSERT … vat_pence = -50`. | `check_violation` raised. | B | P (verified live) |
| D-S6 | VAT > Total rejected | `INSERT … total_pence = 1000, vat_pence = 1500`. | `check_violation` raised. | B | P (verified live) |
| D-S7 | `pre_vat_pence` generated | Insert with total=120 000, vat=20 000. | Row's `pre_vat_pence = 100 000`. Attempting to set it directly raises a "cannot insert into generated column" error. | B | P (verified live · 120 000 − 20 000 = 100 000) |
| D-S8 | RLS — 4 policies | `SELECT policyname FROM pg_policies WHERE tablename='external_invoices'`. | Returns 4: select / insert / update / delete, all joining `vehicles.company_id = current_company_id()`. | B | P (verified live) |
| D-S9 | Cross-company RLS isolation | Auth as Company B → `SELECT FROM external_invoices` against a Company A row. | Returns empty. Likewise INSERT for a vehicle outside the company fails with policy violation. | B | N |
| D-S10 | Storage bucket exists | `SELECT * FROM storage.buckets WHERE id='external-invoices'`. | Returns 1 row with `file_size_limit = 10 485 760` and `allowed_mime_types` including JPG/PNG/PDF. | B | P (verified live) |
| D-S11 | Storage RLS — 4 policies | `SELECT FROM pg_policies WHERE tablename='objects' AND schemaname='storage' AND policyname LIKE '%external_invoice%'`. | Returns 4 policies (select / insert / update / delete) all scoping by `(storage.foldername(name))[1] = current_company_id()`. | B | P (verified live) |
| D-S12 | FK on vehicles cascades | Hard-delete a vehicle row with external invoices attached. | Child `external_invoices` rows are removed via `ON DELETE CASCADE`. | M | N |
| D-S13 | FK on vendors RESTRICT | Attempt to delete a vendor with at least one external invoice. | DB rejects: vendor FK is `ON DELETE RESTRICT` (or service refuses pre-flight). | M | N |
| D-S14 | activity_log CHECK extension | `SELECT pg_get_constraintdef(...)` on `activity_log_action_type_check`. | Includes all 3 new types: `external_invoice_created / _updated / _deleted`. | B | P (verified live) |

### 4.4 · Capability + role layer (Module D)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| D-C1 | Caps in union + label table | tsc passes; CAPABILITY_LABELS has entries for the 3 new caps. | tsc green; runtime `CAPABILITY_LABELS["external_invoice:create"]` returns a human label. | B | P |
| D-C2 | Administrator grant | Inspect `src/lib/roles.ts`. | Administrator role gets all 3 caps. | B | P |
| D-C3 | Inventory Manager grant | Same file. | Inventory Manager gets `external_invoice:create` only — **not** edit_any or delete. | B | P |
| D-C4 | Sales Manager grant | Same file. | Sales Manager gets none of the 3 caps. | B | P |
| D-C5 | Super User bypass | Sign in as `isSuperUser = true`. | All caps active even with no role grant. | B | N |

### 4.5 · ExternalInvoiceForm (Module D.4)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| D-F1 | Open from list "+ New invoice" | On `/admin/invoicing` → Purchase tab, click **New invoice**. | Dialog opens. Title shows the kind label. Vendor + Vehicle pickers populated. | B | N |
| D-F2 | Kind toggle | Toggle between Auction Purchase / External Job. | Dialog title updates; the selection persists when submitting. | M | N |
| D-F3 | Vendor picker | Click vendor `<Select>`. | Shows the company's vendors alphabetically. Search filters as you type. | B | N |
| D-F4 | Vehicle picker | Click vehicle `<Select>`. | Shows the company's vehicles; each row reads "STOCK_ID · REG · MAKE MODEL". | B | N |
| D-F5 | Pre-VAT computed live | Enter Total `£1 200.00`, VAT `£200.00`. | Pre-VAT field shows `£1 000.00`, read-only. | B | N |
| D-F6 | VAT-exceeds-total guard | Enter Total `£100`, VAT `£200`. | Submit disabled; "VAT can't exceed Total." inline error shows. | B | N |
| D-F7 | Pence rounding | Enter Total `£12.345`. | Stored as 1235 pence (banker's rounding to nearest). | L | N |
| D-F8 | Currency parsing | Enter Total `£1,200.50` (commas / £). | Parsed to 120 050 pence. Negative input is clamped to 0. | M | N |
| D-F9 | Required field gates submit | Leave Description blank. | Submit disabled until Description filled. | B | N |
| D-F10 | Attachment slot needs vehicle | Open form; before picking a vehicle, drop a PDF. | Toast "Pick a vehicle first — attachments are scoped to vehicles". No upload attempted. | B | N |
| D-F11 | Submit creates row | Fill all required + submit. | Row written. Toast "Invoice saved". Dialog closes. List refetches. Activity log gains `external_invoice_created`. | B | N |
| D-F12 | Edit mode prefills | Click Edit on a row. | Dialog opens with all fields filled (kind, vendor, vehicle, dates, money, description, notes, attachment metadata). | B | N |
| D-F13 | Edit submit updates row | Change Description, submit. | Row updated. Toast "Invoice updated". `external_invoice_updated` entry written. | B | N |
| D-F14 | Cancel discards | Open form, type fields, **Cancel**. | Dialog closes; nothing written. | L | N |
| D-F15 | `fixedVehicleId` locks picker | Launch from Vehicle Detail → Financials section. | Vehicle picker disabled; pre-selected vehicle is the current one. | B | N |
| D-F16 | Re-open resets | After Cancel, re-open from another vehicle. | Fields are reset (no leakage). | M | N |
| D-F17 | Submit failure surfaces toast | Force a DB error (e.g. RLS bypass attempt). | Error toast surfaces the server message; dialog stays open; nothing partially written. | B | N |

### 4.6 · Inline vendor add (Module D.6)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| D-V1 | "+ Add new vendor" button visible | Open ExternalInvoiceForm. | Button sits next to the vendor select. | B | N |
| D-V2 | Dialog renders | Click the button. | Inner dialog opens with Name (required) + Speciality + Phone. | B | N |
| D-V3 | Name required | Submit with empty name. | Toast "Vendor name is required". No insert. | B | N |
| D-V4 | Save returns vendor | Fill name "Ali's Garage" + save. | Toast "Added Ali's Garage". Outer form's vendor field auto-selects the new vendor. | B | N |
| D-V5 | Inactive speciality default | Default speciality is "general". | "general" pre-selected in the speciality `<Select>`. | M | N |
| D-V6 | Duplicate name rejected | Save "Ali's Garage", then try again as "ali's garage" (different casing). | **F-D4 fix**: client-side pre-check selects the existing vendor; if the user bypasses, the DB unique index (`vendors_unique_name_per_company`) raises 23505 and the dialog surfaces "A vendor named … already exists". | M | P (DB verified live) |
| D-V7 | Cancel discards | Open dialog, type name, Cancel. | Inner dialog closes. Outer form unchanged. | L | N |
| D-V8 | Vendor list refreshes | After Save, close outer form. Re-open. | New vendor appears in the dropdown. | M | N |

### 4.7 · Attachment uploader (Module D.7)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| D-A1 | Empty-state needs vehicle | Open form without picking a vehicle. | Slot shown but disabled with hint. | B | N |
| D-A2 | Click-to-upload PDF | Pick a 2 MB PDF. | Spinner → success → filename + size + MIME shown; X to remove. | B | N |
| D-A3 | Drag-to-upload image | Drag a 1 MB PNG onto the slot. | Same as D-A2; image icon shown instead of file. | M | N |
| D-A4 | MIME guard — bad type | Drop a `.docx`. | Toast "Unsupported file type …". No upload attempted. | B | N |
| D-A5 | Size guard — 11 MB | Pick a 11 MB PDF. | Toast "File too large …". No upload attempted. | B | N |
| D-A6 | Path format | Inspect the stored `attachment_url`. | Format: `<companyId>/<vehicleId>/<timestamp>_<sanitised>.<ext>`. | M | N |
| D-A7 | Signed-URL download | Click the attachment thumbnail in the list. | New tab opens; signed URL valid for 7 days. | B | N |
| D-A8 | Replace attachment purges orphan | Edit an invoice with a PDF attached → replace with a JPG → save. | Row points at the new path. **F-D1 fix**: old object is removed from Storage by `update()` (best-effort, swallows storage errors). | L | P (logic verified post-fix) |
| D-A9 | Delete invoice removes object | Delete an invoice with attachment. | Row gone; Storage object purged (service catches + swallows storage error so the row delete still succeeds). | M | N |
| D-A10 | Attachment-less invoice | Save without attaching. | Row written with `attachment_url IS NULL`. List shows the Paperclip placeholder. | B | N |

### 4.8 · ExternalInvoiceList (Module D.4)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| D-L1 | Table renders by kind | Switch to Purchase Invoices tab. | List shows only rows with `invoice_kind = 'auction_purchase'`. | B | N |
| D-L2 | Search filters live | Type a vendor name / reg / invoice number / description. | Rows narrow client-side. Footer count updates. | M | N |
| D-L3 | Vendor filter | Pick a vendor from the filter `<Select>`. | List narrows to that vendor; "All vendors" clears. | M | N |
| D-L4 | Attachment thumbnail (image) | Row with a PNG attachment. | Image icon button; click opens signed URL in new tab. | M | N |
| D-L5 | Attachment thumbnail (PDF) | Row with PDF. | FileText icon button. | M | N |
| D-L6 | Attachment-less row | Row without attachment. | Paperclip placeholder (no click handler). | L | N |
| D-L7 | Skeleton on load | Throttle network → reload. | 5 skeleton rows render before data arrives. | L | N |
| D-L8 | Empty state | No rows for this kind. | "No purchase invoices yet." italic muted text. | L | N |
| D-L9 | Edit gated by `:edit_any` | Inventory Manager view. | No Edit button on any row. | B | N |
| D-L10 | Delete gated by `:delete` | Inventory Manager view. | No Delete button. | B | N |
| D-L11 | New invoice gated by `:create` | Sales Manager view. | No "+ New invoice" button. | B | N |
| D-L12 | Footer count | Filter to 3 of 7 rows. | "3 of 7 invoices (filtered)". | L | N |

### 4.9 · Three-tab invoicing page (Module D.3)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| D-T1 | Three top tabs | Open `/admin/invoicing`. | Tabs in order: **Sales / Purchase Invoices / External Job Invoices**. Default is Sales. | B | N |
| D-T2 | Sales tab content | Click Sales. | Existing legacy invoice grid + filter sub-tabs + VAT summary + refunds card all show. | B | N |
| D-T3 | Purchase tab mounts list | Click Purchase Invoices. | `<ExternalInvoiceList kind="auction_purchase" />` renders. Sales-only widgets hidden. | B | N |
| D-T4 | External Job tab mounts list | Click External Job Invoices. | `<ExternalInvoiceList kind="external_job" />` renders. | B | N |
| D-T5 | Upload-Invoice button scope | Switch tabs. | "Upload Invoice" header button only shows on the Sales tab. | M | N |
| D-T6 | Header subtitle updated | Sales tab. | Reads "Sales + refunds, purchase invoices, and external-job invoices." (not the old "All purchase + sales…"). | L | N |
| D-T7 | Tab persistence after refresh | Switch to External Job, hard-refresh. | **F-D5 fix**: URL becomes `/admin/invoicing?tab=external_job`; refresh restores the same tab. Sales is the default (no `?tab=`). | M | P (logic verified post-fix) |
| D-T9 | Deep-link to a tab | Visit `/admin/invoicing?tab=purchase`. | Loads with Purchase Invoices already active. | M | N |
| D-T10 | Invalid `?tab=` falls back | Visit `/admin/invoicing?tab=banana`. | Falls back to Sales without erroring. | L | N |
| D-T8 | Filter + grid live under Sales | Apply legacy "Refunds" filter under Sales. | The legacy refunds-summary card appears (existing behaviour preserved). | M | N |

### 4.10 · Vehicle Detail Financials integration (Module D.5)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| D-X1 | Section renders | Open any vehicle → Financials tab. | Between Profit & Loss ledger and VAT Margin Scheme, an "External Invoices" Panel appears. | B | N |
| D-X2 | Grand total in header | Section has invoices. | Header right-side Pill shows the grand total (Purchase + External Job, in £). | M | N |
| D-X3 | Kind totals strip | Two columns + actions. | Left two cells show kind-level totals + counts; right cell holds the two **+ Record** buttons. | M | N |
| D-X4 | Kind chip on row | Row shows a coloured chip. | Auction Purchase = amber; External Job = indigo. | L | N |
| D-X5 | Attachment thumbnail | Row with attachment. | 9×9 button with the right icon; click opens signed URL. | M | N |
| D-X6 | Empty state | Brand-new vehicle. | "No external invoices logged for this vehicle yet." italic muted. | L | N |
| D-X7 | + Record Purchase | Click button. | ExternalInvoiceForm opens with `defaultKind='auction_purchase'` + `fixedVehicleId` locked. | B | N |
| D-X8 | + Record External Job | Same with the other kind. | Same with `defaultKind='external_job'`. | B | N |
| D-X9 | Edit from row | Click Edit. | Form opens prefilled. After save, row + totals refresh. | B | N |
| D-X10 | Delete from row | Click trash. | Native confirm → service delete → row + storage object removed; totals re-render. | B | N |
| D-X11 | Permission gate (no create) | Sales Manager view. | "Permission required to add" hint in place of buttons. | B | N |

### 4.11 · Activity log (Module D)

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| D-AL1 | Create logs event | Save a new invoice. | `activity_log` row with `action_type = external_invoice_created`, `vehicle_id` set, metadata includes `{invoiceId, kind, vendorId}`. | B | N |
| D-AL2 | Update logs event | Edit + save. | `activity_log` row with `action_type = external_invoice_updated`, metadata includes patched keys. | M | N |
| D-AL3 | Delete logs event | Delete an invoice. | `activity_log` row with `action_type = external_invoice_deleted`. | M | N |
| D-AL4 | company_id NOT NULL | Inspect the 3 rows above. | All three carry a real `company_id` (not empty string — was Bug F-D2, fixed by passing `companyId` to update + delete). | B | P (post-fix) |
| D-AL5 | Vehicle activity tab | Open vehicle's Activity tab. | The 3 events appear in the timeline with the Receipt icon + violet/amber/rose tones. | M | N |

### 4.12 · Module E — UI cleanup

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| E-U1 | Listings → /vehicles redirect | Visit `/admin/inventory/listings`. | 301 redirect to `/vehicles`. | B | N |
| E-U2 | All Vehicles helper copy | `/vehicles` page. | Subtitle reads "Every car since the business opened. Sold, unsold, returned, all of them. For historical analysis and reporting." | B | N |
| E-U3 | PageHelper italic muted | Inspect the rendered helper. | Class includes `italic text-muted-foreground`. | L | N |
| E-U4 | StickyTableLayout filter shadow | Scroll a long table. | Filter row stays at `top-0` and gains a soft shadow once the scroll passes the sentinel. | M | N |
| E-U5 | StickyTableLayout pagination | Same table. | Pagination bar sticks to `bottom-0`. | M | N |
| E-U6 | useStickyShadow `isStuck` flag | Watch the hook output. | Flips false → true once the host row leaves the top of the viewport. | L | N |

### 4.13 · Permissions matrix

Verify the table in `Module_D_External_Invoicing.md` § Permissions.

| ID | Title | Persona | Expected | Sev | Status |
|---|---|---|---|---|---|
| D-P1 | View invoicing page | Inventory Manager | ✓ access (read) | B | N |
| D-P2 | Open Form on Purchase tab | Inventory Manager | ✓ (create cap) | B | N |
| D-P3 | Edit existing invoice | Inventory Manager | ✗ (no edit_any) | B | N |
| D-P4 | Delete invoice | Inventory Manager | ✗ (no delete) | B | N |
| D-P5 | Edit existing invoice | Administrator | ✓ | B | N |
| D-P6 | Delete invoice | Administrator | ✓ | B | N |
| D-P7 | All three caps | Super User | ✓ via bypass | B | N |
| D-P8 | Create invoice | Sales Manager | ✗ (no caps) | B | N |
| D-P9 | View invoicing page | Sales Manager | ✓ (read-only) | M | N |

### 4.14 · Cross-cutting & adversarial

| ID | Title | Steps | Expected | Sev | Status |
|---|---|---|---|---|---|
| D-NE1 | Refresh consistency | After create on `/admin/invoicing`, hard-refresh. | New row persists in the list (not just optimistic state). | B | N |
| D-NE2 | Concurrent create | Two users save invoices for the same vehicle. | Both rows inserted; no constraint violations; both show in the list. | M | N |
| D-NE3 | RLS — sneak read across companies | Authenticate as Company B → `externalInvoiceService.getById(<Company A invoice id>)`. | Returns null (RLS filters). | B | N |
| D-NE4 | RLS — sneak insert | Tamper the POST to point at a Company B vehicle. | Insert rejected by RLS WITH CHECK; toast shows the error. | B | N |
| D-NE5 | Storage RLS — sneak read | Auth as Company B → request a signed URL for Company A's path. | Bucket policy denies; signed URL returns 403 on access. | B | N |
| D-NE6 | XSS in description | Paste `<script>alert(1)</script>` into Description. | Stored as plain text; rendered as plain text everywhere — React JSX text-node escapes. | B | N |
| D-NE7 | Money overflow | Enter Total `£99 999 999.99` (≈ 10^10 pence). | Accepted; stored as int8-compatible bigint within Postgres limits. List renders with `tabular-nums`. | L | N |
| D-NE8 | Long description | Paste a 5 000-char block into Description. | Stored. List shows a 2-line `line-clamp-2` preview; full text visible on Edit. | L | N |
| D-NE9 | Unicode filename | Upload `Audi A4 — 2018 (£2.5k).pdf` | Path's filename component is sanitised to `Audi_A4_-_2018_-2.5k_.pdf` (or similar) via `replace(/[^A-Za-z0-9._-]/g, "_")`. Original `filename` field keeps the human name. | L | N |
| D-NE10 | Network failure mid-upload | Throttle "Offline" during upload. | Toast "Upload failed — try again". No DB row written. | M | N |
| D-NE11 | Network failure mid-submit | Throttle after upload succeeds, before insert. | Toast surfaces. **F-D3 fix**: on dialog close (Cancel or submit-failure), every path uploaded in this session that is not the persisted baseline is purged from Storage. | M | P (logic verified post-fix) |
| D-NE15 | Mid-session attachment replace | Upload PDF A → upload PDF B → Cancel. | **F-D3 fix**: PDF A is purged immediately when B is uploaded; PDF B is purged on Cancel. Neither leaks. | L | N |
| D-NE12 | Vendor deleted mid-flow | Open form, pick vendor, mark vendor inactive (other tab), submit. | FK still references the existing vendor; insert succeeds because `active` is a UI flag, not a constraint. | L | N |
| D-NE13 | Vehicle deleted mid-flow | Pick a vehicle, delete it from another tab, submit. | FK fails; toast surfaces the error. | M | N |
| D-NE14 | Mobile / tablet | Open at 768 px width. | Top-tabs wrap; list rows reflow; form dialog fits. | L | N |

---

## 5. Resolved follow-ups

All five edge-case follow-ups from Round-1 are now closed.

| ID | Title | Sev | Status | Fix |
|---|---|---|---|---|
| F-D1 | Replacing an attachment leaks the old Storage object | L | **Resolved** | `update()` fetches `prevAttachmentUrl` when `patch.attachmentUrl` is touched; purges the orphan after a successful DB update. |
| F-D2 | `companyId: ""` in update/delete activity log | B | **Resolved** | `update` + `delete` now take `companyId` as a required argument; all three call sites pass `company.id` from `useAuth()`. |
| F-D3 | Network-failure-after-upload orphans Storage objects | M | **Resolved** | Form tracks `draftPathsRef`; replaces / Cancel / dialog-dismiss all call `externalInvoiceService.removeAttachmentObject(path)`. The persisted baseline is preserved. |
| F-D4 | Inline vendor add allows duplicate names | M | **Resolved** | Migration `0016_vendors_unique_name_per_company` adds a unique index on `(company_id, lower(name))`; the dialog pre-checks and the service-side catches `23505`. Pre-existing dups are auto-suffixed. |
| F-D5 | Invoicing tab state not in URL | M | **Resolved** | Top-tab state mirrored in `?tab=` via `useSearchParams` + `router.replace`. Invalid values fall back to Sales. |

### New low-severity follow-ups (deferred to V1.1)

| ID | Title | Severity | Owner | Notes |
|---|---|---|---|---|
| F-D6 | Storage orphan sweep job | L | Ops | Even with F-D1/F-D3, a process crash mid-upload could leak an object. A weekly cron that lists `external-invoices/` paths not referenced by any `external_invoices.attachment_url` row would close the gap. |
| F-D7 | Vendor merge UI | L | Product | The unique index prevents new dups but doesn't help if Ali wants to merge two legacy vendors. A "merge into" action on the vendors admin page is the natural follow-up. |

---

## 6. Walkthrough script (for Ali · 30 min)

1. Open `/admin/invoicing`. Show the 3 tabs and what's where (3 min).
2. Click **Purchase Invoices → + New invoice**. Pick a vendor, pick a vehicle, type £1 200 total + £200 VAT, drop a PDF attachment. Submit (8 min).
3. Switch to **External Job Invoices**, repeat with a different vendor + kind (5 min).
4. Click the row's attachment icon → confirm the PDF opens in a new tab (2 min).
5. Open a Vehicle Detail → Financials. See the new **External Invoices** section with both rows + the grand total Pill (4 min).
6. Click **+ Record Purchase** from inside the section → confirm the vehicle picker is locked (3 min).
7. Open Activity tab → confirm three new entries (`external_invoice_created`, etc.) with the right description (3 min).
8. Open `/sales/leads`, create a new lead, pick a channel from the dropdown → confirm the chip appears on the row (2 min).
9. Visit `/admin/inventory/listings` → confirm 301 → `/vehicles` (1 min).
10. Sign off in writing or async video.

---

## 7. Round-1 findings (2026-05-26 — automated DB-side)

Migrations applied: ✅ `0013_lead_channels_canonical_seed`,
✅ `0014_lead_channels_rls`, ✅ `0015_external_invoices`,
✅ `0016_vendors_unique_name_per_company` — all idempotent on the live
`tbhtdurpvysfuqzfvaol` Supabase project.

| Case | Result | Notes |
|---|---|---|
| C-S1/S2 migration idempotency | **PASS** | Re-running `apply_migration` was a no-op (all clauses guarded). |
| C-S3 nine canonical channels | **PASS** | All 9 slugs match the spec. |
| C-S4 hex colour on each | **PASS** | All 9 rows have a 7-char hex. |
| C-S5 RLS allows read (F4 fix) | **PASS** | After 0014, Inventory Manager can read channels (was the showstopper). |
| C-U1/U2/U3 Channel UI end-to-end | **PASS** | Dropdown shows 9; submit persists; row chip renders with colour. |
| D-S1 migration 0015 idempotent | **PASS** | Second `apply_migration` is a no-op. |
| D-S2 four CHECKs present | **PASS** | `external_invoices_kind_check`, `external_invoices_total_nonneg`, `external_invoices_vat_nonneg`, `external_invoices_vat_within_total`. |
| D-S3 – D-S6 CHECK rejections | **PASS** | DO-block probe confirmed each of bad-kind / neg-total / neg-vat / vat-over-total raises `check_violation`. |
| D-S7 `pre_vat_pence` generated | **PASS** | `120 000 − 20 000 = 100 000`. |
| D-S8 four RLS policies | **PASS** | All scope through `vehicles.company_id = current_company_id()`. |
| D-S10 storage bucket | **PASS** | 10 MB limit + JPG/PNG/PDF whitelist. |
| D-S11 storage RLS | **PASS** | 4 policies, all `(storage.foldername(name))[1] = current_company_id()`. |
| D-S14 activity_log CHECK extension | **PASS** | All three new types present. |
| D-C1 – D-C4 capability + role grants | **PASS** | Inspected source; Admin gets all 3; Inventory Manager only `:create`; Sales Manager nothing. |
| D-AL4 `company_id` non-empty on update/delete logs | **PASS (post-fix)** | Bug F-D2 fixed by passing `companyId` to `update` + `delete`; all three call sites updated. |
| E-U1 Listings redirect | **PASS** | `next.config.ts` adds a 301 from `/admin/inventory/listings` → `/vehicles`. |
| E-U2 All Vehicles helper copy | **PASS** | New italic muted line under `<h1>`. |
| Build / tsc / eslint | **PASS** | `pnpm exec tsc --noEmit` exit 0; `pnpm build` green; eslint clean on all new Module-D files. |

**Pending (require live browser session with Ali):** every UI test case
marked **N** in §4 — D-F*, D-V*, D-A*, D-L*, D-T*, D-X*, D-AL1–3/5,
D-P*, D-NE*, E-U3–6.

---

## 7.5 Round-2 findings (2026-05-26 — post-fix verification)

All five follow-ups from §5 closed in the same turn:

| Fix | Verification |
|---|---|
| F-D1 (orphan-on-replace) | Added `prevAttachmentUrl` fetch in `update()`. After write, if `prev ≠ new && prev ≠ null`, the prior path is removed from the `external-invoices` bucket (best-effort, swallows errors). |
| F-D2 (companyId leak) | Closed in Round-1 commit `c289a34`. All three call sites pass `company.id`. |
| F-D3 (orphan-on-cancel) | Form tracks `draftPathsRef`. `handleAttachmentChange` purges replaced drafts; `purgeDrafts()` is called from `handleDialogOpenChange(false)` and the Cancel button. Successful save clears the draft set so close doesn't double-delete. |
| F-D4 (vendor dedup) | Migration `0016` applied to prod. DB-level probe: insert "UAT_F-D4_Probe_v2", then try "uat_f-d4_probe_v2" → Postgres raises `23505 duplicate key value violates unique constraint "vendors_unique_name_per_company"`. ✅ Probe row cleaned up. UI: pre-check in `VendorInlineAdd.save()` short-circuits with a friendly toast and auto-selects the existing vendor. |
| F-D5 (URL tab state) | Page reads `?tab=` via `useSearchParams`; `setTopTab` calls `router.replace` with `scroll: false`. `parseTopTab` rejects unknown values back to `"sales"`. |

**Build status after fixes:** `pnpm exec tsc --noEmit` exit 0;
`pnpm build` green. Eslint clean on all touched files (the two
remaining `react-hooks/set-state-in-effect` lints are pre-existing
patterns in `page.tsx` that I didn't author).

---

## 8. Sign-off

| Signatory | Role | Date | Result |
|---|---|---|---|
| Ali (operator) | Owner / Super User | — | Pending |
| Ammar Bass (PM) | Product | — | Pending |
| Claude (implementer) | Engineering | 2026-05-26 | DB + service + tsc/build/eslint green |
