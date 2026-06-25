-- Migration 0030 — warranties.amount_paid
-- ----------------------------------------------------------------------------
-- The actual amount paid to the external provider when a warranty is marked
-- purchased. Previously `markPurchased` overwrote `cost_to_dealership` (the
-- margin cost basis) with this value, corrupting margin. Now stored separately.

ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS amount_paid numeric;
COMMENT ON COLUMN public.warranties.amount_paid IS
  'Actual amount paid to the external provider when the warranty was marked purchased (distinct from cost_to_dealership, the cost basis used for margin).';
