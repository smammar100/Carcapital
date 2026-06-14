# UAT — Full-Flow Test Pass (from 2026-06-10 review call)

Scope: walk the whole journey **arrival → inspection → maintenance → advert → sales →
invoice → admin**, with UAT cases per module derived from the call action items.

Status legend: ✅ already works · 🔧 fix in this pass · ⏳ needs external input (API key / asset / data) · 🔜 follow-up

---

## Action-item tracker (call 2026-06-10)

| # | Item | Module | Status |
|---|------|--------|--------|
| 1 | Email company logo for invoice/branding | — | ⏳ needs logo asset from Ali |
| 2 | Reg number on Maintenance tiny cards | Maintenance | 🔧 |
| 3 | Per-job Done + owner; auto-move to Completed; auto-archive >6mo | Maintenance | 🔧 |
| 4 | Maintenance calendar working hours start 09:00; 30-min slots | Maintenance | 🔧 |
| 5 | Optional reg number on Maintenance calendar events | Maintenance | 🔧 |
| 6 | Split Inspection Queue into Pending / Completed; auto-move | Inspection | 🔧 |
| 7 | Worklist image fetch/save; dealer-click; listing mismatch | Advert | 🔧 (dealer-click) / ⏳ (image gen needs OpenAI key + real photos) |
| 8 | Lead-linking to deals/inventory; manual lead form; Deal-from-customer | Sales | 🔧 (manual form ✅ already; add Create-Deal) |
| 9 | Reg number search to stock/inventory | Inventory / Invoice | ✅ (All Vehicles) / 🔧 (invoice picker) |
| 10 | Postcode lookup API for address entry | Invoice | 🔧 (wire existing lookup field) / ⏳ (live API key) |
| 11 | Enforce required fields on invoice form | Invoice | ✅ (validate()) / 🔧 (add required markers + inline errors) |
| 12 | Separate test env; pre-launch stress testing | infra | 🔜 |
| 13 | Push UI to staging → demo → prod | process | 🔜 |
| 14 | Light/dark mode toggle | shell | ✅ (header toggle) |
| 15 | News section with links on dashboard | Dashboard | ✅ "Latest news" (activity) / 🔜 external news+links |
| 16 | Staff management + temp password | Admin | ✅ (Add Staff dialog) |
| 17 | Delete dummy data; load real master sheet; test 7–8 cars | data | ⏳ owner action |

---

## Module UAT cases

### A. Maintenance — Pipeline
- **MNT-01** Each job card shows the vehicle **registration**. *(was missing)*
- **MNT-02** A card has a one-click **Done** action that moves the job to Completed and stamps `completedDate`.
- **MNT-03** Job detail lets you **reassign the owner** (assignee).
- **MNT-04** Completed jobs older than **6 months** drop off the pipeline (archived view) but remain in history.
- **MNT-05** Moving a job via the ⋯ menu still works; no "something went wrong" on open.

### B. Maintenance — Calendar
- **MCAL-01** Week/Day grid **starts at 09:00** with **30-min** slots.
- **MCAL-02** Calendar event shows the vehicle **registration**.
- **MCAL-03** Creating a maintenance event lets you optionally **attach a vehicle / reg** (optional).

### C. Inspection Queue
- **INS-01** Queue has **Pending** and **Completed** tabs.
- **INS-02** A vehicle with an incomplete inspection sits in **Pending**.
- **INS-03** On **Complete inspection**, the vehicle auto-moves to **Completed** (and out of Pending).
- **INS-04** Reg plate visible on every row.

### D. Advert — Work List
- **ADV-01** Clicking a vehicle row/image opens the **vehicle detail** (so the user can reach photos/dealer). *(dealer-click)*
- **ADV-02** Vehicles with photos show them; demo/placeholder vehicles show the car placeholder (documented behaviour).
- **ADV-03** *(report)* Listing↔vehicle mismatch — flagged to Ali, not a code bug (one listing per vehicle, joined by `vehicleId`).

### E. Sales — Leads / Deals
- **SAL-01** Create-Lead dialog opens and submits a **manual** lead (name, phone, email, vehicle, channel). *(already manual)*
- **SAL-02** From a lead, you can **Create a Deal** (links lead → deal → vehicle) and land it in the Pipeline at `new_lead`.
- **SAL-03** Pipeline customer name links to the vehicle; Generate-Invoice appears at deposit/completed.

### F. Inventory / Invoice picker
- **INV-01** All Vehicles search matches **registration** / stock / make / model. ✅
- **INV-02** Invoice-generation vehicle picker is **searchable by reg** (not a long plain dropdown).

### G. Invoice form
- **IGN-01** Required fields (vehicle, buyer name/phone/address/postcode, sale price) are enforced with clear messaging + required markers.
- **IGN-02** Buyer address has a **postcode lookup** to fill the address.

### H. Dashboard / Shell
- **DSH-01** Light/dark toggle in header flips theme. ✅
- **DSH-02** "Latest news" shows recent activity. ✅

---

## Notes
- Items needing the owner: company **logo**, real **master-sheet data** (delete dummy data + load 7–8 cars), and any **paid API keys** (live postcode lookup, image generation).
- Each fixed module below is committed + pushed to `main` separately.
