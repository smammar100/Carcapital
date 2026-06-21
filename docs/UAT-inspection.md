# UAT — Vehicle Detail · Inspection tab (inline 20-point)

Scope: the 20-point inspection now runs **inline in the Inspection tab** (no
side drawer). Files: `src/components/vehicle-detail/inspection-tab.tsx`,
`src/components/vehicles/inspection-checklist.tsx`, `inspectionService`
(start / saveCheck / complete), `vehicle-detail-shell.tsx` (controlled tabs),
`vehicles/[id]/page.tsx` (header "Open Inspection" → switches to the tab).

Pre-reqs: signed in with inspection permission; open a vehicle → **Inspection** tab.

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| 1 | Inline, not a drawer | Open the Inspection tab | The inspection renders **in the tab body**. No side panel/sheet slides in anywhere. | ☐ |
| 2 | Header "Open Inspection" | From the vehicle header, click **Open Inspection** | The page switches to the **Inspection tab** (no drawer). | ☐ |
| 3 | Empty state | Vehicle with no inspection | Shows "No inspection yet" + explanation + **Start Inspection**. | ☐ |
| 4 | Start creates 20 rows | Click **Start Inspection** | Editable table of all **20 items** appears; header "Inspector: <name> · 0/20 (0%)"; progress bar empty. | ☐ |
| 5 | Per-item statuses | Open any item's Status select | Options match that item (e.g. MOT Expiry → Valid / Expiring Soon / Expired / N/A; Test Drive → Pass / Fail / Pending). | ☐ |
| 6 | **Autosave on status** | Set MOT Expiry = "Valid" | Header progress bumps to 1/20 (5%); indicator shows "Saving…" then **"✓ All changes saved"**. No Save button needed. | ☐ |
| 7 | Autosave on action note | Type into an "Action required" field, click away (blur) | The note autosaves ("Saving…" → "All changes saved"). | ☐ |
| 8 | **Persistence / come back to update** | Set a few statuses → leave the tab (or refresh) → return to Inspection | The table re-loads **pre-filled** with the saved statuses/notes and is fully **editable**; progress reflects what was saved. | ☐ |
| 9 | Update an existing answer | Change an already-set status to a different value | New value persists (autosave); progress/issue counts recompute. | ☐ |
| 10 | Negative status highlight | Set an item to a failing value (e.g. Tyres = "Replace") | Row is tinted and the action field is emphasised ("Describe what needs doing…"). | ☐ |
| 11 | Complete disabled when empty | Fresh inspection, 0 set | **Complete Inspection** is disabled until at least one item is set. | ☐ |
| 12 | **Complete → Things to Do** | Set ≥1 failing item with notes → **Complete Inspection** | Toast "Inspection complete — N items added to Things to Do"; a green **completed banner** appears; the **Things to Do** tab now contains those items (source = Inspection). | ☐ |
| 13 | Complete with no issues | All items set to passing → **Complete** | Toast "all items pass"; banner shows "all items pass"; no new Things to Do. | ☐ |
| 14 | Re-complete is idempotent | Complete, then change nothing and Complete again | Things to Do is **not** duplicated (pending auto-items are regenerated, not piled up). | ☐ |
| 15 | Edit after complete | After completing, change an answer | Still editable; autosaves; re-completing re-syncs the flagged list. | ☐ |
| 16 | Reset | Click **Reset** | All 20 items clear back to blank (re-inspect from scratch); progress 0/20. | ☐ |
| 17 | Inspection notes | Add a note in the **Inspection Notes** box → Add Note | Note is appended with author + timestamp (append-only). | ☐ |
| 18 | Progress accuracy | Set k of 20 | Header shows "k/20 (round(k/20·100)%)" and the bar width matches; colour green/amber/rose by completion. | ☐ |
| 19 | Padding / layout | Visual check, light + dark | Header card, table, banner, and notes align with consistent padding; readable in dark mode; no overflow. | ☐ |
| 20 | Activity log | After Start / Complete, open **Activity** | "inspection_started" (and the completion's todo adds) are logged. | ☐ |

## Verified during build (2026-06-20)
- #1, #2, #4, #5, #6, #8 confirmed live on vehicle CC-0004: the inspection
  renders inline in the tab; opening a Status select showed the item-specific
  options; setting MOT Expiry = "Valid" advanced the header to "1/20 (5%)" and
  flipped the indicator to "✓ All changes saved" (per-field autosave). `tsc` +
  lint clean. Side drawer (`InspectionSidePanel`) is no longer used.
