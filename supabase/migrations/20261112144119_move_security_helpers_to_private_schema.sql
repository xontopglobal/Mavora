
-- Keep internal authorization helpers out of the exposed public RPC schema.
-- RLS policies will call private.* helpers. Existing public business RPCs remain
-- available only where their own authentication/permission checks require them.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_staff()
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role <> 'user'
  );
$$;

create or replace function private.has_permission(p_permission text)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role = ur.role
    where ur.user_id = auth.uid() and rp.permission = p_permission
  ) or exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role = 'super_admin'
  );
$$;

create or replace function private.is_age_eligible(p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.age_assurance aa
    where aa.user_id = p_user_id and aa.status = 'eligible'
  );
$$;

create or replace function private.is_account_restricted(p_user_id uuid, p_type text)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.account_restrictions r
    where r.user_id = p_user_id
      and r.restriction_type in (p_type, 'account_access')
      and r.lifted_at is null
      and r.starts_at <= now()
      and (r.ends_at is null or r.ends_at > now())
  );
$$;

create or replace function private.has_block_relationship(p_user_id uuid, p_other_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_user_id and b.blocked_id = p_other_id)
       or (b.blocker_id = p_other_id and b.blocked_id = p_user_id)
  );
$$;

create or replace function private.are_friends(p_user_id uuid, p_other_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.friendships f
    where f.user_low_id = least(p_user_id, p_other_id)
      and f.user_high_id = greatest(p_user_id, p_other_id)
  );
$$;

create or replace function private.is_approved_follower(p_follower_id uuid, p_followed_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.follows f
    where f.follower_id = p_follower_id and f.followed_id = p_followed_id
  );
$$;

create or replace function private.can_view_profile(p_target_id uuid)
returns boolean language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  target_private boolean;
begin
  if viewer_id is null then return false; end if;
  if viewer_id = p_target_id then return true; end if;
  if not private.is_age_eligible(viewer_id) or not private.is_age_eligible(p_target_id) then return false; end if;
  if private.has_block_relationship(viewer_id, p_target_id) then return false; end if;
  if private.is_account_restricted(viewer_id, 'account_access')
     or private.is_account_restricted(p_target_id, 'account_access') then return false; end if;

  select p.is_private into target_private from public.profiles p where p.id = p_target_id;
  if target_private is null then return false; end if;
  return not target_private
    or private.is_approved_follower(viewer_id, p_target_id)
    or private.are_friends(viewer_id, p_target_id);
end;
$$;

create or replace function private.can_view_follower_list(p_target_id uuid)
returns boolean language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  list_visibility text;
begin
  if viewer_id is null then return false; end if;
  if viewer_id = p_target_id then return true; end if;
  if not private.can_view_profile(p_target_id) then return false; end if;
  select p.follower_list_visibility into list_visibility
  from public.profiles p where p.id = p_target_id;
  return list_visibility = 'public'
    or (list_visibility = 'followers' and private.is_approved_follower(viewer_id, p_target_id))
    or (list_visibility = 'friends' and private.are_friends(viewer_id, p_target_id));
end;
$$;

create or replace function private.can_view_post(p_author_id uuid, p_visibility text)
returns boolean language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then return false; end if;
  if viewer_id = p_author_id then return true; end if;
  if not private.is_age_eligible(viewer_id) or not private.is_age_eligible(p_author_id) then return false; end if;
  if private.has_block_relationship(viewer_id, p_author_id) then return false; end if;
  if private.is_account_restricted(viewer_id, 'account_access')
     or private.is_account_restricted(p_author_id, 'account_access') then return false; end if;

  if p_visibility = 'public' then return private.can_view_profile(p_author_id); end if;
  if p_visibility = 'followers' then
    return private.is_approved_follower(viewer_id, p_author_id)
      or private.are_friends(viewer_id, p_author_id);
  end if;
  if p_visibility = 'friends' then return private.are_friends(viewer_id, p_author_id); end if;
  return false;
end;
$$;

grant execute on all functions in schema private to authenticated, service_role;

-- Rebind every current RLS policy that references a public helper to its private copy.
do $$
declare
  pol record;
  using_sql text;
  check_sql text;
  alter_sql text;
begin
  for pol in
    select n.nspname as schema_name, c.relname as table_name, p.polname as policy_name,
           pg_get_expr(p.polqual, p.polrelid) as using_expr,
           pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and concat_ws(' ', pg_get_expr(p.polqual, p.polrelid),
                         pg_get_expr(p.polwithcheck, p.polrelid))
        ~ '(is_staff|has_permission|is_age_eligible|is_account_restricted|has_block_relationship|is_approved_follower|are_friends|can_view_profile|can_view_follower_list|can_view_post)'
  loop
    using_sql := pol.using_expr;
    check_sql := pol.check_expr;
    if using_sql is not null then
      using_sql := regexp_replace(using_sql,
        '\m(is_staff|has_permission|is_age_eligible|is_account_restricted|has_block_relationship|is_approved_follower|are_friends|can_view_profile|can_view_follower_list|can_view_post)\M',
        'private.\1', 'g');
    end if;
    if check_sql is not null then
      check_sql := regexp_replace(check_sql,
        '\m(is_staff|has_permission|is_age_eligible|is_account_restricted|has_block_relationship|is_approved_follower|are_friends|can_view_profile|can_view_follower_list|can_view_post)\M',
        'private.\1', 'g');
    end if;
    alter_sql := format('alter policy %I on %I.%I', pol.policy_name, pol.schema_name, pol.table_name);
    if using_sql is not null then alter_sql := alter_sql || format(' using (%s)', using_sql); end if;
    if check_sql is not null then alter_sql := alter_sql || format(' with check (%s)', check_sql); end if;
    execute alter_sql;
  end loop;
end;
$$;

-- Prevent direct RPC calls to internal public-schema authorization helpers.
revoke all on function public.is_staff() from public, anon, authenticated;
revoke all on function public.has_permission(text) from public, anon, authenticated;
revoke all on function public.is_age_eligible(uuid) from public, anon, authenticated;
revoke all on function public.is_account_restricted(uuid,text) from public, anon, authenticated;
revoke all on function public.has_block_relationship(uuid,uuid) from public, anon, authenticated;
revoke all on function public.are_friends(uuid,uuid) from public, anon, authenticated;
revoke all on function public.is_approved_follower(uuid,uuid) from public, anon, authenticated;
revoke all on function public.can_view_profile(uuid) from public, anon, authenticated;
revoke all on function public.can_view_follower_list(uuid) from public, anon, authenticated;
revoke all on function public.can_view_post(uuid,text) from public, anon, authenticated;
