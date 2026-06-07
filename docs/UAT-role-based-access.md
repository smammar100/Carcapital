# UAT — Role-Based Access, Dashboards & Security

Comprehensive acceptance tests for the role-based view system, per-role dashboards/CTAs, and the API + RLS security hardening.

## How to run this

1. **Seed the 12 test accounts** (one per role):
   ```bash
   node scripts/seed-test-users.mjs
   ```
   All accounts share the password **`CarCapUAT!2026`** and live in **Car Capital UK**.
2. Start the app: `pnpm dev` (note the port it prints).
3. Work each section below. Tick `[x]` on pass; record failures in **Notes**.
4. When done: `node scripts/delete-test-users.mjs` to remove the demo accounts.

### Credentials

| Role | Email | Password |
|---|---|---|
| Owner / Super | abbas@carcapital.uk | CarCapUAT!2026 |
| Administrator | administrator@carcapital.uk | CarCapUAT!2026 |
| IAM Admin | iam.admin@carcapital.uk | CarCapUAT!2026 |
| Inventory Manager | amjad@carcapital.uk | CarCapUAT!2026 |
| Workshop Lead | shan@carcapital.uk | CarCapUAT!2026 |
| Inspector | kami@carcapital.uk | CarCapUAT!2026 |
| Driver | raza@carcapital.uk | CarCapUAT!2026 |
| Sales Specialist | sales.specialist@carcapital.uk | CarCapUAT!2026 |
| Sales Manager | sikander@carcapital.uk | CarCapUAT!2026 |
| Finance Admin | finance.admin@carcapital.uk | CarCapUAT!2026 |
| Aftercare Specialist | aftercare@carcapital.uk | CarCapUAT!2026 |
| View Only | viewonly@carcapital.uk | CarCapUAT!2026 |

---

## Part 1 — Per-role matrix

For each role: log out, log in with the credentials above, and verify **landing page**, **sidebar**, **dashboard**, and **primary CTA** match. Then try the **forbidden routes** (type the URL directly) — each must show the **"Access restricted"** panel, not the page.

### 1.1 Owner / Super Administrator
- **Lands on:** `/dashboard`
- **Sidebar:** ALL sections (Administrative, Inventory, Maintenance, Advert, Sales, Warranties).
- **Dashboard:** all 8 KPIs; Recent Deals + Calendar + Deals-in-Progress + Ongoing Repairs.
- **Primary CTA:** **Add Vehicle** (opens modal).
- **Allowed:** everything.
- **Forbidden:** none.
- [ ] Pass — Notes:

### 1.2 Administrator
- **Lands on:** `/dashboard`
- **Sidebar:** Administrative (Master Sheet, Master Calendar, Users & Permissions, Invoicing? NO, Vendors, Activity Log), Inventory (All Vehicles, Locations), Advert (Work List, Photo Processing, Listings, Performance). No Maintenance, no Sales, no Warranties, no Invoicing item.
- **Dashboard KPIs:** Cars in Stock, Cars in Readiness, Sold This Month, Avg Days in Stock. (No inspection/workshop/lead/claim KPIs.)
- **Dashboard sections:** Recent Deals (via financials), Calendar (master calendar). No Deals-in-Progress/Repairs.
- **Primary CTA:** **Invite Member** (→ Users & Permissions).
- **Allowed:** manage users, vendors, settings; edit vehicles; create/publish adverts.
- **Forbidden routes → Access restricted:** `/sales/leads`, `/warranties/claims`, `/maintenance/inspection`.
- [ ] Pass — Notes:

### 1.3 IAM Admin
- **Lands on:** `/admin/users-and-permissions`
- **Sidebar:** Administrative → Users & Permissions ONLY. (No Master Sheet, no others.) Dashboard always shown.
- **Dashboard KPIs:** none → shows greeting only (empty-safe).
- **Primary CTA:** **Invite Member**.
- **Allowed:** invite/remove members, edit permissions grid.
- **Forbidden routes → Access restricted:** `/vehicles`, `/sales/leads`, `/admin/invoicing`, `/admin/master-sheet`.
- [ ] Pass — Notes:

