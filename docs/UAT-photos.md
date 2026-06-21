# UAT — Vehicle Detail · Photos tab (media library + Vehicle angles)

Scope: Photos tab rebuilt as **Variation C** (media library with a multi-select
toolbar) and the old "AI-generated angles" replaced with **Vehicle angles** —
named slots (Hero/Front/Rear/Side/Interior/Processed) each assigned from an
**uploaded** photo (no AI generation). File:
`src/components/vehicle-detail/photos-tab.tsx`. Services:
`vehiclePhotoService` (list/upload/remove), `vehicleService.setHeroImageUrl`
(cover), `vehicleService.update({customFields})` (angles, key `angle:<slot>`).

Notes:
- **Cover** persists to `vehicles.hero_image_url`. The **Hero** angle slot *is*
  the cover (assigning Hero = set cover).
- **Angle → photo** mapping persists in `vehicles.custom_fields` under
  `angle:front|rear|side|interior|processed` → photoId.
- The tab badge count ("Photos 51") is `vehicle.imagesCount` (AutoTrader listing
  image count) — a different metric from dealer-uploaded photos. The header
  `Photos · N` reflects the actual uploaded count.

Pre-reqs: signed in; open a vehicle → **Photos** tab.

## Upload

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Empty state | Vehicle with 0 uploaded photos | Dashed dropzone "Drag photos here or click to upload · JPG/PNG/WebP up to 15 MB each"; toolbar "Select all" disabled. | ☐ |
| 2 | Click upload | Click **Upload** (or the dropzone) → pick 1 image | Uploads; toast "Uploaded 1 photo"; tile appears; header count +1. | ☐ |
| 3 | Multi-file upload | Select several images at once | All upload in order; toast "Uploaded N photos"; tiles appended after existing. | ☐ |
| 4 | Drag & drop | Drag image files onto the grid | Dropzone ring highlights on drag-over; files upload on drop. | ☐ |
| 5 | Unsupported type | Upload a .gif / .pdf | That file is rejected with an error toast ("Use JPG, PNG, or WebP"); valid files in the same batch still upload. | ☐ |
| 6 | Oversized file | Upload an image > 15 MB | Rejected with "File too large… Max 15 MB"; other files unaffected. | ☐ |
| 7 | Non-image dropped | Drop a non-image file | Ignored (filtered out); no crash. | ☐ |
| 8 | Uploading state | During upload | Upload button shows a spinner + is disabled until done; input resets after (same file can be re-picked). | ☐ |

