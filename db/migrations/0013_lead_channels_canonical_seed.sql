-- ============================================================================
-- Migration 0013 — Lead Channel canonical seed + colour (Spec v3.0 · Module C)
-- ============================================================================
--
-- The 0009 migration created the lead_channels lookup table with a placeholder
-- 9-row seed (mine had "instagram" instead of the spec's "repeat_customer", no
-- colour column). Module C now pins the canonical 9 channels with their hex
-- colours so the Create Lead dropdown + the Lead Detail / Sales Pipeline chips
-- have proper visual identity.
--
-- This migration:
--   1. adds lead_channels.colour text (default neutral grey)
--   2. disables the placeholder "instagram" row (legacy seed mismatch)
--   3. upserts the canonical 9 (phone, website, walk_in, autotrader, ebay,
--      facebook, referral, repeat_customer, other) with display labels +
--      hex colours + display order per the Module C spec.
--
-- Idempotent (every clause guarded / ON CONFLICT). Safe to re-run.
-- Note: slug `autotrader` is kept (not renamed to `auto_trader`) so the
-- existing leads.source enum + the Lead.source TS union don't need a
-- breaking churn — only the display label changes.
-- ----------------------------------------------------------------------------

-- 1. colour column
-- ----------------------------------------------------------------------------
ALTER TABLE public.lead_channels
  ADD COLUMN IF NOT EXISTS colour text NOT NULL DEFAULT '#6B7280';

COMMENT ON COLUMN public.lead_channels.colour IS
  'Hex colour for the channel chip on Lead Detail + the dot on Sales Pipeline '
  'cards (Spec v3.0 · Module C · Phase 3.2). Editable via the admin surface.';


-- 2. Disable the placeholder "instagram" channel (not in canonical 9).
--    Super User can re-enable it from the admin surface (Phase 3.4) if needed.
-- ----------------------------------------------------------------------------
UPDATE public.lead_channels
   SET enabled    = false,
       updated_at = now()
 WHERE slug = 'instagram';


-- 3. Upsert the canonical 9 channels with proper labels, sort order, colours.
--    INSERT … SELECT against the (company_id, slug) UNIQUE makes this safe
--    against existing rows (they get re-labelled + re-coloured + enabled).
-- ----------------------------------------------------------------------------
WITH spec(slug, label, colour, sort_order) AS (VALUES
  ('phone',           'Phone',           '#2563EB', 1),
  ('website',         'Website',         '#0EA5E9', 2),
  ('walk_in',         'Walk-in',         '#16A34A', 3),
  ('autotrader',      'AutoTrader',      '#F59E0B', 4),
  ('ebay',            'eBay',            '#7C3AED', 5),
  ('facebook',        'Facebook',        '#1877F2', 6),
  ('referral',        'Referral',        '#EC4899', 7),
  ('repeat_customer', 'Repeat Customer', '#B6731E', 8),
  ('other',           'Other',           '#6B7280', 9)
)
INSERT INTO public.lead_channels
  (company_id, slug, label, sort_order, enabled, is_system, colour)
SELECT c.id, s.slug, s.label, s.sort_order, true, true, s.colour
  FROM public.companies c
  CROSS JOIN spec s
ON CONFLICT (company_id, slug) DO UPDATE
  SET label      = EXCLUDED.label,
      sort_order = EXCLUDED.sort_order,
      colour     = EXCLUDED.colour,
      enabled    = true,
      is_system  = true,
      updated_at = now();

-- ============================================================================
-- End migration 0013
-- ============================================================================
