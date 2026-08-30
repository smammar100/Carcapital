-- 0048_maintenance_scheduled_time.sql
--
-- Gives a maintenance job a time of day.
--
-- The Maintenance calendar has always looked time-slotted: clicking an 11:00
-- slot opened the form with 11:00 filled in. Nothing ever stored it. The job
-- carried a due_date and no more, so the time the user picked was dropped on
-- save and the job came back as an all-day marker (GEN-110). That is data
-- loss, not a display bug -- the value never reached the database.
--
-- Nullable with no default, deliberately. Every job created before this
-- migration genuinely has no time, and inventing one (09:00, say) would put
-- appointments in the diary that nobody booked. NULL keeps those jobs
-- rendering as all-day markers, exactly as they do now, while new jobs land
-- at the time they were given.
--
-- `time` rather than `timestamptz`: the date already lives in due_date, and a
-- workshop books "11:00 on Thursday" in its own local terms. Splitting them
-- matches how appointments (date + time) and workshop jobs
-- (scheduled_date + scheduled_time) are already stored.

alter table public.maintenance_jobs
  add column if not exists scheduled_time time;

comment on column public.maintenance_jobs.scheduled_time is
  'Time of day the job is booked for. NULL = no time given; renders all-day.';
