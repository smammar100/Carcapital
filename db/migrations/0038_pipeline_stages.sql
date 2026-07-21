-- ============================================================================
-- Migration 0038 — Configurable sales pipeline stages (GEN-65)
-- ============================================================================
--
-- The pipeline's eight stages were hard-coded in two places: a CHECK constraint
-- on `sales_deals.stage` and a TypeScript constant. Renaming one, dropping one,
-- or adding one meant a deploy.
--
-- Stages now live in `pipeline_stages`, per company, seeded with exactly what
-- the app shipped with. Two changes agreed on the UAT call are applied to the
-- seed: "Offer Made" is gone, and the viewing stage reads "Qualified /
-- Viewing".
--
-- `behaviour` is the important column. `salesService.updateStage` drives real
-- side effects off the stage a deal lands in — reserving the car, stamping the
-- sale onto the vehicle, releasing a lost deal back to the forecourt. Keying
-- those off a slug meant a user-added stage could never participate; keying
-- them off `behaviour` means a new "Awaiting Finance" stage can be declared to
-- reserve the car, and a renamed stage keeps doing what it did.
--
-- Idempotent.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  slug        text NOT NULL,
  label       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 99,
  enabled     boolean NOT NULL DEFAULT true,
  -- What the app does when a deal enters this stage:
  --   open     — no side effects (the default for user-added stages)
  --   reserved — hold the car off the forecourt
  --   won      — complete the sale: stamp the vehicle sold, close the listing
  --   lost     — release the reservation
  behaviour   text NOT NULL DEFAULT 'open'
                CHECK (behaviour = ANY (ARRAY['open','reserved','won','lost'])),
  -- Seeded rows the app's own logic references. They can be renamed, reordered
  -- and disabled, but not deleted — a pipeline with no "won" stage can never
  -- complete a sale.
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);

CREATE INDEX IF NOT EXISTS pipeline_stages_company_order_idx
  ON public.pipeline_stages (company_id, sort_order);

-- Seed every company with the shipped pipeline, minus "Offer Made".
INSERT INTO public.pipeline_stages (company_id, slug, label, sort_order, behaviour, is_system)
SELECT c.id, s.slug, s.label, s.sort_order, s.behaviour, true
FROM public.companies c
CROSS JOIN (VALUES
  ('new_lead',            'New Lead',              1, 'open'),
  ('contacted',           'Contacted',             2, 'open'),
  ('test_drive',          'Qualified / Viewing',   3, 'open'),
  ('deposit_taken',       'Deposit Taken',         4, 'reserved'),
  ('collection_delivery', 'Collection / Delivery', 5, 'reserved'),
  ('completed_sale',      'Completed Sale',        6, 'won'),
  ('lost',                'Lost',                  7, 'lost')
) AS s(slug, label, sort_order, behaviour)
ON CONFLICT (company_id, slug) DO NOTHING;

-- Deals parked in the removed stage move to the one before it rather than
-- vanishing from the board — the same rule the Settings UI applies when a user
-- removes a stage by hand.
UPDATE public.sales_deals SET stage = 'test_drive' WHERE stage = 'offer_made';

-- The stage list is data now, so a fixed CHECK can only be wrong. Validity is
-- enforced against `pipeline_stages` in the service layer; the column stays
-- NOT NULL so a deal can never be stageless.
ALTER TABLE public.sales_deals
  DROP CONSTRAINT IF EXISTS sales_deals_stage_check;

COMMENT ON COLUMN public.sales_deals.stage IS
  'Slug of a row in pipeline_stages for this deal''s company. Not a fixed enum — stages are user-configurable (GEN-65).';

-- RLS: the same per-company catalogue policies lead_channels uses (0014).
-- Enabling RLS without policies is what made that table read back empty.
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pipeline_stages_select ON public.pipeline_stages;
CREATE POLICY pipeline_stages_select
  ON public.pipeline_stages FOR SELECT
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS pipeline_stages_insert ON public.pipeline_stages;
CREATE POLICY pipeline_stages_insert
  ON public.pipeline_stages FOR INSERT
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS pipeline_stages_update ON public.pipeline_stages;
CREATE POLICY pipeline_stages_update
  ON public.pipeline_stages FOR UPDATE
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS pipeline_stages_delete ON public.pipeline_stages;
CREATE POLICY pipeline_stages_delete
  ON public.pipeline_stages FOR DELETE
  USING (company_id = current_company_id());

-- ============================================================================
-- End migration 0038
-- ============================================================================
