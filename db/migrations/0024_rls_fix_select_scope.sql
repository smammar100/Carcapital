-- ============================================================================
-- Migration 0024 — Fix: 0023 over-gated SELECT on FOR ALL policies
-- ============================================================================
--
-- 0023 used `FOR ALL` capability-gated policies on user_permissions and three
-- child tables (invoice_line_items, invoice_payments, inspection_checks).
-- `FOR ALL` governs SELECT too — so reads became capability-gated, which:
--   • broke usePermissions() for every non-admin: reading one's OWN
--     user_permissions returned 403, the hook threw, all capabilities resolved
--     empty, and the sidebar/dashboard/CTA collapsed to "Dashboard only".
--   • hid invoice line items / payments / inspection checks from roles that can
--     legitimately VIEW the parent (e.g. view_only seeing an invoice but not
--     its line items).
--
-- Principle: SELECT mirrors the parent's read scope (company-scoped). Only
-- writes (INSERT/UPDATE/DELETE) carry capability gates. This migration splits
-- each FOR ALL policy into a permissive SELECT + capability-gated writes.
-- ----------------------------------------------------------------------------

-- user_permissions: a user reads their OWN grants; admins read all in company.
-- Writes require admin:manage_permissions (+ same company).
DROP POLICY IF EXISTS user_perms_modify ON public.user_permissions;

DROP POLICY IF EXISTS user_perms_select ON public.user_permissions;
CREATE POLICY user_perms_select ON public.user_permissions FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    OR (
      public.auth_has_any_capability(ARRAY['admin:manage_permissions'])
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_permissions.user_id AND u.company_id = public.current_company_id())
    )
  );

DROP POLICY IF EXISTS user_perms_write ON public.user_permissions;
CREATE POLICY user_perms_write ON public.user_permissions FOR INSERT
  WITH CHECK (
    public.auth_has_any_capability(ARRAY['admin:manage_permissions'])
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_permissions.user_id AND u.company_id = public.current_company_id())
  );
DROP POLICY IF EXISTS user_perms_update ON public.user_permissions;
CREATE POLICY user_perms_update ON public.user_permissions FOR UPDATE
  USING (public.auth_has_any_capability(ARRAY['admin:manage_permissions']) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_permissions.user_id AND u.company_id = public.current_company_id()))
  WITH CHECK (public.auth_has_any_capability(ARRAY['admin:manage_permissions']) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_permissions.user_id AND u.company_id = public.current_company_id()));
DROP POLICY IF EXISTS user_perms_delete ON public.user_permissions;
CREATE POLICY user_perms_delete ON public.user_permissions FOR DELETE
  USING (public.auth_has_any_capability(ARRAY['admin:manage_permissions']) AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = user_permissions.user_id AND u.company_id = public.current_company_id()));

-- invoice_line_items: SELECT = parent invoice in company; writes need invoice caps.
DROP POLICY IF EXISTS invoice_line_items_rw ON public.invoice_line_items;
DROP POLICY IF EXISTS invoice_line_items_select ON public.invoice_line_items;
CREATE POLICY invoice_line_items_select ON public.invoice_line_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.company_id = public.current_company_id()));
DROP POLICY IF EXISTS invoice_line_items_write ON public.invoice_line_items;
CREATE POLICY invoice_line_items_write ON public.invoice_line_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['invoice:generate','invoice:edit']));
DROP POLICY IF EXISTS invoice_line_items_update ON public.invoice_line_items;
CREATE POLICY invoice_line_items_update ON public.invoice_line_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['invoice:generate','invoice:edit']))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['invoice:generate','invoice:edit']));
DROP POLICY IF EXISTS invoice_line_items_delete ON public.invoice_line_items;
CREATE POLICY invoice_line_items_delete ON public.invoice_line_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_line_items.invoice_id AND i.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['invoice:generate','invoice:edit']));

-- invoice_payments: SELECT = parent invoice in company; writes need payment caps.
DROP POLICY IF EXISTS invoice_payments_rw ON public.invoice_payments;
DROP POLICY IF EXISTS invoice_payments_select ON public.invoice_payments;
CREATE POLICY invoice_payments_select ON public.invoice_payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_payments.invoice_id AND i.company_id = public.current_company_id()));
DROP POLICY IF EXISTS invoice_payments_write ON public.invoice_payments;
CREATE POLICY invoice_payments_write ON public.invoice_payments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_payments.invoice_id AND i.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['invoice:mark_paid','invoice:edit','invoice:generate']));
DROP POLICY IF EXISTS invoice_payments_update ON public.invoice_payments;
CREATE POLICY invoice_payments_update ON public.invoice_payments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_payments.invoice_id AND i.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['invoice:mark_paid','invoice:edit','invoice:generate']))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_payments.invoice_id AND i.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['invoice:mark_paid','invoice:edit','invoice:generate']));
DROP POLICY IF EXISTS invoice_payments_delete ON public.invoice_payments;
CREATE POLICY invoice_payments_delete ON public.invoice_payments FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_payments.invoice_id AND i.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['invoice:mark_paid','invoice:edit','invoice:generate']));

-- inspection_checks: SELECT = parent vehicle in company; writes need inspection caps.
DROP POLICY IF EXISTS inspection_checks_rw ON public.inspection_checks;
DROP POLICY IF EXISTS inspection_checks_select ON public.inspection_checks;
CREATE POLICY inspection_checks_select ON public.inspection_checks FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = inspection_checks.vehicle_id AND v.company_id = public.current_company_id()));
DROP POLICY IF EXISTS inspection_checks_write ON public.inspection_checks;
CREATE POLICY inspection_checks_write ON public.inspection_checks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = inspection_checks.vehicle_id AND v.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['inspection:run','inspection:add_note']));
DROP POLICY IF EXISTS inspection_checks_update ON public.inspection_checks;
CREATE POLICY inspection_checks_update ON public.inspection_checks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = inspection_checks.vehicle_id AND v.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['inspection:run','inspection:add_note']))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = inspection_checks.vehicle_id AND v.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['inspection:run','inspection:add_note']));
DROP POLICY IF EXISTS inspection_checks_delete ON public.inspection_checks;
CREATE POLICY inspection_checks_delete ON public.inspection_checks FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id = inspection_checks.vehicle_id AND v.company_id = public.current_company_id()) AND public.auth_has_any_capability(ARRAY['inspection:run']));

-- ============================================================================
-- End migration 0024
-- ============================================================================
