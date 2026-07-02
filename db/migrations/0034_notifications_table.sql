-- ============================================================================
-- Migration 0034 — notifications table (repair schema drift)
-- ============================================================================
--
-- The notifications table was created directly in Supabase and never captured
-- as a migration: notification-service.ts and migration 0031 (realtime
-- publication) both depend on it, but a fresh environment built from
-- db/migrations alone would not have it. This backfills the DDL idempotently —
-- a no-op where the table already exists.
--
-- Columns mirror notification-service.ts's SELECT exactly.
--
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id),
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  title       text NOT NULL,
  body        text,
  link        text,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

COMMENT ON TABLE public.notifications IS
  'In-app notification bell items. Written server-side (service role) and by services; read via notification-service.ts filtered on user_id.';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users see and manage only their own notifications within their company.
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT USING (
    company_id = current_company_id() AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE USING (
    company_id = current_company_id() AND user_id = auth.uid()
  )
  WITH CHECK (
    company_id = current_company_id() AND user_id = auth.uid()
  );

-- No user INSERT/DELETE policies: rows are written server-side (service role
-- bypasses RLS) or by future service-role emitters; the bell only reads and
-- marks read.

-- ============================================================================
-- End migration 0034
-- ============================================================================
