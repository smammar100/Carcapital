-- 0046_wipe_demo_data.sql
--
-- Clears every demo and UAT record ahead of the MVP launch, leaving only the
-- owner account (Abbas Bhai) and the configuration the app needs to boot.
--
-- WHY THE is_demo FLAG WAS NOT USED AS THE FILTER
-- `is_demo` marks the seeded dataset, not "fake data" — the owner account
-- itself carries is_demo = true, so `delete where is_demo` would have removed
-- the one account that had to survive. Conversely the six is_demo = false
-- vehicles were UAT scratch (one literally 'FORD FIESTA UAT TEST'), not real
-- trading records. Neither side held genuine Car Capital data, so the wipe is
-- by table, not by flag.
--
-- KEPT: companies, users (owner only), role_capabilities, pipeline_stages,
--       lead_channels, inspection_checklist_items, custom_field_definitions,
--       at_advertisers, team_join_links.
-- The owner has is_super_user = true, so capability checks short-circuit and
-- the deleted user_permissions rows are not needed for access.
--
-- ROLLBACK
--   Every public table was copied to schema wipe_backup_20260826 (41 tables)
--   plus wipe_backup_20260826.auth_users, immediately before this ran:
--     insert into public.<table> select * from wipe_backup_20260826.<table>;
--   Restore parents before children (companies, users, vehicles, then the
--   rest). Drop the schema once the real import is signed off:
--     drop schema wipe_backup_20260826 cascade;

begin;

truncate table
  activity_log, notifications, todo_items,
  inspection_checks, inspection_notes,
  maintenance_jobs, maintenance_job_notes, workshop_jobs,
  vehicle_photos, listings, location_movements, vehicle_returns,
  invoice_line_items, invoice_payments, invoice_receipts, invoices, external_invoices,
  appointments, warranties, warranty_claims,
  leads, enquiries, enquiry_history, sales_deals, deal_notes, customers,
  vendors, dealer_partners, team_invitations,
  vehicles
cascade;

delete from public.user_permissions where user_id <> '3c750cd1-aa34-451d-9293-c9a44ec77f9d';
delete from public.users           where id      <> '3c750cd1-aa34-451d-9293-c9a44ec77f9d';
delete from auth.users             where id      <> '3c750cd1-aa34-451d-9293-c9a44ec77f9d';

commit;
