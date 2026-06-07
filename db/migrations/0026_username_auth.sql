-- 0026_username_auth.sql
--
-- Username-based (no-email) accounts. Our target market — medium-size UK car
-- dealerships — has staff with NO individual email addresses. Admins generate a
-- username + password and relay it out-of-band (WhatsApp / phone / in person);
-- staff log in with username + password.
--
-- Under the hood each account still carries a Supabase auth email, but a
-- SYNTHETIC, never-shown address:  <username>@<company-slug>.staff.carcapital.uk
-- (created with email_confirm:true so GoTrue never sends mail). That keeps
-- Supabase Auth working with zero user-facing email. Usernames are unique PER
-- dealership (multi-tenant, scales to 100+). Existing real-email accounts are
-- untouched (username stays NULL and is exempt from the unique index).

-- 1. companies.slug — url-safe per-dealership identifier; scopes the synthetic
--    email and resolves the dealership at login (?org=<slug>).
alter table public.companies add column if not exists slug text;

update public.companies
   set slug = 'car-capital-uk'
 where slug is null and id = '892d30bf-3599-4043-8f8c-ffc1642ab6f9';

-- Backfill any remaining rows from name: lower-case, non-alnum -> hyphen.
update public.companies
   set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
 where slug is null;

alter table public.companies alter column slug set not null;
create unique index if not exists companies_slug_key on public.companies (slug);
comment on column public.companies.slug is
  'URL-safe dealership identifier. Used to scope no-email synthetic logins and resolve the dealership at /login?org=<slug>.';

-- 2. users.username — per-dealership login handle. NULL for email-based accounts.
alter table public.users add column if not exists username text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_username_format_chk') then
    alter table public.users add constraint users_username_format_chk
      check (
        username is null
        or (username = lower(username) and username ~ '^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$')
      );
  end if;
end $$;

-- Unique PER dealership (partial: email users with username IS NULL are exempt).
create unique index if not exists users_company_username_key
  on public.users (company_id, username) where username is not null;

comment on column public.users.username is
  'Per-dealership login handle for no-email staff (unique per company). NULL for email-based accounts.';

-- 3. Extend the 0025 privileged-column guard to ALSO block authenticated
--    self-edits of `username` + `email` (otherwise a member could rename their
--    own login handle / synthetic email from the browser and collide or break
--    the username->email mapping). Service-role (admin API routes) bypasses,
--    so create-with-password / reset-password still work. The BEFORE UPDATE
--    trigger from 0025 already references this function — replacing it suffices.
create or replace function public.guard_user_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    if NEW.roles         is distinct from OLD.roles
       or NEW.role          is distinct from OLD.role
       or NEW.is_super_user is distinct from OLD.is_super_user
       or NEW.active        is distinct from OLD.active
       or NEW.company_id    is distinct from OLD.company_id
       or NEW.username      is distinct from OLD.username
       or NEW.email         is distinct from OLD.email then
      raise exception
        'Privileged columns (roles, role, is_super_user, active, company_id, username, email) can only be changed by an administrator action'
        using errcode = '42501';
    end if;
  end if;
  return NEW;
end;
$$;
