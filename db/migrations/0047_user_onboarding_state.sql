-- 0047_user_onboarding_state.sql
--
-- Tracks whether a user has been through the guided product tour.
--
-- Stored per account rather than in localStorage so the tour follows the
-- person, not the browser: staff who first sign in on the workshop terminal
-- should not be shown it again on their phone.
--
-- NULL means "never taken", which is why the column is nullable with no
-- default — every existing account reads as un-onboarded and gets the tour on
-- their next dashboard visit. Skipping writes a timestamp too: the user made a
-- decision, and re-prompting someone who dismissed it is how a tour becomes an
-- irritation. The Help menu can always restart it.
--
-- ROLLBACK
--   alter table public.users drop column onboarding_completed_at;

alter table public.users
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.users.onboarding_completed_at is
  'When the user finished (or skipped) the guided product tour. NULL = never taken, so the tour auto-starts on their next dashboard visit.';
