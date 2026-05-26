-- ============================================================================
-- Migration 0014 — lead_channels RLS policies (Spec v3.0 · Module C bug F4)
-- ============================================================================
--
-- Migration 0009 created the lead_channels table with RLS enabled (Supabase
-- default) but **no policies**, so every SDK read came back empty even
-- though the table held the seeded canonical 9. The Create Lead dropdown
-- showed zero options as a result (matches the F1 bug shape on
-- location_movements — same RLS-without-policies anti-pattern).
--
-- This migration adds the 4 standard CRUD policies. lead_channels is a
-- per-company catalogue, so tenancy is direct via `company_id`.
--
-- Idempotent (DROP IF EXISTS before each CREATE).
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS lead_channels_select ON public.lead_channels;
CREATE POLICY lead_channels_select
  ON public.lead_channels FOR SELECT
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS lead_channels_insert ON public.lead_channels;
CREATE POLICY lead_channels_insert
  ON public.lead_channels FOR INSERT
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS lead_channels_update ON public.lead_channels;
CREATE POLICY lead_channels_update
  ON public.lead_channels FOR UPDATE
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS lead_channels_delete ON public.lead_channels;
CREATE POLICY lead_channels_delete
  ON public.lead_channels FOR DELETE
  USING (company_id = current_company_id());

-- ============================================================================
-- End migration 0014
-- ============================================================================