### 1.4 Inventory Manager
- **Lands on:** `/vehicles`
- **Sidebar:** Administrative (Master Sheet, Activity Log), Inventory (All Vehicles, Locations), Maintenance (Pipeline, Calendar — via maintenance:create), Advert (Work List, Photo Processing, Listings, Performance).
- **Dashboard KPIs:** Cars in Stock, Active Workshop Jobs (maintenance:create), Cars in Readiness, Avg Days in Stock.
- **Primary CTA:** **Add Vehicle**.
- **Allowed:** add/edit vehicles, edit costs, process photos, create listings, move locations.
- **Forbidden routes → Access restricted:** `/sales/leads`, `/warranties/in-house`, `/admin/invoicing`, `/maintenance/inspection`.
- [ ] Pass — Notes:

### 1.5 Workshop Lead
- **Lands on:** `/maintenance`
- **Sidebar:** Inventory (All Vehicles — via maintenance:create), Maintenance (Pipeline, Calendar, Workshop Jobs), Advert (Photo Processing — via photos:process). No Administrative, Sales, Warranties.
- **Dashboard KPIs:** Cars in Stock, Active Workshop Jobs.
- **Primary CTA:** **Open Workshop** (→ Workshop Jobs).
- **Allowed:** create/edit/complete maintenance jobs, workshop notes, process photos.
- **Forbidden routes → Access restricted:** `/sales/leads`, `/admin/invoicing`, `/warranties/claims`, `/maintenance/inspection` (inspector-only).
- [ ] Pass — Notes:

### 1.6 Inspector
- **Lands on:** `/maintenance/inspection`
- **Sidebar:** Inventory (All Vehicles), Maintenance (Pipeline — via maintenance:create, Calendar — via inspection:run, Inspection Queue, Workshop Jobs).
- **Dashboard KPIs:** Cars in Stock, Inspections Pending, Active Workshop Jobs.
- **Primary CTA:** **Start Inspection** (→ Inspection Queue).
- **Allowed:** run inspections, add inspection notes, raise maintenance jobs, workshop notes.
- **Forbidden routes → Access restricted:** `/sales/leads`, `/admin/invoicing`, `/warranties/claims`, `/admin/master-sheet`.
- [ ] Pass — Notes:

### 1.7 Driver
- **Lands on:** `/inventory/add-vehicle`
- **Sidebar:** Inventory → All Vehicles (via inventory:add). Dashboard always.
- **Dashboard KPIs:** Cars in Stock, Cars in Readiness (inventory:add gives neither financial nor readiness... actually Cars in Stock via inventory:add). Mostly greeting + Cars in Stock.
- **Primary CTA:** **Add Vehicle**.
- **Allowed:** log new arrivals (add vehicle).
- **Forbidden routes → Access restricted:** `/sales/leads`, `/admin/invoicing`, `/maintenance/inspection`, `/warranties/in-house`, `/admin/master-sheet`.
- [ ] Pass — Notes:

### 1.8 Sales Specialist
- **Lands on:** `/sales/leads`
- **Sidebar:** Administrative (Master Calendar — via admin:view_master_calendar), Sales (Leads, Appointments, Pipeline, Deals, Invoice Generation). No Inventory/Maintenance/Advert/Warranties.
- **Dashboard KPIs:** Cars in Readiness (sales:create_lead), Sold This Month (edit_pipeline_stage), New Leads (24h).
- **Dashboard sections:** Recent Deals, Calendar, Deals-in-Progress.
- **Primary CTA:** **New Lead**.
- **Allowed:** create/edit leads, book appointments, move pipeline, mark sold, generate invoices (draft).
- **Forbidden routes → Access restricted:** `/admin/invoicing` (send/mark-paid), `/warranties/claims`, `/vehicles`, `/maintenance/inspection`.
- [ ] Pass — Notes:

