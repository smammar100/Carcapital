-- ============================================================================
-- Migration 0039 — Many payments per invoice, with a running balance (GEN-73)
-- ============================================================================
--
-- `invoice_payments` is ONE row per invoice (unique on invoice_id) holding a
-- single deposit figure, a single finance figure and a derived balance. There
-- was nowhere to put "took £500 today, £11,350 next Tuesday" — the second
-- payment had no home, so the balance never moved off the full amount.
--
-- This adds the ledger. `invoice_payments` is left exactly as it is: it still
-- carries the deposit and finance terms printed on the invoice, and the
-- vehicle-returns refund flow reads it. Receipts are what actually got paid.
--
-- Balance due = grand total − (deposit + finance + sum of receipts). The
-- deposit stays on the invoice rather than being backfilled into a receipt so
-- nothing that reads `invoice_payments` today changes meaning.
--
-- Idempotent.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.invoice_receipts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  -- Positive amounts only; a refund is its own credit invoice, not a negative
  -- receipt, so the running balance can never be argued backwards here.
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_on      date NOT NULL DEFAULT CURRENT_DATE,
  method       text CHECK (method = ANY (ARRAY['bank_transfer','cash','card','cheque','pdq'])),
  reference    text,
  notes        text,
  recorded_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_receipts_invoice_idx
  ON public.invoice_receipts (invoice_id, paid_on);

COMMENT ON TABLE public.invoice_receipts IS
  'Money actually received against an invoice, one row per payment. The deposit and finance terms stay on invoice_payments; balance due nets both off the grand total (GEN-73).';

-- RLS: same per-company catalogue shape as lead_channels (0014) and
-- pipeline_stages (0038). Enabling RLS without policies reads back empty.
ALTER TABLE public.invoice_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_receipts_select ON public.invoice_receipts;
CREATE POLICY invoice_receipts_select
  ON public.invoice_receipts FOR SELECT
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS invoice_receipts_insert ON public.invoice_receipts;
CREATE POLICY invoice_receipts_insert
  ON public.invoice_receipts FOR INSERT
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS invoice_receipts_update ON public.invoice_receipts;
CREATE POLICY invoice_receipts_update
  ON public.invoice_receipts FOR UPDATE
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS invoice_receipts_delete ON public.invoice_receipts;
CREATE POLICY invoice_receipts_delete
  ON public.invoice_receipts FOR DELETE
  USING (company_id = current_company_id());

-- ============================================================================
-- End migration 0039
-- ============================================================================