## Cover photo

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 9 | Set cover (hover) | Hover a non-cover photo → click the **star** | Toast "Cover photo updated"; that tile shows the **Cover** badge; `hero_image_url` updates; only one cover at a time. | ☐ |
| 10 | Set cover (toolbar) | Select exactly 1 photo → **Set as cover** | Same as #9; selection clears. | ☐ |
| 11 | Cover badge persists | Reload the tab | The cover photo still shows the badge (read from `hero_image_url`). | ☐ |
| 12 | Cover has no star | Hover the current cover | It shows only Delete (no "Set as cover" — it's already cover). | ☐ |

## Select & delete

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 13 | Select one | Hover a photo → tick its checkbox | Tile gets a primary ring + check; toolbar shows "1 selected" with Set cover + Delete. | ☐ |
| 14 | Select all | Click **Select all** | Every photo ticked; toolbar count = total. | ☐ |
| 15 | Clear selection | Click **Clear** | All ticks removed; toolbar returns to default. | ☐ |
| 16 | Delete one (hover) | Hover a photo → **trash** | Photo removed optimistically; toast "Deleted 1 photo"; count −1. | ☐ |
| 17 | Bulk delete | Select several → **Delete** | All selected removed; toast "Deleted N photos"; selection clears. | ☐ |
| 18 | Set-cover hidden in multi-select | Select 2+ photos | Toolbar shows Delete but **not** Set cover (only valid for a single selection). | ☐ |
| 19 | Delete failure rollback | (Simulate a remove error) | Photos restore to previous state; error toast "Couldn't delete photo(s)". | ☐ |

## Edge cases — cover / angles interplay

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 20 | **Delete the cover** | Delete the photo that is the current cover | Cover falls back to a remaining photo (`hero_image_url` updated); if none remain, cover clears to null. | ☐ |
| 21 | **Delete an angle's photo** | Assign a photo to e.g. Rear, then delete that photo | The Rear slot returns to empty ("Choose photo"); `custom_fields['angle:rear']` is pruned to null. | ☐ |
| 22 | Delete everything | Delete all photos | Empty dropzone returns; all angle slots show "Upload first" (disabled); cover null. | ☐ |

## Vehicle angles

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 23 | Six slots | View the Vehicle angles section | Slots: **Hero (cover)**, Front, Rear, Side, Interior, Processed; subtitle explains "choose any uploaded photo for each slot". | ☐ |
| 24 | Empty slot, no photos | 0 uploaded photos | Each slot shows "Upload first" and is **disabled**. | ☐ |
| 25 | Choose photo | Click an empty slot → picker opens → pick a photo | Picker "Choose <slot> photo" lists all uploaded photos; picking assigns it; toast "Angle updated"; slot shows the image. | ☐ |
| 26 | Hero slot = cover | Assign the **Hero** slot | It sets the cover (`hero_image_url`); the matching gallery tile shows the Cover badge; toast "Cover photo updated". | ☐ |
| 27 | Change an angle | Hover an assigned slot → **Change** (images icon) → pick another | Slot updates to the new photo; persists. | ☐ |
| 28 | Clear an angle | Hover an assigned slot → **X** | Non-hero: slot empties, `custom_fields['angle:x']` = null. Hero: cover clears to null. | ☐ |
| 29 | Same photo, many angles | Assign one photo to Front and Side | Allowed; both slots show it; both keys persist. | ☐ |
| 30 | Assignment persists | Reload the tab | Assigned slots re-render from `custom_fields` (and Hero from `hero_image_url`). | ☐ |
| 31 | Stale assignment safe | A `custom_fields` angle points to a deleted photo id | Slot shows empty (id not found) — no broken image, no crash. | ☐ |

## Reorder & bulk upload

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 36 | Drag to reorder | Drag a photo tile onto another position | Tiles show a grab cursor; dragged tile dims, target shows a ring; on drop the order changes. | ☐ |
| 37 | Reorder persists | Reorder, then reload the tab | New order is retained (`vehicle_photos.order` rewritten sequentially 0..n). | ☐ |
| 38 | Reorder rollback | (Simulate a save error) | Order reverts to previous; toast "Couldn't reorder photos". | ☐ |
| 39 | Add-photos tile | View a non-empty gallery | A dashed **"Add photos"** tile sits at the end of the grid; clicking it opens the file picker. | ☐ |
| 40 | Drag-drop upload over gallery | Drag image files onto the populated grid | External file drops upload (ring highlight); internal tile drags reorder — the two don't conflict. | ☐ |
| 41 | Bulk upload | Select many files at once (or drop a batch) | All upload sequentially and append; toast "Uploaded N photos". | ☐ |

## Layout / general

| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 32 | Padding / alignment | Visual | Header, toolbar (bordered band), grid, and Vehicle angles share consistent padding; tiles are 4:3, gridlines tidy. | ☐ |
| 33 | Loading skeletons | First open (slow network) | Skeleton tiles show until photos load. | ☐ |
| 34 | Light + dark | Toggle OS theme | Tiles, badges, toolbar, picker dialog all read correctly. | ☐ |
| 35 | Console clean | Open the tab + interact | No console errors / no hydration warnings. | ☐ |

## Verified during build (2026-06-20, vehicle CC-0004)
Seeded 4 test photos, then confirmed end-to-end and cleaned up afterward:
- Grid renders uploaded photos; header "Photos · 4". (#1, #2 layout)
- **Set as cover** → `hero_image_url` = chosen photo. (#9, #11)
- **Vehicle angles** picker → assigning Front/Rear persisted to
  `custom_fields` as `angle:front` / `angle:rear`. (#25)
- **Delete** removed a photo (4→3). (#16)
- **Delete the cover** → cover fell back to a remaining photo. (#20)
- **Delete an angle's photo** → `angle:rear` pruned to null automatically;
  `angle:front` retained. (#21)
- **Drag-to-reorder** → dispatched a native drag; `vehicle_photos.order`
  rewrote sequentially 0..n with the dragged photo moved (also healed
  pre-existing duplicate-order collisions). (#36, #37)
- **Bulk upload** confirmed with the user's own 7+ real uploads; trailing
  **Add photos** tile + "drag to reorder" helper render. (#39, #41)
- `tsc --noEmit` + `eslint` clean for `photos-tab.tsx`.