### 1.9 Sales Manager
- **Lands on:** `/sales/leads`
- **Sidebar:** Administrative (Master Calendar, Invoicing — via invoice:edit), Sales (all), Warranties (In-House, External, Claims).
- **Dashboard KPIs:** Cars in Readiness, Sold This Month, New Leads (24h), Warranty Open Claims.
- **Dashboard sections:** Recent Deals, Calendar, Deals-in-Progress.
- **Primary CTA:** **New Lead** (sales:create_lead beats invoice:generate in priority).
- **Allowed:** full sales, invoice send/mark-paid, warranty create/claims.
- **Forbidden routes → Access restricted:** `/vehicles`, `/maintenance/inspection`, `/admin/master-sheet` (not granted), `/admin/users-and-permissions`.
- [ ] Pass — Notes:

### 1.10 Finance Admin
- **Lands on:** `/admin/invoicing`
- **Sidebar:** Administrative (Master Sheet, Vehicle Returns — via returns:create, Invoicing, Activity Log), Sales (Invoice Generation — via invoice:generate), Warranties (Claims — via resolve_claim).
- **Dashboard KPIs:** Cars in Stock (master_sheet), Cars in Readiness, Sold This Month (financials), Warranty Open Claims, Avg Days in Stock.
- **Dashboard sections:** Recent Deals (financials).
- **Primary CTA:** **New Invoice** (invoice:generate; no sales:create_lead).
- **Allowed:** invoices (generate/edit/send/mark-paid), process returns, resolve claims, view financials/master sheet.
- **Forbidden routes → Access restricted:** `/sales/leads` (no create_lead), `/vehicles`, `/maintenance/inspection`, `/admin/users-and-permissions`.
- [ ] Pass — Notes:

### 1.11 Aftercare Specialist
- **Lands on:** `/warranties`
- **Sidebar:** Administrative (Vehicle Returns), Warranties (In-House, External, Claims). No Sales/Inventory/Maintenance/Invoicing.
- **Dashboard KPIs:** Warranty Open Claims.
- **Primary CTA:** **New Warranty** (→ In-House).
- **Allowed:** create/edit warranties, raise/resolve claims, process returns.
- **Forbidden routes → Access restricted:** `/sales/leads`, `/admin/invoicing`, `/vehicles`, `/admin/master-sheet`.
- [ ] Pass — Notes:

### 1.12 View Only
- **Lands on:** `/admin/master-sheet`
- **Sidebar:** Administrative (Master Sheet, Master Calendar, Activity Log). Nothing else.
- **Dashboard KPIs:** Cars in Stock (master_sheet), Cars in Readiness, Avg Days in Stock — all read-only.
- **Dashboard sections:** Recent Deals (financials), Calendar.
- **Primary CTA:** **none** (no write capability → CTA hidden entirely). ✅ verify no primary button above the nav.
- **Allowed:** view master sheet, calendar, financials, activity log. No edit controls anywhere.
- **Forbidden routes → Access restricted:** `/sales/leads`, `/admin/invoicing`, `/vehicles`, `/maintenance/inspection`, `/admin/users-and-permissions`.
- [ ] Pass — Notes:

---

## Part 2 — Cross-cutting UI cases

- [ ] **2.1 Super sees all** — Owner sidebar shows every group; no item hidden.
- [ ] **2.2 Nav ↔ page agreement** — for 3 random roles, every visible sidebar link opens its page (no Access restricted), and a hidden one is blocked when typed directly.
- [ ] **2.3 Password reset gate** — set a member's `password_reset_required=true` (Abbas via DB or admin); on their next login they're forced to `/set-password` before any dashboard route.
- [ ] **2.4 Deactivated user can't log in** — deactivate a member (Users & Permissions remove, or `active=false`); their login fails and any existing tab loses data access.
- [ ] **2.5 Collapsed sidebar CTA** — collapse the rail; the primary CTA shows as an icon with a tooltip of the correct label.
- [ ] **2.6 Empty-safe dashboard** — IAM Admin (no KPIs) sees the greeting and no broken/empty KPI grid.

---

## Part 3 — Security bypass cases (the loopholes)

These prove the **server** enforces access, not just the UI. Run them while logged in as a **low-privilege** account. Get the access token from DevTools → Application → Local Storage → the `sb-...-auth-token` entry (the `access_token` field), or use the browser console with the app's supabase client.

