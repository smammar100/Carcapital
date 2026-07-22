-- ============================================================================
-- Migration 0042 — Configurable inspection checklist (GEN-78)
-- ============================================================================
--
-- The 20-point inspection checklist was a hard-coded TypeScript constant
-- (INSPECTION_ITEMS). Adding, renaming or removing a point meant a deploy.
--
-- Items now live in `inspection_checklist_items`, per company, seeded with
-- exactly what the app shipped with. Mirrors the `pipeline_stages` pattern
-- (0038): a stable `number` is the identity that `inspection_checks.
-- check_number` already stores, `sort_order` is the independently-editable
-- display position.
--
-- Unlike pipeline stages, nothing in the app keys logic off a specific
-- checklist item's identity — there's no "system item" concept here, items
-- can be freely added, edited, reordered and deleted. `inspection_checks`
-- rows are historical snapshots (they carry their own `check_item` text and
-- `status`), so deleting a checklist item never touches inspections already
-- recorded — it only stops that point appearing on inspections started
-- afterwards.
--
-- Idempotent.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inspection_checklist_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  number          integer NOT NULL,
  item            text NOT NULL,
  status_options  text[] NOT NULL,
  sort_order      integer NOT NULL DEFAULT 99,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, number)
);

CREATE INDEX IF NOT EXISTS inspection_checklist_items_company_order_idx
  ON public.inspection_checklist_items (company_id, sort_order);

-- Seed every company with the shipped 20-point checklist.
INSERT INTO public.inspection_checklist_items
  (company_id, number, item, status_options, sort_order)
SELECT c.id, s.number, s.item, s.status_options, s.number
FROM public.companies c
CROSS JOIN (VALUES
  (1,  'MOT Expiry',              ARRAY['Valid','Expiring Soon','Expired','N/A']),
  (2,  'Oil Condition',           ARRAY['Good','Fair','Poor','Needs Replacing']),
  (3,  'Coolant / Other Fluids',  ARRAY['Good','Low','Contaminated']),
  (4,  'General Body Work',       ARRAY['Good','Minor Damage','Major Damage']),
  (5,  'Tyres Condition',         ARRAY['Good','Fair','Replace']),
  (6,  'Spare Wheel',             ARRAY['Present','Missing','Space Saver']),
  (7,  'Lock Nut',                ARRAY['Present','Missing']),
  (8,  'Key Battery',             ARRAY['Good','Low','Dead']),
  (9,  'Ignition / Battery',      ARRAY['Good','Weak','Needs Replacing']),
  (10, 'Warning Lights',          ARRAY['None','Active']),
  (11, 'Speedo / Odo (mph)',      ARRAY['Working','Faulty']),
  (12, 'Engine Noise',            ARRAY['Normal','Abnormal']),
  (13, 'Under Body Noise',        ARRAY['Normal','Abnormal']),
  (14, 'Gearbox Observe',         ARRAY['Smooth','Rough','Slipping']),
  (15, 'Wipers',                  ARRAY['Working','Faulty','Needs Replacing']),
  (16, 'Exterior Lights',         ARRAY['All Working','Faulty']),
  (17, 'Radio / Nav',             ARRAY['Working','Faulty','Missing']),
  (18, 'AirCon Working',          ARRAY['Yes','No','Weak']),
  (19, 'Interior Condition',      ARRAY['Good','Fair','Poor']),
  (20, 'Test Drive',              ARRAY['Pass','Fail','Pending'])
) AS s(number, item, status_options)
ON CONFLICT (company_id, number) DO NOTHING;

ALTER TABLE public.inspection_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inspection_checklist_items_select ON public.inspection_checklist_items;
CREATE POLICY inspection_checklist_items_select
  ON public.inspection_checklist_items FOR SELECT
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS inspection_checklist_items_insert ON public.inspection_checklist_items;
CREATE POLICY inspection_checklist_items_insert
  ON public.inspection_checklist_items FOR INSERT
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS inspection_checklist_items_update ON public.inspection_checklist_items;
CREATE POLICY inspection_checklist_items_update
  ON public.inspection_checklist_items FOR UPDATE
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS inspection_checklist_items_delete ON public.inspection_checklist_items;
CREATE POLICY inspection_checklist_items_delete
  ON public.inspection_checklist_items FOR DELETE
  USING (company_id = current_company_id());

-- ============================================================================
-- End migration 0042
-- ============================================================================
