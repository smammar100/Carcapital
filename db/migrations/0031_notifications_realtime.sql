-- Migration 0031 — add notifications to the realtime publication
-- ----------------------------------------------------------------------------
-- The notification bell now subscribes via useRealtimeTable (filtered on
-- user_id) so new notifications appear live. That only fires if the table is
-- part of the supabase_realtime publication. Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;
