-- ============================================================================
-- Migration 0015 — External / Purchase Invoices (Spec v3.0 · Module D)
-- ============================================================================
--
-- Adds the third invoicing surface — inbound invoices the dealership
-- receives:
--   1. auction_purchase — BCA-style purchase invoices for a vehicle
--   2. external_job    — third-party workshop invoices for a vehicle
--
-- Includes:
--   - external_invoices table with generated pre_vat_pence, FK to
--     vendors + vehicles + users.created_by, indices, RLS policies
--     (company_id derived via the parent vehicle).
--   - Supabase Storage bucket `external-invoices` (private, 10 MB cap,
--     JPG/PNG/PDF only) + RLS policies on storage.objects.
--   - Extends activity_log CHECK with `external_invoice_created`.
--
-- Idempotent. RLS uses the existing `current_company_id()` JWT helper
-- (same pattern as location_movements / lead_channels).
-- ----------------------------------------------------------------------------

-- 1. external_invoices table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_invoices (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_kind           text NOT NULL,
  invoice_number         text,
  vendor_id              uuid NOT NULL REFERENCES public.vendors(id),
  vehicle_id             uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  invoice_date           date NOT NULL,
  total_pence            integer NOT NULL,
  vat_pence              integer NOT NULL DEFAULT 0,
  pre_vat_pence          integer GENERATED ALWAYS AS (total_pence - vat_pence) STORED,
  description            text NOT NULL,
  notes                  text,
  attachment_url         text,
  attachment_filename    text,
  attachment_size_bytes  integer,
  attachment_mime_type   text,
  created_by             uuid NOT NULL REFERENCES public.users(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'external_invoices_kind_check') THEN
    ALTER TABLE public.external_invoices
      ADD CONSTRAINT external_invoices_kind_check
      CHECK (invoice_kind IN ('auction_purchase','external_job'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'external_invoices_total_nonneg') THEN
    ALTER TABLE public.external_invoices
      ADD CONSTRAINT external_invoices_total_nonneg CHECK (total_pence >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'external_invoices_vat_nonneg') THEN
    ALTER TABLE public.external_invoices
      ADD CONSTRAINT external_invoices_vat_nonneg CHECK (vat_pence >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'external_invoices_vat_within_total') THEN
    ALTER TABLE public.external_invoices
      ADD CONSTRAINT external_invoices_vat_within_total CHECK (vat_pence <= total_pence);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS external_invoices_vehicle_idx
  ON public.external_invoices (vehicle_id);
CREATE INDEX IF NOT EXISTS external_invoices_kind_date_idx
  ON public.external_invoices (invoice_kind, invoice_date DESC);

COMMENT ON TABLE public.external_invoices IS
  'Inbound invoices the dealership receives — auction purchases (BCA etc.) '
  'and external workshop jobs (Spec v3.0 · Module D).';

-- 2. RLS policies (tenancy via the parent vehicle's company_id)
-- ----------------------------------------------------------------------------
ALTER TABLE public.external_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS external_invoices_select ON public.external_invoices;
CREATE POLICY external_invoices_select
  ON public.external_invoices FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.vehicles v
                  WHERE v.id = external_invoices.vehicle_id
                    AND v.company_id = current_company_id()));

DROP POLICY IF EXISTS external_invoices_insert ON public.external_invoices;
CREATE POLICY external_invoices_insert
  ON public.external_invoices FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v
                       WHERE v.id = external_invoices.vehicle_id
                         AND v.company_id = current_company_id()));

DROP POLICY IF EXISTS external_invoices_update ON public.external_invoices;
CREATE POLICY external_invoices_update
  ON public.external_invoices FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.vehicles v
                  WHERE v.id = external_invoices.vehicle_id
                    AND v.company_id = current_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v
                       WHERE v.id = external_invoices.vehicle_id
                         AND v.company_id = current_company_id()));

DROP POLICY IF EXISTS external_invoices_delete ON public.external_invoices;
CREATE POLICY external_invoices_delete
  ON public.external_invoices FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.vehicles v
                  WHERE v.id = external_invoices.vehicle_id
                    AND v.company_id = current_company_id()));

-- 3. Activity log — new action type
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
    'channel_changed'::text,'data_migrated'::text,'vehicle_moved'::text,
    'external_invoice_created'::text,'external_invoice_updated'::text,
    'external_invoice_deleted'::text
  ]));

-- 4. Supabase Storage bucket for attachments
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'external-invoices',
  'external-invoices',
  false,
  10485760,            -- 10 MB
  ARRAY['image/jpeg','image/png','application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4b. Storage object policies — only authenticated users from the
--     correct tenant can read / write objects in this bucket. Object
--     paths follow `<company_id>/<vehicle_id>/<filename>` so we can
--     scope by company via the first path segment.
DROP POLICY IF EXISTS external_invoices_storage_select ON storage.objects;
CREATE POLICY external_invoices_storage_select
  ON storage.objects FOR SELECT
  USING (bucket_id = 'external-invoices'
     AND (storage.foldername(name))[1] = current_company_id()::text);

DROP POLICY IF EXISTS external_invoices_storage_insert ON storage.objects;
CREATE POLICY external_invoices_storage_insert
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'external-invoices'
          AND (storage.foldername(name))[1] = current_company_id()::text);

DROP POLICY IF EXISTS external_invoices_storage_update ON storage.objects;
CREATE POLICY external_invoices_storage_update
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'external-invoices'
     AND (storage.foldername(name))[1] = current_company_id()::text);

DROP POLICY IF EXISTS external_invoices_storage_delete ON storage.objects;
CREATE POLICY external_invoices_storage_delete
  ON storage.objects FOR DELETE
  USING (bucket_id = 'external-invoices'
     AND (storage.foldername(name))[1] = current_company_id()::text);

-- ============================================================================
-- End migration 0015
-- ============================================================================
