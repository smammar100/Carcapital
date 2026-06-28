-- ============================================================================
-- Migration 0032 — AutoTrader Advertisers mirror (Go-Live: Advertisers API +
--                   Advertiser update notifications)
-- ============================================================================
--
-- Mirrors the dealers ("advertisers") configured on our AutoTrader Connect
-- integration. Populated two ways:
--   1. Sync — POST /api/autotrader/advertisers pages the Advertisers API and
--      upserts every advertiser (sets synced_at).
--   2. Notifications — POST /api/webhooks/autotrader receives an ADVERTISER
--      update notification and refreshes the row (sets at_updated_at).
--
-- INTEGRATION-GLOBAL, NOT company-scoped: the AutoTrader credentials are a
-- single app-level set (AUTOTRADER_KEY/SECRET/ADVERTISER_ID env), so the
-- advertiser list belongs to the integration, not to any one Car Capital
-- company. Access is gated in the API route by the `advertiser:read` /
-- `advertiser:sync` capabilities and served via the service-role client.
--
-- RLS is enabled with NO permissive policy → denied by default for the
-- anon/auth clients; the service-role key (used only by the server routes)
-- bypasses RLS. This keeps the table unreadable from the browser directly.
--
-- Idempotent.
-- ----------------------------------------------------------------------------

BEGIN;

CREATE TABLE IF NOT EXISTS public.at_advertisers (
  advertiser_id   text PRIMARY KEY,
  name            text,
  status          text,
  postcode        text,
  products        jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw             jsonb,
  -- Last time this row was pulled from the Advertisers API (sync).
  synced_at       timestamptz,
  -- Last time an ADVERTISER update notification touched this row (webhook).
  at_updated_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS at_advertisers_status_idx
  ON public.at_advertisers (status);
CREATE INDEX IF NOT EXISTS at_advertisers_synced_at_idx
  ON public.at_advertisers (synced_at DESC);

COMMENT ON TABLE public.at_advertisers IS
  'Dealers (advertisers) on our AutoTrader Connect integration. '
  'Integration-global (single app-level credential set), not company-scoped. '
  'Populated by the Advertisers API sync and ADVERTISER update notifications.';
COMMENT ON COLUMN public.at_advertisers.synced_at IS
  'Last pull from the Advertisers API (POST /api/autotrader/advertisers).';
COMMENT ON COLUMN public.at_advertisers.at_updated_at IS
  'Last ADVERTISER update notification (POST /api/webhooks/autotrader).';

-- RLS: deny-by-default. Only the service-role server routes touch this table.
ALTER TABLE public.at_advertisers ENABLE ROW LEVEL SECURITY;
-- (Intentionally no SELECT/INSERT/UPDATE policy — service role bypasses RLS.)

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- End migration 0032
-- ============================================================================
