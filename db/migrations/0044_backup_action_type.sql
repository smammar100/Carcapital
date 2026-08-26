-- Migration 0044 — Realign activity_log.action_type CHECK with the code
-- ----------------------------------------------------------------------------
-- Adds the action type used by the user-triggered data backup (GEN-90):
--   • data_backup_created — Settings › Backup "Download data" action
--
-- The backup feature reads the most recent entry of this type to work out when
-- the last backup was taken, which is what drives the weekly reminder. Without
-- it the audit INSERT is rejected by the CHECK and the reminder can never
-- reset (the export itself still succeeds — it is recorded best-effort).
--
-- This also repairs a drift found while applying the above: the constraint as
-- last written (0027) was missing several action types that the application
-- had since started writing — `prep_assigned`, `warranty_purchased`,
-- `deal_note_added`, `return_rejected`, `return_resolved`,
-- `warranty_cancelled`. Rebuilding the constraint from 0027's list therefore
-- failed against existing rows. The list below is generated from the
-- `ActivityActionType` union in src/lib/types.ts, which is the authority, so
-- the database and the code now agree.

ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_action_type_check;
ALTER TABLE public.activity_log
  ADD CONSTRAINT activity_log_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'appointment_booked'::text,'appointment_completed'::text,'appointment_updated'::text,
    'channel_changed'::text,'company_setting_changed'::text,'cost_updated'::text,
    'data_backup_created'::text,'data_migrated'::text,'deal_note_added'::text,
    'external_invoice_created'::text,'external_invoice_deleted'::text,'external_invoice_updated'::text,
    'inspection_completed'::text,'inspection_started'::text,
    'invoice_created'::text,'invoice_paid'::text,'invoice_sent'::text,
    'lead_converted'::text,'lead_created'::text,'lead_status_changed'::text,
    'listing_created'::text,'listing_deleted'::text,'listing_published'::text,
    'maintenance_job_completed'::text,'maintenance_job_created'::text,
    'photo_processed'::text,'photo_uploaded'::text,'prep_assigned'::text,
    'return_rejected'::text,'return_resolved'::text,
    'sale_completed'::text,'sale_stage_changed'::text,
    'todo_added'::text,'todo_completed'::text,'user_invited'::text,
    'vehicle_arrived'::text,'vehicle_moved'::text,'vehicle_returned'::text,'vehicle_status_changed'::text,
    'warranty_cancelled'::text,'warranty_claim_opened'::text,'warranty_created'::text,'warranty_purchased'::text,
    'workshop_job_created'::text
  ]));
