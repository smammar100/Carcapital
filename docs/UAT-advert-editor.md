# UAT — Advert editor

Scope: the vehicle Advert editor and its save / publish pipeline. Files:
`src/components/advert/advert-editor.tsx`, `advert-preview.tsx`,
`feature-picker.tsx`; `src/lib/services/listing-service.ts`;
`src/lib/advert-completeness.ts`; `src/app/api/listing/generate-description/route.ts`;
`src/app/api/autotrader/stock/route.ts` + `autotrader-stock-mapper.ts`;
publish UI in `src/app/(dashboard)/advert/work-list/page.tsx`.

Route: **Vehicle → Listing tab → Edit Advert**, or `/vehicles/<id>/advert`.

## How publishing actually works (test against this model)
- **Save Advert** writes a **draft** to `listings` (`advert_data` JSON + title /
  description / price / `channels` toggles). It does **not** publish anywhere.
- **Channel toggles** (Car Capital UK / AutoTrader / eBay / Facebook) are just
  booleans on `listings.channels`.
- **Go-live differs per channel:**
  - **Car Capital UK website** — `listing.status="live"` + `channels.website`.
    The public site (thecarcapital.co.uk) is a **separate app/feed** that reads
    live listings; there is no public listing page in this repo.
  - **AutoTrader** — the only real integration. `POST /api/autotrader/stock`
    (triggered from **Work List**, not this editor) creates AT stock
    (`at_stock_id`). ⚠️ v1 creates every advert location as `NOT_PUBLISHED` and
    **omits images**, so it lands on AT but isn't live to buyers yet.
  - **eBay / Facebook** — toggles only, **no integration** (roadmap).
- **Formats differ per channel** — website card vs AutoTrader search-row vs eBay
  classified vs Facebook tile. Today's editor only previews the **website** card.

## Pre-reqs / known environment gaps
- Signed in with advert permission.
- **AI Generate and any `requireUser` route need `SUPABASE_SERVICE_ROLE_KEY` in
  `.env.local`.** Missing in this worktree → see Finding B.
- AI prose needs `OPENAI_API_KEY` / `LLM_API_KEY`; without it the route is meant
  to return a deterministic **template**.

---

