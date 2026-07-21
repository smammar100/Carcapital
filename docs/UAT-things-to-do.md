# UAT — Vehicle Detail · Things to Do tab

Scope: `src/components/vehicle-detail/todo-tab.tsx` (Variation B — grouped by
status, per-group inline Add, no header CTA). Wired to `todoService.add` /
`todoService.update` and `vendorService.getAll`.

Pre-reqs: signed in as a user with todo create permission; open any vehicle →
**Things to Do** tab. "Live total" = the **Grand Total** row.

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| 1 | Tab loads grouped | Open the tab | Items grouped under **Pending / In Progress / Done** (Cancelled only if it has items). Header reads "Things to Do · N items". Subtitle "…grouped by status". | ☐ |
| 2 | No header CTA | Inspect top-right of the panel | There is **no** "Add Item" button in the header. Add is only via each group's **+ Add**. | ☐ |
| 3 | Group counts correct | Compare each group pill count to its rows | Count next to each status pill equals the number of rows in that group; header total = sum of all groups. | ☐ |
| 4 | Grand total correct | Read the Grand Total row | Equals the sum of every item's Cost (items with "—" count as 0). | ☐ |
| 5 | Open inline add | Click **+ Add** on the Pending group | An inline row appears with: Description (auto-focused), Vendor select (default "No vendor"), Cost, **Add**, **Cancel**. | ☐ |
| 6 | Add requires description | Leave Description blank → click **Add** | Toast "Description is required"; nothing is created; the add row stays open. | ☐ |
| 7 | **Add to Pending (core bug)** | Description "Test job", click **Add** | Toast "Item added"; row appears under **Pending**; Pending count +1; header items +1. **Persists after refresh.** | ☐ |
| 8 | Add with vendor + cost | + Add → Description "New tyres", Vendor = a real vendor, Cost `120` → **Add** | Row shows the vendor name and **£120.00**; Grand Total increases by £120; persists after refresh. | ☐ |
| 9 | Add to In Progress | Click **+ Add** on **In Progress**, add an item | Item is created and appears under **In Progress** (not Pending) — i.e. promoted to that status. Persists after refresh. | ☐ |
| 10 | Add to Done | Click **+ Add** on **Done**, add an item | Item appears under **Done**; Done count +1. Persists after refresh. | ☐ |
| 11 | Cost parsing | Add with Cost `£1,250.50` | Saved/displayed as **£1,250.50** (currency/commas stripped); blank/invalid cost saves as "—". | ☐ |
| 12 | Cancel discards | + Add → type text → **Cancel** | Add row closes; nothing is created; counts/total unchanged. | ☐ |
| 13 | Keyboard | In the add row: **Enter** submits, **Esc** cancels | Enter behaves like Add (with the validation in #6); Esc behaves like Cancel. | ☐ |
| 14 | Empty group state | View a group with 0 items (e.g. Done) | Shows muted "Nothing here." and still offers **+ Add**. | ☐ |
| 15 | Existing data intact | Compare against pre-change list | All original columns preserved per row — Description, Vendor, Status (group), Source (Manual/Inspection), Cost — and the Grand Total. | ☐ |
| 16 | Inspection-sourced items | Vehicle with inspection follow-ups | Items created from an inspection show Source = "Inspection"; manual adds show "Manual". | ☐ |
| 17 | Padding / layout | Visual check, light + dark | Consistent padding; group cards, rows, add row, and Grand Total align; no overflow; reads correctly in dark mode. | ☐ |
| 18 | Activity log | After adding an item, open the vehicle's **Activity** tab | A "todo_added" entry is logged ("Added: <description>"). | ☐ |
| 19 | Error handling | (Optional) simulate a save failure | Toast "Couldn't add item"; the row is not added; UI stays usable. | ☐ |
| 20 | Permission gate | As a user **without** todo-create permission | (If enforced) Add is unavailable / the create call is rejected gracefully. | ☐ |


## Superseded by GEN-64 (2026-07-21)

The list was render-only: rows could be added but not edited, so nothing a
user did to an existing item stuck. Every field is now editable in place and
the car's status rolls up from the list.

The add-row cases below still hold. For the editing, deletion, roll-up and
inspection-generation cases, see **[UAT-prep-and-repair.md](UAT-prep-and-repair.md)**
— the same component is now rendered in two places (the vehicle tab and the
Prep & Repair sheet) and both must behave identically.

One behaviour change to case #9/#10: adding into a non-Pending group now
inserts at that status directly rather than creating a Pending row and
promoting it. The observable result is the same; the intermediate row is gone.

## Verified during build (2026-06-20)
- #5, #7, #15 confirmed live on vehicle CC-0004: clicking **+ Add** opened the
  inline row; adding "UAT test — brake fluid top up" showed the toast, bumped
  Pending 3→4 and header to 5 items, and the row persisted to
  `public.todo_items` (serial 5, status pending, source manual). Test row then
  removed. `tsc` + lint clean.
