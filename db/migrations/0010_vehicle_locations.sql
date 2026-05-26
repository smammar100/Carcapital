-- ============================================================================
-- Migration 0010 — Vehicle Locations (Spec v3.0 · Module A · Phase 2.1)
-- ============================================================================
--
-- Every car has exactly one physical location at all times. The four valid
-- locations are FORECOURT / YARD / GARAGE / STAFF. Movements between
-- locations are audited via the `location_movements` table — Decisions
-- D-A1 (test-drive badge), D-A2 (one location at a time), D-A3 (single
-- aggregate Garage tab, workshop captured per movement).
--
-- Idempotent — every clause guarded with IF NOT EXISTS / DO blocks.
-- ----------------------------------------------------------------------------

-- 1. vehicles += location columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS current_location text NOT NULL DEFAULT 'forecourt',
  ADD COLUMN IF NOT EXISTS location_since timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS out_for_test_drive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_drive_expected_back_at timestamptz;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_current_location_check'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_current_location_check
      CHECK (current_location IN ('forecourt', 'yard', 'garage', 'staff'));
  END IF;
END $$;

-- Anchor pre-existing rows' "since" stamp to their original received_date so
-- "Days here" doesn't show "0d" for cars that have been on the forecourt
-- for months. Idempotent: only narrows future values, never widens.
UPDATE public.vehicles
   SET location_since = (received_date::timestamptz AT TIME ZONE 'UTC')
 WHERE received_date IS NOT NULL
   AND location_since > (received_date::timestamptz AT TIME ZONE 'UTC');

CREATE INDEX IF NOT EXISTS vehicles_current_location_idx
  ON public.vehicles (current_location);

COMMENT ON COLUMN public.vehicles.current_location IS
  '4-value location enum (forecourt/yard/garage/staff). NOT NULL — every car '
  'must be somewhere — Decision D-A2 (one location at a time).';
COMMENT ON COLUMN public.vehicles.out_for_test_drive IS
  'Transient flag set when an Appointment of type test_drive moves to '
  'in-progress (Decision D-A1). Not a location — the car keeps its forecourt '
  '(or wherever) location while out.';


-- 2. location_movements — audit table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.location_movements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id          uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  from_location       text,
  to_location         text NOT NULL,
  external_vendor_id  uuid REFERENCES public.vendors(id),
  staff_user_id       uuid REFERENCES public.users(id),
  expected_return_at  timestamptz,
  actual_return_at    timestamptz,
  notes               text,
  created_by          uuid NOT NULL REFERENCES public.users(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- CHECK constraints — each guarded so re-run is a no-op.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'location_movements_from_location_check') THEN
    ALTER TABLE public.location_movements
      ADD CONSTRAINT location_movements_from_location_check
      CHECK (from_location IS NULL OR from_location IN ('forecourt','yard','garage','staff'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'location_movements_to_location_check') THEN
    ALTER TABLE public.location_movements
      ADD CONSTRAINT location_movements_to_location_check
      CHECK (to_location IN ('forecourt','yard','garage','staff'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'location_movements_garage_requires_vendor') THEN
    ALTER TABLE public.location_movements
      ADD CONSTRAINT location_movements_garage_requires_vendor
      CHECK ((to_location = 'garage') = (external_vendor_id IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'location_movements_staff_requires_user') THEN
    ALTER TABLE public.location_movements
      ADD CONSTRAINT location_movements_staff_requires_user
      CHECK ((to_location = 'staff') = (staff_user_id IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS location_movements_vehicle_idx
  ON public.location_movements (vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS location_movements_destination_idx
  ON public.location_movements (to_location);

COMMENT ON TABLE public.location_movements IS
  'Append-only audit of every vehicle relocation — Spec v3.0 Module A. '
  'CHECK constraints enforce: garage moves carry an external_vendor_id; '
  'staff moves carry a staff_user_id.';


-- 3. RLS policies — tenancy via the parent vehicle's company_id.
-- ----------------------------------------------------------------------------
-- Without these, RLS denies every CRUD call from PostgREST with 403 (the
-- bug that surfaced in UAT round 1). Each policy reuses the existing
-- `current_company_id()` JWT helper.

DROP POLICY IF EXISTS location_movements_select ON public.location_movements;
CREATE POLICY location_movements_select
  ON public.location_movements FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.vehicles v
                  WHERE v.id = location_movements.vehicle_id
                    AND v.company_id = current_company_id()));

DROP POLICY IF EXISTS location_movements_insert ON public.location_movements;
CREATE POLICY location_movements_insert
  ON public.location_movements FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v
                       WHERE v.id = location_movements.vehicle_id
                         AND v.company_id = current_company_id()));

DROP POLICY IF EXISTS location_movements_update ON public.location_movements;
CREATE POLICY location_movements_update
  ON public.location_movements FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.vehicles v
                  WHERE v.id = location_movements.vehicle_id
                    AND v.company_id = current_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v
                       WHERE v.id = location_movements.vehicle_id
                         AND v.company_id = current_company_id()));

DROP POLICY IF EXISTS location_movements_delete ON public.location_movements;
CREATE POLICY location_movements_delete
  ON public.location_movements FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.vehicles v
                  WHERE v.id = location_movements.vehicle_id
                    AND v.company_id = current_company_id()));

-- ============================================================================
-- End migration 0010
-- ============================================================================
