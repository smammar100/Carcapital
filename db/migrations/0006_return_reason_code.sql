-- ============================================================================
-- Migration 0006 — Structured return reason (SPEC Points 3/4)
-- ============================================================================
--
-- PR2 shipped a free-text `reason` on vehicle_returns. The spec wants a
-- structured reason category alongside the free-text detail. Additive +
-- idempotent; the existing free-text `reason` is reused as the detail, so
-- nothing breaks for already-recorded returns.
--
-- Deliberately NOT changing the existing `status` lifecycle enum — PR2's
-- pending/in_review/resolved/rejected flow is shipped + verified; an
-- enum overhaul here would churn live data for no functional gain.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vehicle_returns
  ADD COLUMN IF NOT EXISTS reason_code text
    CHECK (reason_code IN (
      'mechanical_fault',
      'misrepresentation',
      'finance_failure',
      'customer_change_of_mind',
      'cooling_off_period',
      'other'
    ));

COMMENT ON COLUMN public.vehicle_returns.reason_code IS
  'Structured return reason (SPEC Point 3). The existing free-text `reason` column carries the detail.';

-- ============================================================================
-- End migration 0006
-- ============================================================================
