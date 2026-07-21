# UAT — Maintenance · Prep & Repair (GEN-63) + Things to Do (GEN-64)

Scope: `/maintenance/prep`, `src/lib/services/prep-service.ts`,
`src/components/vehicle-detail/todo-tab.tsx`, `src/lib/services/todo-service.ts`,
`src/lib/services/inspection-service.ts`.

Pre-reqs: signed in with a maintenance capability. You'll need at least one
vehicle whose inspection has been completed with outstanding items.

## Prep & Repair board

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| 1 | Auto-enrolment | Complete a 20-point inspection leaving items failed or unanswered | The car appears in **Prep & Repair → Unassigned** with no manual step. Sidebar: Maintenance → Prep & Repair. | ☐ |
| 2 | Card roll-up | Read a card | Reg plate, make/model, "N of M done · K outstanding", prep cost to date, and days waiting. | ☐ |
| 3 | Waiting nudge | Compare cards of different ages | Days chip is muted ≤14d, amber 15–30d, red >30d. | ☐ |
| 4 | Assign | Pick a name in the card's dropdown | Card moves to **In Progress**; assignee avatar appears; toast "Assigned". Persists after reload. | ☐ |
| 5 | Unassign | Set the dropdown back to Unassigned | Card returns to the **Unassigned** lane. | ☐ |
| 6 | Open the list | Click the card body | A side sheet opens with that car's Things to Do, plus a link to the full vehicle record. | ☐ |
| 7 | Job Card PDF (card) | Click the download icon on a card | A PDF downloads named `job-card-<stockId>.pdf` with the car's job details. | ☐ |
| 8 | Job Card PDF (sheet) | Click **Job Card PDF** inside the sheet | Same PDF. | ☐ |
| 9 | Ready lane | Mark every item on a car complete | Card moves to **Ready for Sales** with "Ready to move to Sales"; progress bar turns green. | ☐ |
| 10 | Car status follows | Open that car's record | Status has moved from **Being Prepared** to **Ready**. | ☐ |
| 11 | No backwards drag | Repeat #9 on a car already **listed** / **reserved** / **sold** | The car's status is left alone — completing prep never drags it backwards. | ☐ |
| 12 | Clean inspection | Complete an inspection with every check passing | The car goes straight to **Ready** and does not clutter the prep board. | ☐ |
| 13 | Empty state | View with nothing in prep | "Nothing in prep" with an explanation, not a blank page. | ☐ |

## Things to Do — editing (the GEN-64 fix)

Open from a Prep & Repair card, or the vehicle's **Things to Do** tab. Both
render the same component, so results must match in either place.

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| 14 | Status is editable | Change a row's status dropdown | The row moves to that group immediately; group counts update. **Persists after reload.** | ☐ |
| 15 | Cost is editable | Type a cost, press Enter (or click away) | Saved and reflected in Grand Total. Persists after reload. | ☐ |
| 16 | Cost parsing | Enter `£1,250.50` | Stored and shown as **£1,250.50** — currency symbol and commas stripped. | ☐ |
| 17 | Cost cleared | Empty the cost field and blur | Shows "—"; Grand Total drops accordingly. | ☐ |
| 18 | Description is editable | Edit the text and press Enter | Saved. Blanking it is rejected with "Description can't be empty" and reverts. | ☐ |
| 19 | Esc reverts | Type into description or cost, press **Esc** | The field reverts to the stored value; nothing is written. | ☐ |
| 20 | Vendor is editable | Pick a vendor on a row | Saved immediately; persists after reload. | ☐ |
| 21 | Delete | Click the bin icon on a row | Confirm dialog names the item; on confirm the row goes and counts update. | ☐ |
| 22 | Add into a group | Click **+ Add** on **In Progress**, add an item | The item is created *at* In Progress — not created as Pending and then moved. | ☐ |
| 23 | Failed save | (Optional) simulate a save failure | Toast "Couldn't save that change" and the row reverts to its stored values — no silent loss. | ☐ |
| 24 | Progress line | Read the panel subtitle | "N of M done · K still outstanding". | ☐ |
| 25 | Ready banner | Close the last outstanding item | Green banner: "All prep work is complete — this car is ready to move to Sales." | ☐ |

## Inspection → Things to Do generation

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| 26 | Failed checks | Complete an inspection with items marked e.g. Replace / Faulty | One item per failed check, source **Inspection**, described with the check name and the action required. | ☐ |
| 27 | Unanswered checks | Complete an inspection leaving checks blank | Those raise items too, worded "<check> — not checked". Previously they were silently dropped and the car went straight to Ready. | ☐ |
| 28 | "Pending" test drive | Set check 20 (Test Drive) to **Pending** and complete | An item is raised for it. | ☐ |
| 29 | No duplicates | Re-complete the same inspection | Auto-generated items that are still Pending are replaced, not doubled. Items already started or completed are kept. | ☐ |
