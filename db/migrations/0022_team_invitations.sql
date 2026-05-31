-- ============================================================================
-- Migration 0022 — Team invitations (targeted single-use invite links)
-- ============================================================================
--
-- Targeted, single-use invitations sent to a specific person's personal email.
-- Complements team_join_links (the shared reusable magic-link): the accept-join
-- route checks THIS table first, then falls back to team_join_links.
--
-- Each row is one invite: a unique token, the recipient's email (delivery only,
-- not a login credential), the role(s) to grant, a 7-day expiry, and used_at
-- (NULL = still valid; set when the invite is consumed).
--
-- Idempotent. RLS mirrors the team_join_links pattern (company-scoped via
-- current_company_id()) so the admin browser client can manage its own
-- company's invites. The unauthenticated /join consume path runs server-side
-- with the service-role key and bypasses RLS.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  token           text        NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  recipient_email text        NOT NULL,
  default_roles   text[]      NOT NULL DEFAULT '{view_only}',
  invited_by      uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_at         timestamptz
);

CREATE INDEX IF NOT EXISTS team_invitations_token_idx
  ON public.team_invitations (token);

CREATE INDEX IF NOT EXISTS team_invitations_company_idx
  ON public.team_invitations (company_id);

COMMENT ON TABLE public.team_invitations IS
  'Targeted single-use invites emailed to a specific recipient. Token is consumed '
  '(used_at set) on accept; 7-day expiry. Checked before team_join_links in /join.';

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_invitations_select ON public.team_invitations;
CREATE POLICY team_invitations_select ON public.team_invitations
  FOR SELECT USING (company_id = current_company_id());

DROP POLICY IF EXISTS team_invitations_insert ON public.team_invitations;
CREATE POLICY team_invitations_insert ON public.team_invitations
  FOR INSERT WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS team_invitations_update ON public.team_invitations;
CREATE POLICY team_invitations_update ON public.team_invitations
  FOR UPDATE USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS team_invitations_delete ON public.team_invitations;
CREATE POLICY team_invitations_delete ON public.team_invitations
  FOR DELETE USING (company_id = current_company_id());

-- ============================================================================
-- End migration 0022
-- ============================================================================
