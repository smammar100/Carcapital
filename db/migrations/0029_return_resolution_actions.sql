-- Migration 0029 — Extend activity_log.action_type CHECK
-- ----------------------------------------------------------------------------
-- Adds first-class return-resolution action types so the Activity Log can
-- distinguish a return being resolved/rejected from the original return:
--   • return_resolved — Vehicle Returns › Approve & refund
--   • return_rejected — Vehicle Returns › Reject
-- Previously these were logged as 'vehicle_status_changed' with metadata.
-- Redefines the constraint with the full set.

ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_action_type_check;
ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'vehicle_arrived'::text,'vehicle_status_changed'::text,'vehicle_returned'::text,
    'return_resolved'::text,'return_rejected'::text,
    'inspection_started'::text,'inspection_completed'::text,
    'todo_added'::text,'todo_completed'::text,
    'maintenance_job_created'::text,'maintenance_job_completed'::text,'workshop_job_created'::text,
    'photo_uploaded'::text,'photo_processed'::text,
    'listing_created'::text,'listing_published'::text,'listing_deleted'::text,
    'lead_created'::text,'lead_converted'::text,'lead_status_changed'::text,
    'appointment_booked'::text,'appointment_updated'::text,'appointment_completed'::text,
    'sale_stage_changed'::text,'sale_completed'::text,
    'warranty_created'::text,'warranty_purchased'::text,'warranty_cancelled'::text,
    'warranty_claim_opened'::text,
    'invoice_created'::text,'invoice_sent'::text,'invoice_paid'::text,
    'cost_updated'::text,
    'user_invited'::text,'company_setting_changed'::text,
    'channel_changed'::text,'data_migrated'::text,'vehicle_moved'::text,
    'external_invoice_created'::text,'external_invoice_updated'::text,
    'external_invoice_deleted'::text
  ]));
