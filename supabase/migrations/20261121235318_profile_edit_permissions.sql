-- Restrict self-service profile updates to user-editable profile fields.
-- Preserve owner-only row access and replace the actual existing policy name.
revoke update on table public.profiles from public, anon, authenticated;

do $$
declare
  profile_column record;
begin
  for profile_column in
    select attname
    from pg_catalog.pg_attribute
    where attrelid = 'public.profiles'::pg_catalog.regclass
      and attnum > 0
      and not attisdropped
  loop
    execute pg_catalog.format(
      'revoke update (%I) on table public.profiles from public, anon',
      profile_column.attname
    );

    if profile_column.attname not in (
      'username', 'display_name', 'bio', 'country_code',
      'preferred_language', 'preferred_currency', 'timezone'
    ) then
      execute pg_catalog.format(
        'revoke update (%I) on table public.profiles from authenticated',
        profile_column.attname
      );
    end if;
  end loop;
end;
$$;

grant update (username, display_name, bio, country_code, preferred_language, preferred_currency, timezone)
  on table public.profiles to authenticated;

drop policy if exists "Users update only editable profile fields" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_profile_updated_at() from public, anon, authenticated;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();
