-- ============================================================================
-- Migration 0002 — Dealer Partners (trade stock suppliers)
-- ============================================================================
--
-- PR3 of the multi-module overhaul. Models the trade partners who supply
-- stock to sell, and links each vehicle to the partner it came from.
--
-- HOW TO APPLY
--   Run in the Supabase SQL editor (or psql) against the live project.
--   Idempotent — re-running is safe. The app guards every read/write so an
--   un-applied migration cannot break the existing Vendors / Vehicles pages
--   (the Dealer Partners tab just shows an empty list until this is run).
--
-- ----------------------------------------------------------------------------
-- 1. dealer_partners — the trade partners who provide us stock
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.dealer_partners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id),
  name         text NOT NULL,
  phone        text,
  company_name text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dealer_partners_company_active_idx
  ON public.dealer_partners (company_id, active);

COMMENT ON TABLE public.dealer_partners IS
  'Trade partners who supply stock to sell. Distinct from `vendors` (service garages) — different lifecycle.';

-- RLS: mirror whatever policy `vendors` uses. If your project has RLS on
-- public tables, add equivalent policies here. Example (uncomment + adjust
-- to match your existing company-scoped policy pattern):
--
--   ALTER TABLE public.dealer_partners ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY dealer_partners_company_rw ON public.dealer_partners
--     USING (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()))
--     WITH CHECK (company_id = (SELECT company_id FROM public.users WHERE id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 2. vehicles.supplier_id — which dealer partner this vehicle came from
-- ----------------------------------------------------------------------------

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.dealer_partners(id);

COMMENT ON COLUMN public.vehicles.supplier_id IS
  'The dealer partner this vehicle was sourced from. NULL for private-seller / unmatched stock.';

-- ----------------------------------------------------------------------------
-- 3. Backfill — RUN AFTER you have seeded dealer_partners rows
-- ----------------------------------------------------------------------------
--
-- Matches existing vehicles to partners by an exact case-insensitive,
-- trimmed name match against the freetext `vehicles.seller_name`. This is
-- intentionally conservative: anything that does not match exactly stays
-- NULL (private sellers, typos, auction houses) and can be assigned by hand
-- from the Dealer Partners UI. Re-runnable.
--
--   UPDATE public.vehicles v
--   SET    supplier_id = dp.id
--   FROM   public.dealer_partners dp
--   WHERE  dp.company_id = v.company_id
--     AND  v.supplier_id IS NULL
--     AND  lower(btrim(v.seller_name)) = lower(btrim(dp.name));
--
-- After running, sanity-check how many matched vs. stayed NULL:
--
--   SELECT count(*) FILTER (WHERE supplier_id IS NOT NULL) AS matched,
--          count(*) FILTER (WHERE supplier_id IS NULL)     AS unmatched
--   FROM public.vehicles;
--
-- ============================================================================
-- End migration 0002
-- ============================================================================
