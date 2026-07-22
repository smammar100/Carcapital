-- GEN-74: sales-pipeline deal cards only had a single flat `notes` text
-- column on sales_deals — no timestamp, no attribution, and a second note
-- overwrote the first. The team needs a running, attributed log ("customer
-- asked to call back tomorrow at 5pm", "offered £500 discount"), the same
-- append-only shape inspection_notes already uses for vehicles.
create table if not exists public.deal_notes (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.sales_deals(id) on delete cascade,
  user_id     uuid not null references public.users(id),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists deal_notes_deal_id_idx on public.deal_notes (deal_id, created_at);

alter table public.deal_notes enable row level security;

drop policy if exists deal_notes_all on public.deal_notes;
create policy deal_notes_all
  on public.deal_notes for all
  using (exists (
    select 1 from public.sales_deals d
    where d.id = deal_notes.deal_id and d.company_id = current_company_id()
  ))
  with check (exists (
    select 1 from public.sales_deals d
    where d.id = deal_notes.deal_id and d.company_id = current_company_id()
  ));

-- Activity log needs its own action type for this (unlike inspection_notes,
-- which reused an unrelated existing value).
alter table public.activity_log drop constraint if exists activity_log_action_type_check;
alter table public.activity_log add constraint activity_log_action_type_check
  check (action_type = any (array[
    'vehicle_arrived','vehicle_status_changed','vehicle_returned',
    'return_resolved','return_rejected','inspection_started','inspection_completed',
    'todo_added','todo_completed','prep_assigned','maintenance_job_created',
    'maintenance_job_completed','workshop_job_created','photo_uploaded','photo_processed',
    'listing_created','listing_published','listing_deleted','lead_created','lead_converted',
    'lead_status_changed','appointment_booked','appointment_updated','appointment_completed',
    'sale_stage_changed','sale_completed','warranty_created','warranty_purchased',
    'warranty_cancelled','warranty_claim_opened','invoice_created','invoice_sent','invoice_paid',
    'cost_updated','user_invited','company_setting_changed','channel_changed','data_migrated',
    'vehicle_moved','external_invoice_created','external_invoice_updated','external_invoice_deleted',
    'deal_note_added'
  ]::text[]));
