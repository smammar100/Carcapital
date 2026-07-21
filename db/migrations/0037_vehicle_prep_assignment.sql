-- ============================================================================
-- Migration 0037 — Prep & Repair assignment (GEN-63)
-- ============================================================================
--
-- A car entering Prep & Repair starts "Unassigned" and stays that way until
-- someone picks it up. That needs a real owner on the vehicle: the per-check
-- maintenance jobs each carry their own `assigned_to`, but the car as a whole
-- had nobody, so "Unassigned" had nothing to be the absence of.
--
-- Idempotent.
-- ----------------------------------------------------------------------------

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS prep_assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.vehicles.prep_assigned_to IS
  'Who owns this car through Prep & Repair. Null = Unassigned, the state every car enters the queue in when its inspection completes.';

CREATE INDEX IF NOT EXISTS vehicles_prep_assigned_to_idx
  ON public.vehicles (prep_assigned_to)
  WHERE prep_assigned_to IS NOT NULL;

-- Assignment is an auditable hand-off, so it needs its own action type rather
-- than borrowing `cost_updated` (which is what a generic vehicle update logs).
ALTER TABLE public.activity_log
  DROP CONSTRAINT IF EXISTS activity_log_action_type_check;

ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_action_type_check CHECK (action_type = ANY (ARRAY[
    'vehicle_arrived', 'vehicle_status_changed', 'vehicle_returned',
    'return_resolved', 'return_rejected',
    'inspection_started', 'inspection_completed',
    'todo_added', 'todo_completed',
    'prep_assigned',
    'maintenance_job_created', 'maintenance_job_completed', 'workshop_job_created',
    'photo_uploaded', 'photo_processed',
    'listing_created', 'listing_published', 'listing_deleted',
    'lead_created', 'lead_converted', 'lead_status_changed',
    'appointment_booked', 'appointment_updated', 'appointment_completed',
    'sale_stage_changed', 'sale_completed',
    'warranty_created', 'warranty_purchased', 'warranty_cancelled',
    'warranty_claim_opened',
    'invoice_created', 'invoice_sent', 'invoice_paid',
    'cost_updated', 'user_invited', 'company_setting_changed', 'channel_changed',
    'data_migrated', 'vehicle_moved',
    'external_invoice_created', 'external_invoice_updated', 'external_invoice_deleted'
  ]::text[]));

-- ============================================================================
-- End migration 0037
-- ============================================================================
