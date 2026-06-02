-- 0025_guard_user_privileged_columns.sql
--
-- Closes a privilege-escalation hole. The only UPDATE policy on public.users
-- is `users_update_self` (id = auth.uid()) and RLS cannot restrict WHICH
-- columns a row owner may change. So an authenticated user could update their
-- OWN row and self-grant elevated access:
--
--     update public.users set roles = '{administrator}'      where id = auth.uid();
--     update public.users set is_super_user = true           where id = auth.uid();
--
-- roles[] / is_super_user feed capability resolution (enforced server-side in
-- requireUser), so this is a real escalation path reachable from the browser
-- console with the publishable key + the user's own session.
--
-- Fix: a BEFORE UPDATE trigger that forbids `authenticated` callers from
-- changing the privileged columns. Service-role (the /api/team/* admin routes:
-- set-roles, create-with-password, accept-join, remove-member) and internal /
-- migration contexts have auth.role() <> 'authenticated', so every legitimate
-- role change still works. Profile self-edits (name, avatar, two_step_enabled,
-- password_reset_required, activated_at, accepted_at, last_login_at) are NOT
-- touched.

create or replace function public.guard_user_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  -- Only browser/authenticated callers are restricted. Service-role (admin
  -- client) and internal/postgres contexts (auth.role() is null) may manage
  -- these columns — that is how the admin API routes apply role changes.
  if auth.role() = 'authenticated' then
    if NEW.roles         is distinct from OLD.roles
       or NEW.role          is distinct from OLD.role
       or NEW.is_super_user is distinct from OLD.is_super_user
       or NEW.active        is distinct from OLD.active
       or NEW.company_id    is distinct from OLD.company_id then
      raise exception
        'Privileged columns (roles, role, is_super_user, active, company_id) can only be changed by an administrator action'
        using errcode = '42501';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists guard_user_privileged_columns on public.users;
create trigger guard_user_privileged_columns
  before update on public.users
  for each row
  execute function public.guard_user_privileged_columns();
