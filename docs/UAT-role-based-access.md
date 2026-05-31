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

## Sign-off

- [ ] All Part 1 role rows pass.
- [ ] All Part 2 cross-cutting cases pass.
- [ ] **All Part 3 bypass attempts are REJECTED.**
- [ ] `node scripts/delete-test-users.mjs` run to clean up.

Tester: ________________  Date: ____________
