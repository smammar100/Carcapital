-- ============================================================================
-- Migration 0001 — Vehicle Returns → Refund Invoice → Invoicing
-- ============================================================================
--
-- PR2 of the multi-module overhaul. Adds the columns needed to:
--   1. capture the original sale invoice + refund bank details on a return
--   2. emit a "refund" invoice that links back to the return + sale invoice
--
-- HOW TO APPLY
--   This file is written for you (the dealer/admin) to run against the live
--   Supabase project. Run it in the Supabase SQL editor (or psql). It is
--   idempotent — re-running it is safe (every change is guarded with
--   IF NOT EXISTS / a catalog check).
--
-- IMPORTANT — read §3 before running. `invoices.type` is either a Postgres
-- ENUM or a TEXT column with a CHECK constraint. We do not know which your
-- project uses, so §3 ships BOTH forms. Run ONLY the one that matches your
-- schema (a one-line query at the top of §3 tells you which).
--
-- ----------------------------------------------------------------------------
-- 1. vehicle_returns — link to the original sale invoice + refund bank block
-- ----------------------------------------------------------------------------

ALTER TABLE public.vehicle_returns
  ADD COLUMN IF NOT EXISTS original_invoice_id uuid REFERENCES public.invoices(id);

ALTER TABLE public.vehicle_returns
  ADD COLUMN IF NOT EXISTS refund_bank_account_name text;

ALTER TABLE public.vehicle_returns
  ADD COLUMN IF NOT EXISTS refund_sort_code text;

ALTER TABLE public.vehicle_returns
  ADD COLUMN IF NOT EXISTS refund_account_number text;

ALTER TABLE public.vehicle_returns
  ADD COLUMN IF NOT EXISTS refund_bank_name text;

COMMENT ON COLUMN public.vehicle_returns.original_invoice_id IS
  'The original SALE invoice this return reverses. NULL when entered manually (no sale invoice on file).';

-- ----------------------------------------------------------------------------
-- 2. invoices — back-references so a refund invoice points at its return
--    and the original sale invoice it reverses
-- ----------------------------------------------------------------------------

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS related_return_id uuid REFERENCES public.vehicle_returns(id);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS related_invoice_id uuid REFERENCES public.invoices(id);

COMMENT ON COLUMN public.invoices.related_return_id IS
  'Set on type=''refund'' invoices — the vehicle_returns row that generated this refund.';
COMMENT ON COLUMN public.invoices.related_invoice_id IS
  'Set on type=''refund'' invoices — the original SALE invoice this refund reverses.';

-- ----------------------------------------------------------------------------
-- 3. InvoiceType: add the new value 'refund'
-- ----------------------------------------------------------------------------
--
-- FIRST, find out which shape your project uses. Run this:
--
--   SELECT data_type, udt_name
--   FROM information_schema.columns
--   WHERE table_schema = 'public'
--     AND table_name   = 'invoices'
--     AND column_name  = 'type';
--
--   • data_type = 'USER-DEFINED'  → it's an ENUM. Run §3a.
--   • data_type = 'text'          → it's a TEXT + CHECK column. Run §3b.
--
-- ---- §3a. ENUM variant -----------------------------------------------------
-- `udt_name` from the query above is the enum type name (commonly
-- `invoice_type`). ADD VALUE is idempotent via IF NOT EXISTS (PG 12+).
-- NOTE: in older Postgres, ALTER TYPE ... ADD VALUE cannot run inside a
-- transaction block — run §3a on its own, not wrapped in BEGIN/COMMIT.
--
--   ALTER TYPE public.invoice_type ADD VALUE IF NOT EXISTS 'refund';
--
-- ---- §3b. TEXT + CHECK variant ---------------------------------------------
-- Replace the existing CHECK constraint so 'refund' is allowed. The
-- constraint name varies; find it with:
--
--   SELECT conname
--   FROM pg_constraint
--   WHERE conrelid = 'public.invoices'::regclass
--     AND contype  = 'c'
--     AND pg_get_constraintdef(oid) ILIKE '%type%';
--
-- Then (substituting the real constraint name for invoices_type_check):
--
--   ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_type_check;
--   ALTER TABLE public.invoices
--     ADD CONSTRAINT invoices_type_check
--     CHECK (type IN ('purchase', 'sale', 'refund'));
--
-- ----------------------------------------------------------------------------
-- 4. Invoice numbering for refunds — ACTION REQUIRED, verify manually
-- ----------------------------------------------------------------------------
--
-- The app mints invoice numbers via the DB function
-- `next_invoice_number(p_company_id uuid, p_type ...)`. That function's body
-- is NOT in the codebase (it lives only in your database), so this migration
-- does NOT blindly CREATE OR REPLACE it — doing so could corrupt your
-- existing purchase/sale numbering.
--
-- Inspect your function:
--
--   SELECT pg_get_functiondef(oid)
--   FROM pg_proc
--   WHERE proname = 'next_invoice_number';
--
-- If it switches on the type to choose a prefix (e.g. CASE p_type WHEN
-- 'purchase' THEN 'PUR' WHEN 'sale' THEN 'SAL' END), ADD a 'refund' arm so
-- it returns a non-NULL number for refunds, e.g.:
--
--   ... WHEN 'refund' THEN 'REF' ...
--
-- (A NULL prefix → NULL invoice_number → the refund INSERT fails. The app
-- guards this: refund creation surfaces a clear error toast instead of
-- hanging if the RPC errors — but the refund won't be recorded until this
-- arm exists.)
--
-- ============================================================================
-- End migration 0001
-- ============================================================================
