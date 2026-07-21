-- ============================================================================
-- Migration 0036 — Link a warranty back to the invoice that issued it (GEN-66)
-- ============================================================================
--
-- Closing a sales invoice declares the warranty cover the buyer is getting
-- (Section F of the two-page invoice), but nothing ever wrote a row into
-- `warranties` — so "in-house" cover vanished the moment the PDF downloaded.
--
-- The invoice is now the source of that record. `invoice_id` is what makes the
-- sync idempotent: re-issuing or editing the same invoice updates its warranty
-- instead of stacking up duplicates.
--
-- Idempotent.
-- ----------------------------------------------------------------------------

ALTER TABLE public.warranties
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.warranties.invoice_id IS
  'Sales invoice whose Warranty Declaration created this record. One warranty per invoice; null for warranties raised by hand from the Warranties module.';

-- One warranty per invoice — the uniqueness the sync relies on. Partial, so the
-- many hand-raised warranties (invoice_id null) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS warranties_invoice_id_key
  ON public.warranties (invoice_id)
  WHERE invoice_id IS NOT NULL;

-- ============================================================================
-- End migration 0036
-- ============================================================================
