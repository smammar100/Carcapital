-- ============================================================================
-- Migration 0005 — Richer Dealer Partner details (SPEC Points 6/7)
-- ============================================================================
--
-- Extends the 0002 dealer_partners table with the contact/company fields
-- the spec's partner detail page surfaces. Idempotent + additive; existing
-- rows + the dealer-partner SELECT stay valid (all nullable).
--
-- (vehicles.supplier_id from 0002 remains the partner ↔ vehicle link —
--  the spec's "dealerPartnerId" is the same concept.)
-- ----------------------------------------------------------------------------

ALTER TABLE public.dealer_partners
  ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.dealer_partners
  ADD COLUMN IF NOT EXISTS company_address text;

ALTER TABLE public.dealer_partners
  ADD COLUMN IF NOT EXISTS vat_number text;

ALTER TABLE public.dealer_partners
  ADD COLUMN IF NOT EXISTS notes text;

-- ============================================================================
-- End migration 0005
-- ============================================================================
