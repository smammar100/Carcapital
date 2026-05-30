-- 0019 — AutoTrader stock-publish bookkeeping on listings.
--
-- When a listing is published to AutoTrader Connect (POST /stock), the API
-- returns a Stock ID we must store to update or de-list later. We also
-- track the advertising lifecycle + last sync result so the Work List can
-- show what's live on AutoTrader vs local-only.
--
-- Idempotent: every clause IF NOT EXISTS-guarded.

BEGIN;

ALTER TABLE listings ADD COLUMN IF NOT EXISTS at_stock_id text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS at_advertising_status text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS at_last_synced_at timestamptz;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS at_last_error text;

COMMENT ON COLUMN listings.at_stock_id IS
  'AutoTrader Stock ID returned by POST /stock. NULL until first published.';
COMMENT ON COLUMN listings.at_advertising_status IS
  'not_published | published — AutoTrader advertising-location state. V1 creates as not_published.';
COMMENT ON COLUMN listings.at_last_error IS
  'Last AutoTrader sync error message; NULL on success.';

NOTIFY pgrst, 'reload schema';

COMMIT;
