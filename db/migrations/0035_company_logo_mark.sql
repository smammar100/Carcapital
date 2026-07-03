-- ============================================================================
-- Migration 0035 — Company logo mark (sidebar) distinct from full logo
-- ============================================================================
--
-- A brand has two lockups. `logo_url` (migration-less, added in dashboard) is
-- the FULL logo + wordmark rendered on invoices. This adds `logo_mark_url` —
-- the compact SQUARE mark shown in the sidebar/navbar (falls back to the "CC"
-- initials avatar when unset). Both live in the public `company-logos` bucket
-- under `<company_id>/…`, already covered by the existing write policy.
--
-- Idempotent.
-- ----------------------------------------------------------------------------

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_mark_url text;

COMMENT ON COLUMN public.companies.logo_mark_url IS
  'Square logo mark shown in the sidebar/navbar. Distinct from logo_url (full logo + wordmark used on invoices).';

-- ============================================================================
-- End migration 0035
-- ============================================================================
