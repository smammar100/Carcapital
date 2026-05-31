-- ============================================================================
-- Migration 0023 — Capability-aware + active-aware RLS hardening
-- ============================================================================
--
-- Before this, RLS was company-scoped only: any active session could write to
-- any table in its own company regardless of role, and deactivated users were
-- only blocked at login (their existing JWT still passed RLS). This migration:
--
--   1. role_capabilities — a SQL mirror of the role→capability bundles in
--      src/lib/roles.ts, so the database can resolve a user's permissions.
--   2. auth_has_any_capability() — true if the caller (by auth.uid()) holds
--      ANY of the given capabilities via their roles[] or explicit
--      user_permissions grants; super-users bypass.
--   3. current_company_id() redefined to return NULL for INACTIVE users —
--      because every company-scoped policy filters on
--      `company_id = current_company_id()`, this single change locks
--      deactivated users out of every such table at the DB layer.
--   4. Capability gates on the WRITE policies (INSERT/UPDATE/DELETE) of the
--      sensitive transactional tables. SELECT stays company-scoped (now also
--      active-gated via #3).
--
-- The service-role key (used by /api/* route handlers + seed scripts) BYPASSES
-- RLS entirely, so server-side admin flows are unaffected. These policies
-- govern the browser anon client (the service layer).
--
-- Idempotent. Rollback: see the DROP statements at the foot of this file
-- (commented) — restore the company-only policies by re-running 0009-era defs.
-- ----------------------------------------------------------------------------

-- 1. role_capabilities — mirrors src/lib/roles.ts ROLE_DEFS. Keep in sync.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_capabilities (
  role       text NOT NULL,
  capability text NOT NULL,
  PRIMARY KEY (role, capability)
);

ALTER TABLE public.role_capabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS role_capabilities_read ON public.role_capabilities;
CREATE POLICY role_capabilities_read ON public.role_capabilities
  FOR SELECT USING (true);  -- non-secret lookup; writes only via service-role

-- Reseed from scratch each run so edits to roles.ts can be re-applied.
DELETE FROM public.role_capabilities;
INSERT INTO public.role_capabilities (role, capability) VALUES
  -- administrator
  ('administrator','admin:view_master_sheet'),
  ('administrator','admin:view_financials'),
  ('administrator','admin:view_master_calendar'),
  ('administrator','admin:manage_users'),
  ('administrator','admin:manage_vendors'),
  ('administrator','admin:manage_settings'),
  ('administrator','inventory:edit'),
  ('administrator','inventory:edit_costs'),
  ('administrator','inventory:remove_from_website'),
  ('administrator','advert:create'),
  ('administrator','advert:edit'),
  ('administrator','advert:publish'),
  ('administrator','channels:configure'),
  ('administrator','data:migrate'),
  ('administrator','users:create_direct'),
  ('administrator','locations:move'),
  ('administrator','external_invoice:create'),
  ('administrator','external_invoice:edit_any'),
  ('administrator','external_invoice:delete'),
  ('administrator','listing:publish_autotrader'),
  -- iam_admin
  ('iam_admin','admin:manage_users'),
  ('iam_admin','admin:manage_permissions'),
  ('iam_admin','users:create_direct'),
  -- inventory_manager
  ('inventory_manager','inventory:add'),
  ('inventory_manager','inventory:edit'),
  ('inventory_manager','inventory:edit_costs'),
  ('inventory_manager','inventory:remove_from_website'),
  ('inventory_manager','maintenance:create'),
  ('inventory_manager','photos:process'),
  ('inventory_manager','advert:create'),
  ('inventory_manager','advert:edit'),
  ('inventory_manager','admin:view_master_sheet'),
  ('inventory_manager','admin:view_financials'),
  ('inventory_manager','locations:move'),
  ('inventory_manager','external_invoice:create'),
  -- workshop_lead
  ('workshop_lead','maintenance:create'),
  ('workshop_lead','maintenance:edit'),
  ('workshop_lead','maintenance:complete'),
  ('workshop_lead','workshop:add_note'),
  ('workshop_lead','photos:process'),
  -- inspector
  ('inspector','inspection:run'),
  ('inspector','inspection:add_note'),
  ('inspector','maintenance:create'),
  ('inspector','workshop:add_note'),
  -- driver
  ('driver','inventory:add'),
  -- sales_specialist
  ('sales_specialist','sales:create_lead'),
  ('sales_specialist','sales:edit_lead'),
  ('sales_specialist','sales:book_appointment'),
  ('sales_specialist','sales:edit_appointment'),
  ('sales_specialist','sales:edit_pipeline_stage'),
  ('sales_specialist','sales:mark_sold'),
  ('sales_specialist','invoice:generate'),
  ('sales_specialist','admin:view_master_calendar'),
  -- sales_manager
  ('sales_manager','sales:create_lead'),
  ('sales_manager','sales:edit_lead'),
  ('sales_manager','sales:book_appointment'),
  ('sales_manager','sales:edit_appointment'),
  ('sales_manager','sales:edit_pipeline_stage'),
  ('sales_manager','sales:mark_sold'),
  ('sales_manager','invoice:generate'),
  ('sales_manager','invoice:edit'),
  ('sales_manager','invoice:send'),
  ('sales_manager','invoice:mark_paid'),
  ('sales_manager','warranty:create'),
  ('sales_manager','warranty:edit'),
  ('sales_manager','warranty:raise_claim'),
  ('sales_manager','warranty:resolve_claim'),
  ('sales_manager','admin:view_master_calendar'),
  ('sales_manager','admin:view_financials'),
  -- finance_admin
  ('finance_admin','invoice:generate'),
  ('finance_admin','invoice:edit'),
  ('finance_admin','invoice:send'),
  ('finance_admin','invoice:mark_paid'),
  ('finance_admin','warranty:resolve_claim'),
  ('finance_admin','returns:create'),
  ('finance_admin','admin:view_financials'),
  ('finance_admin','admin:view_master_sheet'),
  -- aftercare_specialist
  ('aftercare_specialist','warranty:create'),
  ('aftercare_specialist','warranty:edit'),
  ('aftercare_specialist','warranty:raise_claim'),
  ('aftercare_specialist','warranty:resolve_claim'),
  ('aftercare_specialist','returns:create'),
  -- view_only
  ('view_only','admin:view_master_sheet'),
  ('view_only','admin:view_master_calendar'),
  ('view_only','admin:view_financials');

-- 2. Capability resolver — super-user bypass, roles[] union, explicit grants.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_has_any_capability(caps text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.active = true
      AND (
        u.is_super_user = true
        OR EXISTS (
          SELECT 1 FROM public.role_capabilities rc
          WHERE rc.role = ANY (u.roles) AND rc.capability = ANY (caps)
        )
        OR EXISTS (
          SELECT 1 FROM public.user_permissions up
          WHERE up.user_id = u.id AND up.capability = ANY (caps)
        )
      )
  );
$$;

-- 3. Active-aware company resolver — NULL for inactive users → every
--    `company_id = current_company_id()` policy denies them automatically.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT company_id FROM public.users
  WHERE id = (SELECT auth.uid()) AND active = true
$$;

-- 4. Capability-gated WRITE policies on sensitive tables.
--    Helper convention per table:
--      INSERT  → WITH CHECK (company match AND has-cap)
--      UPDATE  → USING (company match AND has-cap) WITH CHECK (company match AND has-cap)
--      DELETE  → USING (company match AND has-cap)
--    SELECT policies are left untouched (company+active scoped via #3).
-- ----------------------------------------------------------------------------

-- vehicles — operational write union (blocks view_only / pure sales / finance / aftercare / iam_admin)
DROP POLICY IF EXISTS vehicles_insert ON public.vehicles;
CREATE POLICY vehicles_insert ON public.vehicles FOR INSERT
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['inventory:add','inventory:edit','inventory:edit_costs','inventory:remove_from_website','inspection:run','inspection:add_note','maintenance:create','maintenance:edit','maintenance:complete','workshop:add_note','photos:process','advert:create','advert:edit']));
DROP POLICY IF EXISTS vehicles_update ON public.vehicles;
CREATE POLICY vehicles_update ON public.vehicles FOR UPDATE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['inventory:add','inventory:edit','inventory:edit_costs','inventory:remove_from_website','inspection:run','inspection:add_note','maintenance:create','maintenance:edit','maintenance:complete','workshop:add_note','photos:process','advert:create','advert:edit']))
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['inventory:add','inventory:edit','inventory:edit_costs','inventory:remove_from_website','inspection:run','inspection:add_note','maintenance:create','maintenance:edit','maintenance:complete','workshop:add_note','photos:process','advert:create','advert:edit']));
DROP POLICY IF EXISTS vehicles_delete ON public.vehicles;
CREATE POLICY vehicles_delete ON public.vehicles FOR DELETE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['inventory:edit','inventory:remove_from_website']));

-- listings — advert write union
DROP POLICY IF EXISTS listings_insert ON public.listings;
CREATE POLICY listings_insert ON public.listings FOR INSERT
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['advert:create','advert:edit','advert:publish','listing:publish_autotrader','inventory:edit']));
DROP POLICY IF EXISTS listings_update ON public.listings;
CREATE POLICY listings_update ON public.listings FOR UPDATE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['advert:create','advert:edit','advert:publish','listing:publish_autotrader','inventory:edit']))
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['advert:create','advert:edit','advert:publish','listing:publish_autotrader','inventory:edit']));
DROP POLICY IF EXISTS listings_delete ON public.listings;
CREATE POLICY listings_delete ON public.listings FOR DELETE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['advert:create','advert:edit']));

-- leads
DROP POLICY IF EXISTS leads_insert ON public.leads;
CREATE POLICY leads_insert ON public.leads FOR INSERT
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:create_lead','sales:edit_lead']));
DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads FOR UPDATE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:create_lead','sales:edit_lead']))
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:create_lead','sales:edit_lead']));
DROP POLICY IF EXISTS leads_delete ON public.leads;
CREATE POLICY leads_delete ON public.leads FOR DELETE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:edit_lead']));

-- appointments
DROP POLICY IF EXISTS appointments_insert ON public.appointments;
CREATE POLICY appointments_insert ON public.appointments FOR INSERT
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:book_appointment','sales:edit_appointment']));
DROP POLICY IF EXISTS appointments_update ON public.appointments;
CREATE POLICY appointments_update ON public.appointments FOR UPDATE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:book_appointment','sales:edit_appointment']))
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:book_appointment','sales:edit_appointment']));
DROP POLICY IF EXISTS appointments_delete ON public.appointments;
CREATE POLICY appointments_delete ON public.appointments FOR DELETE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:edit_appointment']));

-- sales_deals
DROP POLICY IF EXISTS sales_deals_insert ON public.sales_deals;
CREATE POLICY sales_deals_insert ON public.sales_deals FOR INSERT
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:edit_pipeline_stage','sales:mark_sold','sales:create_lead']));
DROP POLICY IF EXISTS sales_deals_update ON public.sales_deals;
CREATE POLICY sales_deals_update ON public.sales_deals FOR UPDATE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:edit_pipeline_stage','sales:mark_sold']))
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:edit_pipeline_stage','sales:mark_sold']));
DROP POLICY IF EXISTS sales_deals_delete ON public.sales_deals;
CREATE POLICY sales_deals_delete ON public.sales_deals FOR DELETE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['sales:edit_pipeline_stage']));

-- invoices + children — invoice write union
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
CREATE POLICY invoices_insert ON public.invoices FOR INSERT
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['invoice:generate','invoice:edit','invoice:send','invoice:mark_paid']));
DROP POLICY IF EXISTS invoices_update ON public.invoices;
CREATE POLICY invoices_update ON public.invoices FOR UPDATE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['invoice:generate','invoice:edit','invoice:send','invoice:mark_paid']))
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['invoice:generate','invoice:edit','invoice:send','invoice:mark_paid']));
DROP POLICY IF EXISTS invoices_delete ON public.invoices;
CREATE POLICY invoices_delete ON public.invoices FOR DELETE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['invoice:edit']));

-- invoice_line_items has NO company_id — tenancy via parent invoice join.
DROP POLICY IF EXISTS invoice_line_items_all ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_rw ON public.invoice_line_items;
CREATE POLICY invoice_line_items_rw ON public.invoice_line_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.company_id = public.current_company_id())
    AND public.auth_has_any_capability(ARRAY['invoice:generate','invoice:edit']))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.company_id = public.current_company_id())
    AND public.auth_has_any_capability(ARRAY['invoice:generate','invoice:edit']));

-- invoice_payments has NO company_id — tenancy via parent invoice join.
DROP POLICY IF EXISTS invoice_payments_all ON public.invoice_payments;
DROP POLICY IF EXISTS invoice_payments_rw ON public.invoice_payments;
CREATE POLICY invoice_payments_rw ON public.invoice_payments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_payments.invoice_id AND i.company_id = public.current_company_id())
    AND public.auth_has_any_capability(ARRAY['invoice:mark_paid','invoice:edit','invoice:generate']))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_payments.invoice_id AND i.company_id = public.current_company_id())
    AND public.auth_has_any_capability(ARRAY['invoice:mark_paid','invoice:edit','invoice:generate']));

-- warranties
DROP POLICY IF EXISTS warranties_insert ON public.warranties;
CREATE POLICY warranties_insert ON public.warranties FOR INSERT
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['warranty:create','warranty:edit']));
DROP POLICY IF EXISTS warranties_update ON public.warranties;
CREATE POLICY warranties_update ON public.warranties FOR UPDATE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['warranty:create','warranty:edit']))
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['warranty:create','warranty:edit']));
DROP POLICY IF EXISTS warranties_delete ON public.warranties;
CREATE POLICY warranties_delete ON public.warranties FOR DELETE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['warranty:edit']));

-- warranty_claims
DROP POLICY IF EXISTS warranty_claims_insert ON public.warranty_claims;
CREATE POLICY warranty_claims_insert ON public.warranty_claims FOR INSERT
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['warranty:raise_claim','warranty:resolve_claim']));
DROP POLICY IF EXISTS warranty_claims_update ON public.warranty_claims;
CREATE POLICY warranty_claims_update ON public.warranty_claims FOR UPDATE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['warranty:raise_claim','warranty:resolve_claim']))
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['warranty:raise_claim','warranty:resolve_claim']));
DROP POLICY IF EXISTS warranty_claims_delete ON public.warranty_claims;
CREATE POLICY warranty_claims_delete ON public.warranty_claims FOR DELETE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['warranty:resolve_claim']));

-- vehicle_returns
DROP POLICY IF EXISTS vehicle_returns_insert ON public.vehicle_returns;
CREATE POLICY vehicle_returns_insert ON public.vehicle_returns FOR INSERT
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['returns:create']));
DROP POLICY IF EXISTS vehicle_returns_update ON public.vehicle_returns;
CREATE POLICY vehicle_returns_update ON public.vehicle_returns FOR UPDATE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['returns:create']))
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['returns:create']));
DROP POLICY IF EXISTS vehicle_returns_delete ON public.vehicle_returns;
CREATE POLICY vehicle_returns_delete ON public.vehicle_returns FOR DELETE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['returns:create']));

-- maintenance_jobs
DROP POLICY IF EXISTS maintenance_jobs_insert ON public.maintenance_jobs;
CREATE POLICY maintenance_jobs_insert ON public.maintenance_jobs FOR INSERT
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['maintenance:create','maintenance:edit','maintenance:complete','workshop:add_note','inspection:run']));
DROP POLICY IF EXISTS maintenance_jobs_update ON public.maintenance_jobs;
CREATE POLICY maintenance_jobs_update ON public.maintenance_jobs FOR UPDATE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['maintenance:create','maintenance:edit','maintenance:complete','workshop:add_note']))
  WITH CHECK (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['maintenance:create','maintenance:edit','maintenance:complete','workshop:add_note']));
DROP POLICY IF EXISTS maintenance_jobs_delete ON public.maintenance_jobs;
CREATE POLICY maintenance_jobs_delete ON public.maintenance_jobs FOR DELETE
  USING (company_id = public.current_company_id()
    AND public.auth_has_any_capability(ARRAY['maintenance:edit']));

-- inspection_checks has NO company_id — tenancy via parent vehicle join.
DROP POLICY IF EXISTS inspection_checks_all ON public.inspection_checks;
DROP POLICY IF EXISTS inspection_checks_rw ON public.inspection_checks;
CREATE POLICY inspection_checks_rw ON public.inspection_checks FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = inspection_checks.vehicle_id AND v.company_id = public.current_company_id())
    AND public.auth_has_any_capability(ARRAY['inspection:run','inspection:add_note']))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = inspection_checks.vehicle_id AND v.company_id = public.current_company_id())
    AND public.auth_has_any_capability(ARRAY['inspection:run','inspection:add_note']));

-- user_permissions — granting/revoking capabilities needs manage_permissions.
DROP POLICY IF EXISTS user_perms_modify ON public.user_permissions;
CREATE POLICY user_perms_modify ON public.user_permissions FOR ALL
  USING (
    public.auth_has_any_capability(ARRAY['admin:manage_permissions'])
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_permissions.user_id AND u.company_id = public.current_company_id())
  )
  WITH CHECK (
    public.auth_has_any_capability(ARRAY['admin:manage_permissions'])
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_permissions.user_id AND u.company_id = public.current_company_id())
  );

-- ============================================================================
-- End migration 0023
-- ============================================================================
