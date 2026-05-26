-- ============================================================================
-- Migration 0012 — Extend activity_log.action_type CHECK
-- ============================================================================
-- Bug found in UAT round 1: the CHECK constraint added in the original
-- schema didn't include the 3 new action types introduced by Phase 1
-- foundation (`channel_changed`, `data_migrated`) and Module A
-- (`vehicle_moved`). Every move from the Move dialog persisted the
-- movement row + bumped vehicles.current_location but then crashed when
-- writing the activity-log audit entry, surfacing a misleading "Move
-- failed" toast.
--
-- Drop-and-create keeps the constraint name stable and is idempotent.
-- ----------------------------------------------------------------------------

ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_action_type_check;
ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'vehicle_arrived'::text,'vehicle_status_changed'::text,'vehicle_returned'::text,
    'inspection_started'::text,'inspection_completed'::text,
    'todo_added'::text,'todo_completed'::text,
    'maintenance_job_created'::text,'maintenance_job_completed'::text,'workshop_job_created'::text,
    'photo_uploaded'::text,'photo_processed'::text,
    'listing_created'::text,'listing_published'::text,
    'lead_created'::text,'lead_converted'::text,
    'appointment_booked'::text,'appointment_updated'::text,'appointment_completed'::text,
    'sale_stage_changed'::text,'sale_completed'::text,
    'warranty_created'::text,'warranty_claim_opened'::text,
    'invoice_created'::text,'invoice_sent'::text,'invoice_paid'::text,
    'cost_updated'::text,
    'user_invited'::text,'company_setting_changed'::text,
    -- Phase 1 foundation (Spec v3.0 · migrations 0009 / Module C / F)
    'channel_changed'::text,'data_migrated'::text,
    -- Module A · Vehicle Locations
    'vehicle_moved'::text
  ]));
