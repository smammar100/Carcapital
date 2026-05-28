-- 0017 — DVLA + DVSA compliance fields on vehicles.
--
-- Adds eight nullable columns the new /api/vehicle/lookup populates from
-- DVLA VES + DVSA MOT History. Every column is nullable because:
--   - DVLA frequently omits euroStatus + automatedVehicle.
--   - DVSA returns 404 for cars that have never been MOT-tested
--     (brand-new cars under 3 years old).
-- Existing rows back-fill to NULL — no historical data is invented.
--
-- Idempotent: every clause `IF NOT EXISTS`-guarded.

BEGIN;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS co2_emissions integer;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS euro_status text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tax_status text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS tax_due_date date;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS mot_status text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS wheelplan text;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS automated_vehicle boolean;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS date_of_last_v5c_issued date;

COMMENT ON COLUMN vehicles.co2_emissions IS
  'g/km — DVLA VES `co2Emissions` field. NULL for electrics or pre-2001 cars.';
COMMENT ON COLUMN vehicles.euro_status IS
  'DVLA VES `euroStatus` (e.g. EURO 6). Often NULL for older / niche cars.';
COMMENT ON COLUMN vehicles.tax_status IS
  'DVLA VES `taxStatus` — values: Taxed | Untaxed | SORN | Not Taxed for on Road Use.';
COMMENT ON COLUMN vehicles.tax_due_date IS
  'DVLA VES `taxDueDate` — next tax renewal due date.';
COMMENT ON COLUMN vehicles.mot_status IS
  'Derived from DVSA MOT History API — Valid | Not valid | No details held by DVLA.';
COMMENT ON COLUMN vehicles.wheelplan IS
  'DVLA VES `wheelplan` — e.g. "2 AXLE RIGID BODY".';
COMMENT ON COLUMN vehicles.automated_vehicle IS
  'DVLA VES `automatedVehicle` flag. Almost always NULL; rare TRUE for SAE L4+ approved vehicles.';
COMMENT ON COLUMN vehicles.date_of_last_v5c_issued IS
  'DVLA VES `dateOfLastV5CIssued`. Used for V5C-recency policy on private sales.';

-- Tell PostgREST to reload the schema cache so the new columns appear in
-- the SDK-generated typed client without a manual restart.
NOTIFY pgrst, 'reload schema';

COMMIT;
