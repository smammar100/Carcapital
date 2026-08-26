-- Migration 0045 — Backfill the stored vehicle cost totals (GEN-88)
-- ----------------------------------------------------------------------------
-- `total_buying_price`, `landed_cost`, `base_cost` and `gross_earning` are
-- stored columns. All Vehicles, the Master Sheet, the Overview KPIs and the
-- Reports page read them directly, but nothing kept them in step with the
-- costs they are derived from, so they had drifted.
--
-- The app contradicted itself as a result. AK69 HZH showed "Total expenses
-- £13,317.00" on the Financials tab and "Total cost £13,107.00" in All
-- Vehicles — the same car, the same session, £210 apart. The gap was the
-- loading fee, unloading fee and stocking charges: three lines the expense
-- ledger displays but the stored total never included.
--
-- Across the fleet: 108 of 117 vehicles had an understated `base_cost`,
-- £26,097 in total, up to £505 on a single car. Understating cost overstates
-- profit, so every margin the business read was flattering.
--
-- THE RULE, now single-sourced in src/lib/vehicle-costs.ts:
--   total_buying_price = buying + buyers + inspection + collection
--                        + delivery + late storage + other
--   landed_cost        = total_buying_price + loading + unloading + prep
--   base_cost          = landed_cost + stocking + warranty
--   gross_earning      = (selling_price ?? listing_price) - base_cost
--
-- `base_cost` is therefore the sum of exactly the twelve lines the Financials
-- ledger renders, so the stored figure and the on-screen total now agree by
-- construction rather than by coincidence.
--
-- REVERSIBILITY: the pre-backfill values are snapshotted into
-- `vehicle_cost_backfill_20260826` before anything is written. To roll back:
--
--   UPDATE public.vehicles v
--   SET total_buying_price = b.old_total_buying_price,
--       landed_cost        = b.old_landed_cost,
--       base_cost          = b.old_base_cost,
--       gross_earning      = b.old_gross_earning
--   FROM public.vehicle_cost_backfill_20260826 b
--   WHERE v.id = b.id;
--
-- Drop that table once the new figures have been signed off.
--
-- Applied to production on 2026-08-26. Verified afterwards: 0 of 117 rows
-- mismatched the ledger, no nulls, and the invariant
-- base_cost >= landed_cost >= total_buying_price held for every row.

CREATE TABLE IF NOT EXISTS public.vehicle_cost_backfill_20260826 AS
SELECT id,
       registration,
       total_buying_price AS old_total_buying_price,
       landed_cost        AS old_landed_cost,
       base_cost          AS old_base_cost,
       gross_earning      AS old_gross_earning,
       now()              AS snapshot_at
FROM public.vehicles;

UPDATE public.vehicles v
SET total_buying_price = c.new_tbp,
    landed_cost        = c.new_landed,
    base_cost          = c.new_base,
    gross_earning      = CASE
                           WHEN COALESCE(v.selling_price, v.listing_price) IS NULL THEN NULL
                           ELSE ROUND(COALESCE(v.selling_price, v.listing_price) - c.new_base)
                         END
FROM (
  SELECT id,
         (COALESCE(buying_price,0) + COALESCE(buyers_fee,0) + COALESCE(inspection_charge,0)
          + COALESCE(collection_fee,0) + COALESCE(delivery_fee,0) + COALESCE(late_storage_fee,0)
          + COALESCE(other_charges,0)) AS new_tbp,
         (COALESCE(buying_price,0) + COALESCE(buyers_fee,0) + COALESCE(inspection_charge,0)
          + COALESCE(collection_fee,0) + COALESCE(delivery_fee,0) + COALESCE(late_storage_fee,0)
          + COALESCE(other_charges,0)
          + COALESCE(loading_fee,0) + COALESCE(unloading_fee,0)
          + COALESCE(value_addition,0)) AS new_landed,
         (COALESCE(buying_price,0) + COALESCE(buyers_fee,0) + COALESCE(inspection_charge,0)
          + COALESCE(collection_fee,0) + COALESCE(delivery_fee,0) + COALESCE(late_storage_fee,0)
          + COALESCE(other_charges,0)
          + COALESCE(loading_fee,0) + COALESCE(unloading_fee,0)
          + COALESCE(value_addition,0)
          + COALESCE(stocking_charges,0) + COALESCE(warranty_cost,0)) AS new_base
  FROM public.vehicles
) c
WHERE v.id = c.id;
