# UAT — Settings · Sales Pipeline stages (GEN-65)

Scope: `/admin/settings` → **Sales Pipeline** tab,
`src/components/admin/pipeline-stage-settings.tsx`,
`src/lib/services/pipeline-stage-service.ts`, `/sales/pipeline`,
migration `0038_pipeline_stages.sql`.

Pre-reqs: signed in with **Manage Settings**. Have at least one open deal.

## What "behaviour" means

Every stage declares what the app should do when a deal lands in it. This is
what makes renaming and adding stages safe — the sale lifecycle keys off the
behaviour, not the stage's name.

| Behaviour | Effect |
|---|---|
| No side effects | Deals sit there; the car is untouched. |
| Reserves the car | Car comes off the forecourt; a live advert shows as reserved. |
| Completes the sale | Car stamped sold with the completion date; advert closed; sale recorded. |
| Releases the car | A reserved car goes back on the forecourt. |

## Test cases

| # | Test case | Steps | Expected result | Status |
|---|-----------|-------|-----------------|--------|
| 1 | Agreed changes shipped | Open `/sales/pipeline` | **Offer Made** no longer exists. The viewing stage reads **Qualified / Viewing**. | ☐ |
| 2 | Old deals kept | Look for any deal that used to sit in Offer Made | It's in **Qualified / Viewing** — moved, not deleted. | ☐ |
| 3 | Rename | Settings → Sales Pipeline, edit a stage name, press Enter | Toast "Stage renamed". The board column shows the new name; its deals stay put. | ☐ |
| 4 | Rename is safe | After #3, drag a deal into the renamed stage | Its behaviour is unchanged (e.g. a renamed "Deposit Taken" still reserves the car). | ☐ |
| 5 | Empty name rejected | Clear a stage name and blur | Reverts; nothing is saved. | ☐ |
| 6 | Reorder | Use the ↑ / ↓ arrows | Order changes immediately and the board columns follow after reload. First row has no ↑, last has no ↓. | ☐ |
| 7 | Add a stage | Type "Awaiting Finance", leave behaviour as *No side effects*, **Add stage** | Appears at the end of the list and as a new board column. Deals can be dragged into it. | ☐ |
| 8 | Add with behaviour | Add a stage set to *Reserves the car*, drag a deal in | The car is reserved, exactly as Deposit Taken would. | ☐ |
| 9 | Duplicate names refused | Add a stage named the same as an existing one | Error: "A … stage already exists". Nothing created. | ☐ |
| 10 | Hide a stage | Click **Hide** on a stage | It vanishes from the board but stays in Settings, greyed, with a **Show** button. | ☐ |
| 11 | Remove — warning first | Click the bin on a stage that has deals | Dialog states how many deals are in it and asks where to move them. Nothing happens until confirmed. | ☐ |
| 12 | Remove — deals migrate | Confirm the removal | Toast reports how many deals moved. Those deals are in the chosen stage, not lost. | ☐ |
| 13 | Built-in stages survive | Remove one of the seven shipped stages | It is **hidden**, not deleted — the dialog says so. Its deals still migrate. | ☐ |
| 14 | Custom stages delete | Remove a stage you added yourself | It's gone from Settings entirely. | ☐ |
| 15 | No self-target | Try to move a stage's deals into itself | Refused: "Pick a different stage to move deals into". | ☐ |
| 16 | Completed sales expire | Find a deal completed more than 14 days ago (adjust `completion_date` in test data) | It's gone from the pipeline board but still present in **Closed Deals** and the master sheet. | ☐ |
| 17 | Recently completed stay | A deal completed within 14 days | Still on the board. | ☐ |
| 18 | Orphaned deals survive | Hide a stage that still has deals in it (via SQL, bypassing the dialog) | Those deals fall into the first column rather than disappearing. | ☐ |
| 19 | Custom column styling | Look at a stage you added | It has its own accent colour, not an unstyled column. | ☐ |
| 20 | Move toast | Drag a deal between columns | Toast names the stage as displayed ("Moved → Qualified / Viewing"), not a raw slug. | ☐ |