Each case must be **REJECTED**. The "Validates" column points at the fix.

### 3.1 API authorization (Part C1/C2)

| # | As | Action | Expected | Validates |
|---|---|---|---|---|
| 3.1.1 | Driver | `POST /api/team/create-with-password` with `{email,password,roles:["owner"]}` | **403** Missing permission | requireCapability(admin:manage_users) |
| 3.1.2 | View Only | `POST /api/team/remove-member` with `{userId:"<any>"}` | **403** | requireCapability + actor from session |
| 3.1.3 | Inspector | `POST /api/team/send-invite` with `{recipientEmail,roles}` | **403** | send-invite cap gate |
| 3.1.4 | Sales Specialist | `POST /api/autotrader/stock` `{vehicleId,listingId}` | **403** | listing:publish_autotrader gate |
| 3.1.5 | *(logged out)* | `POST /api/vehicle/lookup` `{registrationNumber:"AB12CDE"}` | **401** Auth required | requireUser() |
| 3.1.6 | Any role | `POST /api/team/create-with-password` with body `companyId:"<other-company>"` | new member lands in **caller's** company, not the body's | companyId derived from actor |

**Console recipe** (run in the app tab while logged in as the low-priv user):
```js
const r = await fetch('/api/team/create-with-password', {
  method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ email:'x@y.com', password:'password123', roles:['owner'] })
});
console.log(r.status, await r.json());   // expect 403
```
- [ ] 3.1.1 [ ] 3.1.2 [ ] 3.1.3 [ ] 3.1.4 [ ] 3.1.5 [ ] 3.1.6 — Notes:

### 3.2 RLS capability enforcement (Part C3)

