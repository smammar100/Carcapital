-- 0018 — AutoTrader taxonomy + valuation fields on vehicles.
--
-- Populated by /api/vehicle/lookup from AutoTrader Connect. DVLA returns
-- model=null and no derivative/generation/trim; AutoTrader fills those.
-- Valuations are WHOLE GBP (not pence) — matching the existing
-- vehicles.listing_price convention (also whole £).
--
-- All nullable: AutoTrader may 404 for an unknown reg, and valuations only
-- come back when a mileage was supplied to the lookup.
--
-- Idempotent: every clause IF NOT EXISTS-guarded.

BEGIN;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS derivative text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS generation text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS trim text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS at_derivative_id text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS at_retail_valuation integer;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS at_trade_valuation integer;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS at_part_exchange_valuation integer;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS at_price_indicator text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS at_valuation_at timestamptz;

COMMENT ON COLUMN vehicles.derivative IS
  'AutoTrader derivative (e.g. "1.6 GDi SE Nav 5dr"). DVLA does not supply this.';
COMMENT ON COLUMN vehicles.at_derivative_id IS
  'AutoTrader stable taxonomy key — required when creating stock via POST /stock.';
COMMENT ON COLUMN vehicles.at_retail_valuation IS
  'AutoTrader retail valuation in WHOLE GBP (matches listing_price convention).';
COMMENT ON COLUMN vehicles.at_price_indicator IS
  'Derived Great/Good/Fair indicator (listing price vs retail valuation).';

NOTIFY pgrst, 'reload schema';

COMMIT;
