-- GEN-83: the Appointment Book's day/week grid was hardcoded to 09:00-18:00
-- with no way to configure it, so a dealership with different hours saw the
-- calendar clipped regardless of what they actually work. Store the window
-- per company so Settings can edit it and the calendar can read it.
alter table companies
  add column working_hours_start text not null default '09:00',
  add column working_hours_end text not null default '18:00';

comment on column companies.working_hours_start is
  'Start of the business day, "HH:mm" (24h). Drives the Appointment Book grid.';
comment on column companies.working_hours_end is
  'End of the business day, "HH:mm" (24h). Drives the Appointment Book grid.';
