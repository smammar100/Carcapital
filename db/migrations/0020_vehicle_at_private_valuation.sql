-- 0020 — AutoTrader private-sale valuation on vehicles.
--
-- AutoTrader's /vehicles?valuations=true returns four figures: retail, trade,
-- partExchange, and private. Migration 0018 captured the first three; this adds
-- the private-sale value (what a private seller would achieve) so nothing the
-- lookup returns is dropped. WHOLE GBP, nullable (only present when a mileage
-- was supplied and AutoTrader has a valuation model for the vehicle).
--
-- Idempotent: IF NOT EXISTS-guarded.

BEGIN;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS at_private_valuation integer;

COMMENT ON COLUMN vehicles.at_private_valuation IS
  'AutoTrader private-sale valuation in WHOLE GBP (4th valuation, alongside retail/trade/part-exchange).';

NOTIFY pgrst, 'reload schema';

COMMIT;
