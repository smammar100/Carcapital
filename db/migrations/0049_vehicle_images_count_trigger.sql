-- 0049_vehicle_images_count_trigger.sql
--
-- Keeps vehicles.images_count in step with the vehicle_photos rows it counts.
--
-- The column is derived data that was maintained by hand at the call sites, so
-- it drifted: AK69 HZH read 51 against 1 real photo, LW16 RUH read 50 against
-- none (GEN-107). Downstream that is not cosmetic -- Photo Processing decides
-- which vehicles to list from this column, so a stale positive queues a car
-- with nothing to process and a stale zero hides one that has photos, and the
-- AutoTrader stock payload sends it to a third party.
--
-- A trigger rather than increment/decrement in the service. The column drifted
-- precisely because staying current depended on every writer remembering; the
-- database is the only place that sees every insert and delete, including bulk
-- deletes and anything done straight through the API.
--
-- Recomputes with count(*) instead of +1/-1 so it is self-healing: any row that
-- has already drifted corrects itself the next time that vehicle's photos are
-- touched, rather than carrying the error forward.

create or replace function public.sync_vehicle_images_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A photo can move between vehicles, so an UPDATE has to settle both sides.
  if (TG_OP = 'DELETE' or TG_OP = 'UPDATE') then
    update public.vehicles v
       set images_count = (
             select count(*) from public.vehicle_photos p
              where p.vehicle_id = OLD.vehicle_id
           )
     where v.id = OLD.vehicle_id;
  end if;

  if (TG_OP = 'INSERT' or TG_OP = 'UPDATE') then
    update public.vehicles v
       set images_count = (
             select count(*) from public.vehicle_photos p
              where p.vehicle_id = NEW.vehicle_id
           )
     where v.id = NEW.vehicle_id;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_vehicle_photos_count on public.vehicle_photos;
create trigger trg_vehicle_photos_count
  after insert or update or delete on public.vehicle_photos
  for each row execute function public.sync_vehicle_images_count();

-- Snapshot before correcting, following 0045_backfill_vehicle_cost_totals.sql:
-- a backfill that overwrites without a record of what it replaced cannot be
-- checked afterwards or undone.
create table if not exists public.vehicle_images_count_backfill_20260830 as
select id, registration, images_count as previous_images_count, now() as captured_at
from public.vehicles;

update public.vehicles v
   set images_count = (
         select count(*) from public.vehicle_photos p where p.vehicle_id = v.id
       )
 where v.images_count is distinct from (
         select count(*) from public.vehicle_photos p where p.vehicle_id = v.id
       );

comment on function public.sync_vehicle_images_count() is
  'Recomputes vehicles.images_count from vehicle_photos on every photo write (GEN-107).';
