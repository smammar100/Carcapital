-- ============================================================================
-- Migration 0008 — 2-page legal invoice (SPEC_Invoicing_Module v2.0)
-- ============================================================================
--
-- Upgrades the Sales Invoice to a 2-page legal document (Page 1 invoice,
-- Page 2 Warranty Declaration + Pre-Delivery Check + General Declaration).
--
-- Strategy: compatibility-superset. Every new column is NULLABLE or DEFAULTed
-- and the legacy columns (line_type/addon_type, the old vat_scheme values,
-- the next_invoice_number RPC) are retained, so the existing invoicing list,
-- the vehicle-returns refund flow, and the VAT summary keep working on the
-- 10 existing invoice rows untouched.
--
-- Idempotent. RLS unchanged (inherits invoices/vehicles policies).
-- ----------------------------------------------------------------------------

-- 1a. vehicles — D.O.R + chassis for the invoice identity grid
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS vin text,
  ADD COLUMN IF NOT EXISTS first_registered_date date;

COMMENT ON COLUMN public.vehicles.vin IS
  'Chassis number — VRM/VIN composite on the sales invoice. DVLA-sourced in prod.';
COMMENT ON COLUMN public.vehicles.first_registered_date IS
  'Date of first registration (D.O.R) — invoice identity grid.';

-- 1b. invoices — new legal-document fields (all nullable / defaulted)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS buyer_postcode text,
  ADD COLUMN IF NOT EXISTS present_mileage integer,
  ADD COLUMN IF NOT EXISTS dor_date date,
  ADD COLUMN IF NOT EXISTS sales_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_addons_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grand_total_incl_addons numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_received_date date,
  ADD COLUMN IF NOT EXISTS deposit_method text,
  ADD COLUMN IF NOT EXISTS finance_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finance_provider text,
  ADD COLUMN IF NOT EXISTS balance_due numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due_by date,
  ADD COLUMN IF NOT EXISTS warranty jsonb,
  ADD COLUMN IF NOT EXISTS non_warranty_disclaimer_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pre_delivery_check jsonb,
  ADD COLUMN IF NOT EXISTS include_unit_stocking_note boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_id_requirement_note boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS include_service_history_note boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_note text,
  ADD COLUMN IF NOT EXISTS sale_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz;

COMMENT ON COLUMN public.invoices.warranty IS
  'WarrantyDeclaration snapshot (jsonb) — immutable at issue time.';
COMMENT ON COLUMN public.invoices.pre_delivery_check IS
  'PreDeliveryCheck snapshot (jsonb) — 14-item PDI + documents row.';

-- 1c. invoice_line_items — spec item_type alongside legacy line_type
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS addon_category text,
  ADD COLUMN IF NOT EXISTS item_type text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_item_type_check'
  ) THEN
    ALTER TABLE public.invoice_line_items
      ADD CONSTRAINT invoice_line_items_item_type_check
      CHECK (item_type IS NULL OR item_type = ANY (ARRAY[
        'vehicle_price'::text,'discount'::text,'addon_paid'::text,'addon_free'::text]));
  END IF;
END $$;

-- 1d. Widen the legacy CHECK constraints (keep old values, add new ones)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_vat_scheme_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_vat_scheme_check
  CHECK (vat_scheme = ANY (ARRAY[
    'margin'::text,'standard'::text,'zero_rated'::text,
    'margin_used'::text,'standard_20'::text]));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,'sent'::text,'paid'::text,'overdue'::text,
    'issued'::text,'cancelled'::text]));

ALTER TABLE public.invoice_payments DROP CONSTRAINT IF EXISTS invoice_payments_deposit_method_check;
ALTER TABLE public.invoice_payments
  ADD CONSTRAINT invoice_payments_deposit_method_check
  CHECK (deposit_method IS NULL OR deposit_method = ANY (ARRAY[
    'cash'::text,'card'::text,'bank_transfer'::text,'cheque'::text,'pdq'::text]));

-- 1e. CC-INV-NNNN sequence + RPC (separate from next_invoice_number)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS next_cc_inv_seq integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.next_cc_invoice_number(p_company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_seq integer;
begin
  update public.companies
     set next_cc_inv_seq = next_cc_inv_seq + 1
   where id = p_company_id
   returning next_cc_inv_seq - 1 into v_seq;
  if v_seq is null then
    raise exception 'company % not found or not accessible', p_company_id;
  end if;
  return 'CC-INV-' || lpad(v_seq::text, 4, '0');
end;
$function$;

-- ============================================================================
-- End migration 0008
-- ============================================================================
