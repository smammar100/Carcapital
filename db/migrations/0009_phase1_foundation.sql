-- ============================================================================
-- Migration 0009 — Phase 1 foundation (Spec v3.0)
-- ============================================================================
--
-- Lands the data model every Phase 1 chunk (1.4 / 1.5 / 1.6) hooks into:
--
--   1. Rename Source → Purchase Source on vehicles                (Decision C-1)
--   2. Lead-channel lookup table + seed 9 channels                (Decision C-2)
--   3. leads.lead_channel_id FK + backfill from legacy source     (Chunk 1.4)
--   4. vehicles.legacy_data jsonb for master-sheet import         (Decision F-2)
--   5. is_demo boolean on the 5 tables the wipe step touches      (Chunk 1.5)
--   6. One-time backfill: mark every current seed row as is_demo  (Chunk 1.5)
--
-- Idempotent. Every clause is guarded — re-running the file is a no-op.
-- The one-time backfills are guarded with "column did not exist before"
-- checks so they fire exactly once, on the first apply.
-- RLS unchanged (inherits parent-table policies).
-- ----------------------------------------------------------------------------

-- 1. Rename vehicles.source_type → vehicles.purchase_source (C-1)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.vehicles'::regclass
       AND attname = 'source_type'
       AND NOT attisdropped
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_attribute
     WHERE attrelid = 'public.vehicles'::regclass
       AND attname = 'purchase_source'
       AND NOT attisdropped
  ) THEN
    ALTER TABLE public.vehicles RENAME COLUMN source_type TO purchase_source;
  END IF;
END $$;

COMMENT ON COLUMN public.vehicles.purchase_source IS
  'Where this car was bought (auction / private / trade_in / dealer / other). '
  'Renamed from source_type in 0009 to avoid collision with the new Lead Channel '
  'field on leads — Decision C-1 (Spec v3.0).';


-- 2. lead_channels lookup table  (C-2)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  slug        text NOT NULL,
  label       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  enabled     boolean NOT NULL DEFAULT true,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lead_channels_company_slug_key UNIQUE (company_id, slug)
);

CREATE INDEX IF NOT EXISTS lead_channels_company_idx
  ON public.lead_channels (company_id, sort_order)
  WHERE enabled IS TRUE;

-- RLS policies — tenancy via company_id directly. Without these, every
-- SDK read comes back empty even though the table holds the seeded rows
-- (bug F4 from the Module C UAT round; same shape as F1 on
-- location_movements).
DROP POLICY IF EXISTS lead_channels_select ON public.lead_channels;
CREATE POLICY lead_channels_select
  ON public.lead_channels FOR SELECT
  USING (company_id = current_company_id());

DROP POLICY IF EXISTS lead_channels_insert ON public.lead_channels;
CREATE POLICY lead_channels_insert
  ON public.lead_channels FOR INSERT
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS lead_channels_update ON public.lead_channels;
CREATE POLICY lead_channels_update
  ON public.lead_channels FOR UPDATE
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS lead_channels_delete ON public.lead_channels;
CREATE POLICY lead_channels_delete
  ON public.lead_channels FOR DELETE
  USING (company_id = current_company_id());

COMMENT ON TABLE public.lead_channels IS
  'Where the buyer came from (per-company catalogue). Seeded with 9 system '
  'channels in 0009 — Decision C-2. Super User can add/rename/disable from '
  '/admin/settings/lead-channels (Chunk 3.4). System rows have is_system=true '
  'so the UI can prevent deletion (still allowed to disable).';


-- 2b. Seed 9 system channels per existing company
-- ----------------------------------------------------------------------------
-- Placeholder slugs mirroring the existing LeadSource union (8 values) + a
-- 9th. Replaced/reordered by 0010_lead_channels_reseed.sql when Module_C
-- pins the canonical 9. INSERT … SELECT keeps it idempotent via the
-- (company_id, slug) UNIQUE.
INSERT INTO public.lead_channels (company_id, slug, label, sort_order, enabled, is_system)
SELECT c.id, x.slug, x.label, x.sort_order, true, true
  FROM public.companies c
  CROSS JOIN (VALUES
    ('website',    'Website',    1),
    ('phone',      'Phone',      2),
    ('walk_in',    'Walk-in',    3),
    ('autotrader', 'AutoTrader', 4),
    ('ebay',       'eBay',       5),
    ('facebook',   'Facebook',   6),
    ('instagram',  'Instagram',  7),
    ('referral',   'Referral',   8),
    ('other',      'Other',      9)
  ) AS x(slug, label, sort_order)
ON CONFLICT (company_id, slug) DO NOTHING;


-- 3. leads.lead_channel_id FK + backfill from legacy source
-- ----------------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_channel_id uuid
    REFERENCES public.lead_channels(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS leads_lead_channel_idx
  ON public.leads (lead_channel_id);

COMMENT ON COLUMN public.leads.lead_channel_id IS
  'FK to lead_channels — the channel the buyer came through. Replaces the '
  'free-text leads.source going forward (kept for backfill / audit).';

-- One-time backfill from leads.source slug → lead_channels row.
UPDATE public.leads l
   SET lead_channel_id = lc.id
  FROM public.lead_channels lc
 WHERE lc.company_id = l.company_id
   AND lc.slug = l.source
   AND l.lead_channel_id IS NULL;


-- 4. vehicles.legacy_data jsonb (F-2 — unmapped sheet columns archive)
-- ----------------------------------------------------------------------------
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS legacy_data jsonb;

COMMENT ON COLUMN public.vehicles.legacy_data IS
  'Unmapped Excel columns preserved one-way from the master-sheet import — '
  'Decision F-2 (Spec v3.0). Read-only after import.';


-- 5. is_demo flag on the 5 tables the wipe step touches (Chunk 1.5)
-- 5a. + 6. One-time backfill: every row that exists *before* the column is
--     added is seed data — mark it. Guarded by an "added in this run"
--     check so subsequent applies leave real rows untouched.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  col_exists boolean;
  tbl text;
  tables text[] := ARRAY['users','vehicles','leads','appointments','invoices'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name   = tbl
         AND column_name  = 'is_demo'
    ) INTO col_exists;

    IF NOT col_exists THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN is_demo boolean NOT NULL DEFAULT false', tbl
      );
      -- Everything in the DB at this exact moment is seed; mark it.
      -- Real-user / real-vehicle inserts after this migration default
      -- to is_demo = false and the Chunk 1.5 wipe leaves them alone.
      EXECUTE format(
        'UPDATE public.%I SET is_demo = true', tbl
      );
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS users_is_demo_idx        ON public.users (is_demo)        WHERE is_demo IS TRUE;
CREATE INDEX IF NOT EXISTS vehicles_is_demo_idx     ON public.vehicles (is_demo)     WHERE is_demo IS TRUE;
CREATE INDEX IF NOT EXISTS leads_is_demo_idx        ON public.leads (is_demo)        WHERE is_demo IS TRUE;
CREATE INDEX IF NOT EXISTS appointments_is_demo_idx ON public.appointments (is_demo) WHERE is_demo IS TRUE;
CREATE INDEX IF NOT EXISTS invoices_is_demo_idx     ON public.invoices (is_demo)     WHERE is_demo IS TRUE;

COMMENT ON COLUMN public.users.is_demo IS
  'True for the seed users that ship with the app — wiped on launch day '
  'before real-staff invites go out (Chunk 1.5). Real users default to false.';

-- ============================================================================
-- End migration 0009
-- ============================================================================