## Header & status
| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Header identity | Open editor | Reg plate + year/make/model + price·spec line. | ☐ |
| 2 | Status pills | Fresh draft | "Limits OK" (green) + "Draft"; Preview + Save Advert buttons. | ☐ |
| 3 | Over-limit pill | Exceed any char limit (see #6) | Header flips to **"Over Character Limit"** (red), and back to "Limits OK" when corrected. | ✅ verified |
| 4 | Preview button | Click **Preview** | Opens the buyer-facing preview. | ☐ |

## AutoTrader Spotlight & character limits
| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 5 | Live counters | Type in Attention Grabber (30) / Key Selling Point (35) | Counter "n / max" updates live. | ✅ verified |
| 6 | Over-limit flag | Type 48 chars in Attention Grabber | Counter turns **red** "48 / 30"; header → "Over Character Limit"; live preview still shows full text (no hard cap). | ✅ verified |
| 7 | **Over-limit still saves** | With a field over limit, click **Save Advert** | ⚠️ Save **succeeds** ("Advert saved"); the 48-char value persists (the AutoTrader mapper later truncates the grabber to 30). Limit is advisory, not a blocker. See Finding A. | ✅ verified |
| 8 | All limited fields | Repeat for Description (3000), Strapline (999), Subtitle (500), each Highlight (40) | Each shows its own counter + turns red over limit; header reflects any over-limit field. | ☐ |

## Taxonomy
| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 9 | Pre-filled from vehicle | Open editor | Make/Model/Generation/Trim/Fuel/Engine/Transmission/Derivative pre-filled from the vehicle lookup; editable as AutoTrader overrides. | ✅ verified |
| 10 | Override persists | Edit a taxonomy field → Save → reload | Override is retained in `advert_data.taxonomy`. | ☐ |

## Vehicle Description (AI)
| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 11 | Generate (OpenAI) | Click **Generate** with `OPENAI_API_KEY` set | Description fills with AI copy (`source: openai`); counter updates. | ☐ |
| 12 | Generate (template fallback) | Click **Generate** with no LLM key but service key present | Returns a deterministic template description (`source: template`); no error. | ☐ |
| 13 | **Generate without service key** | Click **Generate** in an env missing `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ Currently **500 "Generation failed"** — the route's `requireUser()` throws before the template fallback. See Finding B. | ✅ verified (this env) |
| 14 | Clear text | Click **Clear text** | Description empties; counter → 0. | ☐ |
| 15 | Manual edit | Type a description | Persists on Save; completeness "Vehicle Description" flips to done (>30 chars). | ☐ |

## Dealer Strapline & Website Highlights
| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 16 | Use default | Click **Use default** | Strapline fills with the default dealer line. | ☐ |
| 17 | Subtitle | Type subtitle (500) | Counter + preview update. | ☐ |
| 18 | Highlights (5 max) | Fill highlights 01–05 | Each 40-char capped/flagged; shown as bullet checks in the preview. | ☐ |
| 19 | Empty highlights ignored | Leave some blank → Save | Blank highlights are dropped (joined as " • "); only filled ones persist. | ☐ |

## Equipment
| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 20 | Add feature | Click a catalogue chip | Moves to **SELECTED (n)**; "n features selected" updates; preview shows "+ n equipment features". | ✅ verified |
| 21 | Remove feature | Click × on a selected chip | Removed; count decrements. | ☐ |
| 22 | Clear all | Click **Clear all** | Selection empties. | ☐ |
| 23 | Search | Type in "Search features…" | Catalogue filters. | ☐ |
| 24 | Categories | View catalogue | Colour-coded Comfort / Exterior / Interior / Safety & Security / Other. | ✅ verified |
| 25 | Persist | Save → reload | Selected features persist in `advert_data.features`. | ✅ verified |

## Channels & Pricing
| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 26 | Advertised price | Edit price | Preview price + "Pricing & Floor" check reflect it. | ✅ verified |
| 27 | Floor read-only | Inspect Floor (minimum) | Shows `vehicle.minimumSalePrice`, not editable here. | ✅ verified |
| 28 | Toggle channels | Toggle Car Capital UK + AutoTrader on | Toggles flip; "Channels" completeness check flips from "None enabled" (warn) to done with the list; persists to `listings.channels`. | ✅ verified |
| 29 | All channels off | Turn every channel off → Save | "Channels" check shows warn "None enabled"; saves fine (draft). | ✅ verified |

## Live preview & completeness
| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 30 | Reactive preview | Edit grabber / price / equipment | Preview card updates in real time. | ✅ verified |
| 31 | Photos check source | Note the "Photos" check | ⚠️ Uses `vehicle.imagesCount` (AutoTrader listing image count, e.g. 51) — **not** dealer-uploaded photos. Same metric quirk as the Photos tab. See Finding C. | ✅ verified |
| 32 | 7-point checklist | Fill/clear fields | Each check shows done ✓ / warn ⚠ / miss ✗ with live progress "n of 7 ready". | ✅ verified |

## Save / publish
| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 33 | Save creates listing | First save on a vehicle with no listing | `ensureForVehicle` creates a draft; subsequent saves update it. | ☐ |
| 34 | Save persists | Save → reload | grabber / description / price / highlights / features / channels all reload from `advert_data`. | ✅ verified |
| 35 | Save keeps draft | Save | `status` stays **draft** — Save never publishes. | ✅ verified |
| 36 | Publish to live | (Work List) set listing live | `status="live"`, `published_at` set; logged in Activity. | ☐ |
| 37 | Publish to AutoTrader | (Work List) "Publish to AT" with capability | `POST /api/autotrader/stock` → `at_stock_id` stored; on failure `at_last_error` shown. ⚠️ locations `NOT_PUBLISHED` + images omitted in v1. | ☐ |
| 38 | AT publish permission | User without `listing:publish_autotrader` | No "Publish to AT" action. | ☐ |

## General / edge
| # | Test case | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 39 | Light + dark | Toggle theme | Form, preview, completeness, toggles all read correctly. | ☐ |
| 40 | Console clean | Open + edit + save | No console errors/hydration warnings (network 500 only when env gap in #13). | ☐ |
| 41 | Unsaved-changes nav | Edit, navigate away without saving | (Verify intended behaviour — warn, or silently discard.) | ☐ |
| 42 | Sold/reserved vehicle | Open advert for a sold vehicle | (Verify editor state — editable? locked?) | ☐ |

---

## Findings (verified live, 2026-06-20, CC-0004)
- **Finding A — over-limit saves through.** A 48-char Attention Grabber (limit
  30) shows the red counter + "Over Character Limit" header but **Save still
  succeeds** and persists 48 chars (confirmed in `listings.advert_data`). The
  AutoTrader mapper truncates the grabber to 30 on sync, but the website/preview
  use the untruncated value. Decide: hard-cap inputs, or block Save while over
  limit.
- **Finding B — AI Generate 500s without `SUPABASE_SERVICE_ROLE_KEY`.** Server
  log: `createAdminClient → requireUser → POST .../generate-description 500`.
  Because auth runs **before** the no-LLM template fallback, users without an
  OpenAI key *also* get a 500 if the service key is missing (instead of the
  intended template). Set the env var (and/or move the fallback ahead of auth).
- **Finding C — "Photos" completeness uses `vehicle.imagesCount`.** It reflects
  the AutoTrader listing image count (e.g. 51), not the dealer-uploaded
  `vehicle_photos`. Consistent with the Photos-tab badge note; align both if the
  intent is "real uploaded photos".

## What the three header controls actually do (verified 2026-06-21)
- **Save Advert** — persists the form to the `listings` table as a **draft**
  (creates the row via `ensureForVehicle` if none exists). Writes title,
  description, price, highlights→`specialFeatures`, channel booleans, and the
  full `advert_data`. It does **not** publish and does **not** change `status`
  (stays `draft`). That is its entire effect.
- **Preview** — an in-page anchor (`<a href="#preview">`) that scrolls to the
  "Live preview" panel. On desktop that panel is **already visible** in the
  right rail, so the button is effectively a **no-op** (only does anything on
  narrow screens where the rail stacks below the form). It does not open a
  buyer-facing page, new tab, or modal. Verified: clicking it only set the URL
  hash to `#preview`. → Rename to "Jump to preview", or make it open a real
  full-screen/buyer preview.
- **Limits OK / Over character limit** — pill driven solely by whether any
  AutoTrader-limited text field exceeds its max (grabber 30, KSP 35, description
  3000, strapline 999, subtitle 500, highlight 40). It is **advisory only** — it
  does not block Save and ignores price, photos, and required fields. It means
  "your text fits AutoTrader's field limits", nothing more.

## Unaddressed edge cases & gaps (verified 2026-06-21, CC-0004)
| # | Gap | Evidence | Severity |
|---|-----|----------|----------|
| G1 | **Negative price accepted** | Entered `-500` → preview + header show **"-£500.00"**; "Pricing & Floor" check stays **green/done**. | High — a negative price can render to buyers. |
| G2 | **No floor validation** | `-£500` (and any value < the £12,250 floor) saves with no warning; floor is display-only. | High — can advertise below the agreed minimum. |
| G3 | **Over-limit doesn't block Save** | 48-char grabber (limit 30) saved; AT mapper truncates to 30, preview/website keep 48. | Med. |
| G4 | **Preview button is a no-op on desktop** | Click only set `#preview`; preview already shown. | Low (UX/clarity). |
| G5 | **No publish / go-live on this page** | `save()` never sets `status`; no Publish control. Going live + AutoTrader sync live only in Work List. | Med — the editor implies publishing it can't do. |
| G6 | **Dead channel toggles** | eBay/Facebook have no integration; website/AutoTrader toggles here don't push anything (AT publish is in Work List). | Med — toggles imply publishing that never happens. |
| G7 | **AI Generate 500s without `SUPABASE_SERVICE_ROLE_KEY`** | Auth runs before the template fallback → 500 even for no-LLM users. | Med (env + ordering). |
| G8 | **Photos check counts `imagesCount`, not uploads** | Check shows "51 images" while only 7 photos are uploaded. A car with 0 real photos can read "done". | Med. |
| G9 | **No unsaved-changes guard** | Editing then Back/sidebar nav silently discards edits. | Med — data loss. |
| G10 | **Strapline over-limit feedback inconsistent** | Strapline >999 flips the header pill but its own counter never turns red (always muted). | Low. |
| G11 | **Save silently no-ops if auth not loaded** | `if (!company || !user) return;` — click does nothing, no toast. | Low. |
| G12 | **Clearing a taxonomy field writes a blank override** | Emptying Make/Model stores `""` in `advert_data.taxonomy`; preview/AT get blank values. | Low. |
| G13 | **Leading icons/prefixes hidden behind the Input** (systemic) | The `£` prefix on Advertised Price and the magnifier in the Equipment search were invisible — the updated `Input` renders an opaque wrapper (`bg-background`) that paints over any absolutely-positioned leading icon sibling (both at `z-auto`). Looked like "weird empty spacing" on the field's left. **Fixed on this view** (added `z-10` to the `£` and the equipment search icon). ~9 other search inputs across the app use the same pattern and are likely affected — see list below. | Med (visual, app-wide). |

### G13 — other call sites with the same pattern (leading icon, no `z-10`)
`src/components/admin/edit-roles-dialog.tsx:108`, `add-staff-dialog.tsx:275`,
`invite-team-members-dialog.tsx:446`, `src/components/enquiries/customer-search-step.tsx:58`,
`src/components/vehicles/arrival-form.tsx:818`, `src/components/locations/location-tab.tsx:223`,
`src/app/(dashboard)/warranties/in-house/page.tsx:153`, `warranties/external/page.tsx:163`,
`src/app/(dashboard)/admin/invoicing/page.tsx:448`. Fix = add `z-10` (and `pointer-events-none`)
to each leading `<Search …>` icon, or give the `Input` component a real icon/prefix slot.

## Verified during this pass
#3, #5, #6, #7, #9, #20, #24, #25, #26, #27, #28, #29, #30, #31, #32, #34, #35 —
exercised live and confirmed (DB-checked: `channels`, `advert_data.features`,
`advert_data.attentionGrabber`, `status` draft). Test data restored to a clean
draft afterward.
