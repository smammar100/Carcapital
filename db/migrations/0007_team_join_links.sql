-- ============================================================================
-- Migration 0007 — Team join links (magic-link invite alternative)
-- ============================================================================
--
-- An email-free way to add members: each company has at most ONE reusable
-- join link. Anyone who opens it sets their own email + password and lands
-- in the company with `default_role` (View Only by default — an admin can
-- elevate them later in the permissions grid). "Reset" rotates the token,
-- instantly invalidating the old URL.
--
-- Idempotent. RLS mirrors the custom_field_definitions / dealer_partners
-- pattern (company-scoped via current_company_id()) so the browser anon
-- client can manage its own company's link. The unauthenticated /join
-- consume path runs server-side with the service-role key and bypasses RLS.
--
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_join_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id),
  token         text NOT NULL,
  default_role  text NOT NULL DEFAULT 'view_only',
  created_by    uuid REFERENCES public.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id),
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS team_join_links_token_idx
  ON public.team_join_links (token);

COMMENT ON TABLE public.team_join_links IS
  'One reusable magic-link per company. Visitors self-register with default_role; Reset rotates the token.';

ALTER TABLE public.team_join_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_join_links_select ON public.team_join_links;
CREATE POLICY team_join_links_select ON public.team_join_links
  FOR SELECT USING (company_id = current_company_id());

DROP POLICY IF EXISTS team_join_links_insert ON public.team_join_links;
CREATE POLICY team_join_links_insert ON public.team_join_links
  FOR INSERT WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS team_join_links_update ON public.team_join_links;
CREATE POLICY team_join_links_update ON public.team_join_links
  FOR UPDATE USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS team_join_links_delete ON public.team_join_links;
CREATE POLICY team_join_links_delete ON public.team_join_links
  FOR DELETE USING (company_id = current_company_id());

-- ============================================================================
-- End migration 0007
-- ============================================================================
