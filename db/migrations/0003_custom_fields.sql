-- ============================================================================
-- Migration 0003 — Master Sheet Custom Fields (SPEC Point 1)
-- ============================================================================
--
-- Company-defined extra columns for vehicles. Definitions live in their own
-- table; per-vehicle values live in a JSONB map on `vehicles`, keyed by the
-- definition's immutable `field_key`.
--
-- Idempotent. RLS policies mirror the verified vendors / dealer_partners
-- pattern (company-scoped via current_company_id()) so the browser anon
-- client can read/write under RLS.
--
-- ----------------------------------------------------------------------------
-- 1. custom_field_definitions
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES public.companies(id),
  field_key            text NOT NULL,
  label                text NOT NULL,
  field_type           text NOT NULL
                         CHECK (field_type IN ('text','number','date',
                           'dropdown','multi_select','boolean','currency')),
  options              jsonb,                       -- string[] for (multi_)dropdown
  required             boolean NOT NULL DEFAULT false,
  show_in_master_sheet boolean NOT NULL DEFAULT false,
  show_in_arrival_form boolean NOT NULL DEFAULT false,
  display_order        integer NOT NULL DEFAULT 0,
  created_by           uuid REFERENCES public.users(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  archived_at          timestamptz,
  UNIQUE (company_id, field_key)
);

CREATE INDEX IF NOT EXISTS custom_field_definitions_company_idx
  ON public.custom_field_definitions (company_id, archived_at);

COMMENT ON TABLE public.custom_field_definitions IS
  'Company-defined extra vehicle columns. field_key is immutable; label is editable. archived_at soft-deletes (historical values preserved on vehicles.custom_fields).';

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_field_definitions_select ON public.custom_field_definitions;
CREATE POLICY custom_field_definitions_select ON public.custom_field_definitions
  FOR SELECT USING (company_id = current_company_id());

DROP POLICY IF EXISTS custom_field_definitions_insert ON public.custom_field_definitions;
CREATE POLICY custom_field_definitions_insert ON public.custom_field_definitions
  FOR INSERT WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS custom_field_definitions_update ON public.custom_field_definitions;
CREATE POLICY custom_field_definitions_update ON public.custom_field_definitions
  FOR UPDATE USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS custom_field_definitions_delete ON public.custom_field_definitions;
CREATE POLICY custom_field_definitions_delete ON public.custom_field_definitions
  FOR DELETE USING (company_id = current_company_id());

-- ----------------------------------------------------------------------------
-- 2. vehicles.custom_fields — JSONB value map keyed by field_key
-- ----------------------------------------------------------------------------

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.vehicles.custom_fields IS
  'Per-vehicle custom field values, keyed by custom_field_definitions.field_key. Archived definitions keep their values here.';

-- ============================================================================
-- End migration 0003
-- ============================================================================
