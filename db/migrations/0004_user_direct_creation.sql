-- ============================================================================
-- Migration 0004 — Direct user creation + forced first-login reset (Point 2)
-- ============================================================================
--
-- Layered on the shipped create-with-password route (PR3). Adds the flags
-- the forced-password-change flow needs. Idempotent; all additive with
-- safe defaults so existing rows + the auth hydrate SELECT stay valid.
--
-- ----------------------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS creation_mode text NOT NULL DEFAULT 'invite'
    CHECK (creation_mode IN ('invite','direct'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_reset_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

COMMENT ON COLUMN public.users.password_reset_required IS
  'true for directly-created users until they set their own password on first login (SPEC Point 2).';
COMMENT ON COLUMN public.users.creation_mode IS
  'invite = email-invite flow; direct = admin created with a temp password.';
COMMENT ON COLUMN public.users.activated_at IS
  'When a directly-created user first set their own password.';

-- ============================================================================
-- End migration 0004
-- ============================================================================
