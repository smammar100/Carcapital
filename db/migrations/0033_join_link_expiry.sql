-- ============================================================================
-- Migration 0033 — Join-link expiry, use-cap and revocation (security fix)
-- ============================================================================
--
-- The shared team_join_links magic-link previously never expired and had no
-- use cap: anyone who obtained the token could redeem it indefinitely
-- (SECURITY TODO in /api/team/accept-join). This migration adds:
--
--   * expires_at  — links die 72 hours after (re)creation; existing rows get
--                   a short 7-day fuse from migration time.
--   * max_uses    — optional redemption cap (NULL = uncapped within expiry).
--   * used_count  — redemptions so far, incremented by the accept-join route.
--   * revoked_at  — explicit kill-switch, independent of token rotation.
--
-- The accept-join route (service role) enforces all four; RLS policies from
-- 0007 are unchanged. Idempotent.
--
-- ----------------------------------------------------------------------------

BEGIN;

ALTER TABLE public.team_join_links
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_uses   integer,
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

-- Backfill pre-existing links with a short fuse so stale tokens in the wild
-- stop working soon, without instantly breaking a link an admin shared today.
UPDATE public.team_join_links
   SET expires_at = now() + interval '7 days'
 WHERE expires_at IS NULL;

-- New links default to a 72-hour lifetime; the service refreshes this on Reset.
ALTER TABLE public.team_join_links
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '72 hours');
ALTER TABLE public.team_join_links
  ALTER COLUMN expires_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'team_join_links_max_uses_positive'
       AND conrelid = 'public.team_join_links'::regclass
  ) THEN
    ALTER TABLE public.team_join_links
      ADD CONSTRAINT team_join_links_max_uses_positive
      CHECK (max_uses IS NULL OR max_uses > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.team_join_links.expires_at IS
  'Redemption deadline. Reset rotates the token AND refreshes this (+72h).';
COMMENT ON COLUMN public.team_join_links.max_uses IS
  'Optional cap on redemptions (NULL = uncapped until expiry).';
COMMENT ON COLUMN public.team_join_links.used_count IS
  'Successful redemptions; incremented server-side by /api/team/accept-join.';
COMMENT ON COLUMN public.team_join_links.revoked_at IS
  'Explicit revocation independent of rotation; non-NULL links reject redemption.';

COMMIT;

-- ============================================================================
-- End migration 0033
-- ============================================================================