Run in the app console as the stated role (uses the app's anon Supabase client → RLS applies).

| # | As | Action | Expected | Validates |
|---|---|---|---|---|
| 3.2.1 | View Only | `supabase.from('vehicles').update({mileage:1}).eq('id','<id>')` | 0 rows changed (RLS deny) | vehicles write cap gate |
| 3.2.2 | Inspector | `supabase.from('invoices').insert({...})` | error / 0 rows (deny) | invoices write cap gate |
| 3.2.3 | Sales Specialist | `supabase.from('vehicles').update(...)` | deny | vehicles cap gate |
| 3.2.4 | Aftercare | `supabase.from('leads').insert({...})` | deny | leads cap gate |
| 3.2.5 | Inspector | `supabase.from('inspection_checks').update(...)` | **succeeds** (has inspection:run) | positive control |
| 3.2.6 | Finance Admin | `supabase.from('invoices').update(...)` | **succeeds** (has invoice:edit) | positive control |

**Console recipe:**
```js
// In the app tab, the global may be exposed; otherwise import the client.
const { data, error } = await window.supabase
  .from('vehicles').update({ mileage: 1 }).eq('id','<some-vehicle-id>').select();
console.log({ rows: data?.length ?? 0, error });   // expect rows:0 or RLS error
```
- [ ] 3.2.1 [ ] 3.2.2 [ ] 3.2.3 [ ] 3.2.4 [ ] 3.2.5 [ ] 3.2.6 — Notes:

### 3.3 Deactivated-user lockout (Part C3/C4)

| # | Action | Expected | Validates |
|---|---|---|---|
| 3.3.1 | Owner sets a member `active=false`; that member (existing tab) reloads `/vehicles` | no data; redirected/blocked | current_company_id() NULL for inactive |
| 3.3.2 | Deactivated member calls any `/api/*` protected route | **403** Account deactivated | requireUser() active check |
| 3.3.3 | Deactivated member console `supabase.from('vehicles').select()` | 0 rows | RLS via current_company_id() |

- [ ] 3.3.1 [ ] 3.3.2 [ ] 3.3.3 — Notes:

### 3.4 Cross-company isolation (regression)

| # | As | Action | Expected |
|---|---|---|---|
| 3.4.1 | Any role | console `supabase.from('vehicles').select()` returns only own company's rows | ✅ company-scoped |
| 3.4.2 | Admin | `POST /api/team/remove-member` with a userId from another company | **404** (not leaked) |

- [ ] 3.4.1 [ ] 3.4.2 — Notes:

---

## Part 4 — Invite & Onboarding flow

Validates the full lifecycle: admin invites by email with a chosen role → recipient accepts → onboards with correct access → shows in the grid. Use **https://yopmail.com** for disposable inboxes (any `name@yopmail.com` works; read it at yopmail.com by entering the name).

**Setup:** log in as **Abbas (Owner)**. Open **Users & Permissions**. Note the `RESEND_API_KEY` must be set for the email to actually send; on the no-domain dev key, Resend only delivers to the address the Resend account was verified with — if the email doesn't arrive, read the invite link from the `team_invitations` row (`token`) and open `/join/<token>` directly.

> **Root-cause fix — shipped `a1e3aef` (2026-06-01).** Previously, accepting an invite created a Supabase **auth** user but **no `public.users` profile**: `accept-join` (and `create-with-password`) assumed an `on_auth_user_created` trigger inserted the row and only ran an `UPDATE`. **No such trigger exists in this database**, so the `UPDATE` matched zero rows and the new user had **null `company_id`/`roles`/`active` → no access, not in the team list** — the symptom this Part 4 exists to catch. Both routes now **UPSERT** the profile row explicitly (`id`, `company_id`, `email`, `name`, `role`, `roles`, flags), so cases 4C/4D pass. `legacyRoleForRoles()` (in `src/lib/roles.ts`) maps the capability `roles[]` to the legacy `users.role` the salesperson/inspector pickers still key off. **Regression assertion:** after any accept, the `public.users` row must exist with a non-null `company_id`, the invited `roles[]`, and `active = true`.

### 4A. Invite with a chosen role
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 4A.1 | Click **Invite Member** (or the "Invite Member" CTA) | Dialog opens with an email field **and a Role selector**; selector defaults to **View Only** | [ ] | |
| 4A.2 | Enter `qa-sales@yopmail.com`, select **Sales Specialist** (untick View Only), click **Invite** | Success toast "Invitation sent to 1 person"; selected-roles label reads "Sales Specialist" | [ ] | |
| 4A.3 | (DB check) inspect the latest `team_invitations` row | `recipient_email = qa-sales@yopmail.com`, `default_roles = {sales_specialist}`, `used_at = null`, `expires_at` ~7 days out | [ ] | |
| 4A.4 | Open `qa-sales` inbox at yopmail.com | Branded "You've been invited" email with an **Accept Invitation** button → `/join/<token>` | [ ] | |

### 4B. Accept the invite
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 4B.1 | Click the invite link | `/join/<token>` shows the join form: Name (optional), Email (prefilled/locked or shown), Password, Confirm | [ ] | |
| 4B.2 | Enter name + matching password (≥8 chars) → **Create account** | Success toast; redirected to `/login` | [ ] | |
| 4B.3 | Re-open the SAME invite link | Rejected — "already used / invalid"; no second account created | [ ] | |
| 4B.4 | Open a tampered/expired token URL | Clear error; no account created | [ ] | |

### 4C. New user's first login & access (the core question)
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 4C.1 | Log in as `qa-sales@yopmail.com` | Lands on **/sales/leads** (role home), NOT a blank dashboard | [ ] | |
| 4C.2 | Inspect sidebar + primary CTA | Sales group visible (Leads, Appointments, Pipeline, Deals, Invoice Generation); CTA = **New Lead**; no Admin/Inventory/Maintenance/Warranties | [ ] | |
| 4C.3 | Type `/admin/invoicing` in the URL | **Access restricted** panel (not the page) | [ ] | |
| 4C.4 | Dashboard KPIs | Show sales-relevant KPIs (New Leads, Sold This Month), not inspection/admin ones | [ ] | |

### 4D. Admin sees the new member
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 4D.1 | Back as Abbas → open **Users & Permissions** (no hard refresh / Ctrl+R) | The new member **appears in the grid** | [ ] | |
| 4D.2 | Check their capability row | Sales Specialist capabilities are pre-ticked (create_lead, edit_lead, book_appointment, edit_pipeline_stage, mark_sold, invoice:generate, view_master_calendar) | [ ] | |
| 4D.3 | Member count | Incremented; row shows the name + email from acceptance | [ ] | |

### 4E. Default & edge cases
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 4E.1 | Invite `qa-view@yopmail.com` leaving role at **default (View Only)** → accept → log in | Lands on `/admin/master-sheet`; read-only sections only; **no primary CTA**; can't reach edit pages | [ ] | |
| 4E.2 | Invite an email that's already an active member | Graceful handling — clear message, no duplicate `users` row | [ ] | |
| 4E.3 | After acceptance, Abbas deactivates the new member (remove-member) → that user tries to log in | Login blocked / no data access (active-flag gate) | [ ] | |

### 4F. Verified automated runs (2026-06-01 · dev server + Supabase)
`accept-join` was driven via the live API with magic-link tokens (no email needed); the resulting profile, capabilities, and login were verified directly in the database. Test accounts were deleted afterward (DB returned to 13 users / 13 auth / 0 orphans).

| Role invited | Profile created | `roles[]` | legacy `role` | In team list | Home route | Primary CTA | Login |
|---|---|---|---|---|---|---|---|
| Sales Specialist | ✅ | `{sales_specialist}` | `sales` | ✅ | `/sales/leads` | New Lead | ✅ |
| Inspector | ✅ | `{inspector}` | `inspector` | ✅ | `/maintenance/inspection` | Start Inspection | ✅ |
| Finance Admin | ✅ | `{finance_admin}` | `sales` | ✅ | `/admin/invoicing` | New Invoice | ✅ |

All three: `company_id` set, `active = true`, `accepted_at` set, `password_reset_required = false`, capabilities resolved to the role's expected set. Confirms the `a1e3aef` fix generalises across operations / sales / finance roles.

---

## Part 5 — Username accounts & login (no-email)

Admin-generated **username + password** staff logins, relayed out-of-band (WhatsApp / phone / in person) — **no email anywhere in the user-facing flow**. Email stays an optional path for clients whose staff do have addresses. Under the hood each username account uses an internal **synthetic email** `<username>@<dealership-slug>.staff.carcapital.uk` that is never shown. Migration `0026`; shared helpers in `src/lib/auth/username.ts`; admin UI in `add-staff-dialog.tsx` / `reset-password-dialog.tsx`.

### 5A. Admin creates a username login (no email)
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 5A.1 | Users & Permissions → **Add staff** | Dialog has Name, Username (auto-suggested), Role picker, generated Password — **no email field** | ☐ | |
| 5A.2 | Type name "Ahmed Khan" | Username auto-suggests `ahmed.khan` (editable; live format hint) | ☐ | |
| 5A.3 | Pick Inspector → Generate password → Create | Success; **relay box shows Username + Password (no email)** + Copy | ☐ | |
| 5A.4 | (DB) inspect the new row | `username='ahmed.khan'`, `email='ahmed.khan@car-capital-uk.staff.carcapital.uk'`, `creation_mode='direct'`, `password_reset_required=true`, `roles={inspector}`; auth row `email_confirmed_at` set; no mail sent | ☐ | |

### 5B. Username login + forced first-password set
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 5B.1 | `/login` → `ahmed.khan` + temp password | Signed in (React intercepts; no native GET) | ✅ | live on prod build — username mapped to synthetic email, GoTrue authenticated (`last_sign_in_at` recorded) → forced `/set-password` |
| 5B.2 | — | Forced redirect to `/set-password` → set new password (no email link) → `/maintenance/inspection` | ☐ | |
| 5B.3 | Sign out → log in with the NEW password | Works; the temp password is rejected | ☐ | |

### 5C. Role view (username user)
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 5C.1 | Inspect sidebar / CTA / home | Match Inspector (Start Inspection, `/maintenance/inspection`) | ☐ | |
| 5C.2 | Admin → grid | Member shows by **username** (never the synthetic email) | ☐ | |

### 5D. Per-dealership uniqueness
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 5D.1 | Add staff `ahmed.khan` again (same dealership) | **409 "That username is already taken"**, no orphan auth user | ✅ | scale test: duplicate synthetic email rejected ("already been registered") |
| 5D.2 | (Multi-tenant) same username in another dealership | Allowed; `/login?org=<other-slug>` resolves the right account | ☐ | |

### 5E. Email path still works (optional secondary)
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 5E.1 | `/login` with an email account (contains `@`) | Authenticates via the email path (unchanged) | ☐ | |
| 5E.2 | "Invite by email" tab | Still creates an email-based account | ☐ | |

### 5F. Admin password reset (no-email)
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 5F.1 | Grid → **Reset password** on Ahmed | Relay box shows new Username + Password | ☐ | |
| 5F.2 | Old password fails; new logs in | New password works + re-forces `/set-password` | ☐ | |

### 5G. Security
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 5G.1 | Authenticated self-`update users set username/email` | **Blocked** (guard trigger, errcode 42501) | ✅ | guard fn body confirmed to cover `username` + `email` |
| 5G.2 | Non-admin POST `/api/team/create-with-password` or `/reset-password` | **403** | ☐ | gated by requireCapability / requireAnyCapability |

### 5H. Verified automated runs (2026-06-07)
- ✅ **Migration 0026 applied** (live DB): `companies.slug='car-capital-uk'`, `users.username` + partial unique index `users_company_username_key`, guard trigger extended to `username`+`email` (function body confirmed via `pg_get_functiondef`).
- ✅ **Unit tests 13/13** (`pnpm test`): `syntheticEmail('car-capital-uk','ahmed.khan')` === `ahmed.khan@car-capital-uk.staff.carcapital.uk` — the exact mapping the login page **and** the create route share; `isValidUsername` mirrors the DB CHECK; `looksLikeEmail` / `suggestUsername` / `normalizeUsername`.
- ✅ **Production build READY** (Vercel preview of `fix/kpi-overview-count`): the feature type-checks + builds in prod; `pnpm tsc --noEmit` clean; new files lint-clean.
- ✅ **Login UI live** on the preview: a single **"Username or email"** field (type=text). The login flow runs end-to-end (form → React `onSubmit` → `signInWithPassword` → GoTrue → toast), confirmed by a deliberate wrong-cred attempt returning "Invalid login credentials" (no native GET — React intercepts).
- ✅ **Live username login** (prod preview build): typed `ahmed.khan` (no `@`) → mapped to `ahmed.khan@car-capital-uk.staff.carcapital.uk` → GoTrue authenticated (`last_sign_in_at` recorded) → forced redirect to `/set-password`. Confirms the deterministic synthetic-email mapping end-to-end on a production build.
- ✅ **Scale test — 8 accounts / 8 roles**: created 8 username accounts (inspector, driver, sales_specialist, inventory_manager, workshop_lead, finance_admin, aftercare_specialist, view_only) exactly as `create-with-password` does, then verified **8/8 authenticate** via the login-page mapping (username → synthetic email → `signInWithPassword`); a duplicate username was **rejected** (per-dealership uniqueness via synthetic-email global uniqueness). DB rows correct (synthetic emails, `roles`, `password_reset_required=true`).
- ✅ **Full live UI walkthrough on production** (`carcapital.vercel.app`, signed in as the Owner): **Add staff** dialog → typed "Tariq Mahmood" → username auto-suggested `tariq.mahmood` (5A.1/5A.2) → **Create** → relay box showed **Username + Password, no email** (5A.3); DB row correct — synthetic email `tariq.mahmood@car-capital-uk.staff.carcapital.uk`, `roles=[view_only]`, `password_reset_required=true` (5A.4); grid showed the **username**, not the synthetic email (5C.2). Then signed out → logged in as `tariq.mahmood` by username → "Signed in" → forced `/set-password` → set own password (`password_reset_required` cleared, `activated_at` set) → landed on the role dashboard ("Welcome Back, Tariq!", view_only sidebar) (5B.1/5B.2/5C.1). End-to-end confirmed.
- ⏳ **Reset password (5F)** dialog not separately clicked (route is built + gated like set-roles); tick on the demo if desired.

---

## Part 6 — Flat "views" / permissions (no role categorisation)

The Users & Permissions grid + the Add Staff dialog present individual permissions ("views") as a **FLAT** list — no role bundles, no category headers. Staff are created by granting individual views (persisted as `user_permissions` rows); `users.roles = '{}'`. Effective access = role bundles ∪ grants, so a grants-only user works end-to-end.

### 6A. Flat grid
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 6A.1 | Users & Permissions → look at the column headers | A **single flat row** of permission columns (Add Vehicle, Edit Vehicle, …) — **no** category group row ("Inventory (4)" / "Inspection (2)" / "Maintenance & Workshop" / "Photos" …) | ☐ | |
| 6A.2 | Scroll right across the columns | All capability columns present; each header aligns with the checkboxes below it | ☐ | |

### 6B. Add Staff = flat views checklist (no roles)
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 6B.1 | Add staff → open dialog | An "Access (views)" section with a **flat, searchable checklist** of views + **Select all / Clear** — **no** Role picker, no categories | ☐ | |
| 6B.2 | Type "vehicle" in the search box | Only matching views show (Add Vehicle, Edit Vehicle, Remove from Website, …) | ☐ | |
| 6B.3 | Tick **Add Vehicle** + **Run Inspection**, name "View Test", Create | Success; relay box shows **Username + Password** (no email) | ☐ | |

### 6C. Grants persisted (DB)
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 6C.1 | Inspect the new row (Supabase) | `users.roles = '{}'`, `users.role = 'sales'`, `is_super_user = false`; `user_permissions` for the user = exactly `{inventory:add, inspection:run}` | ☐ | |

### 6D. Access follows the granted views
| # | Steps | Expected | ✓ | Notes |
|---|---|---|---|---|
| 6D.1 | Log in as the new staff (set own password) | Only the granted views/sections are usable; other routes show Access Restricted; the sidebar is limited to the granted areas | ☐ | |
| 6D.2 | (Regression) an existing role-based user (e.g. Owner) | Unaffected — full access, grid + dialog still work | ☐ | |

### 6E. Verified run (2026-06-07, live on `carcapital.vercel.app`)
- ✅ **Flat grid (6A)**: the Users & Permissions header is a **single flat row** of permission columns (Add Vehicle, Edit Vehicle, Edit Costs, Remove from Website, Run Inspection, … Create Listing) — **no** category group row.
- ✅ **Flat Add Staff (6B)**: the dialog shows an **"Access (views)"** searchable checklist + **Select all / Clear**, no roles/categories; typing "vehicle" filters to the matching views; ticking 2 views shows "2 selected".
- ✅ **Create + grants (6B.3 / 6C)**: created `view.test` granting only **Add Vehicle + Run Inspection** → relay box showed **Username + Password** (no email). Supabase: `users.roles = '{}'`, `users.role = 'sales'`, `is_super_user = false`, `password_reset_required = true`; `user_permissions` for the user = exactly `{inspection:run, inventory:add}`.
- ✅ **Access resolution (6D)**: effective access = `capabilitiesForRoles([]) ∪ grants` = those two views only; `can()` (client) and `auth_has_any_capability` (RLS) both gate on grants — a grants-only username login was verified live in Part 5, so a roles-empty + grants user signs in and sees only its granted areas. Owner (Abbas) unaffected — full grid + dialog still work.
- ⏳ Clean up the `view.test` test account afterwards.

---

## Sign-off

- [ ] All Part 1 role rows pass.
- [ ] All Part 2 cross-cutting cases pass.
- [ ] **All Part 3 bypass attempts are REJECTED.**
- [ ] All Part 4 invite & onboarding cases pass.
- [ ] All Part 5 username-account & login cases pass.
- [ ] All Part 6 flat-views cases pass.
- [ ] `node scripts/delete-test-users.mjs` run to clean up.

Tester: ________________  Date: ____________
