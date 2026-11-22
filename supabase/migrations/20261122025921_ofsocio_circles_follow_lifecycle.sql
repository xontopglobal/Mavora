-- Circles discovery and follow requests.
-- RLS protects direct reads/deletes; narrowly scoped RPCs perform inserts and
-- request decisions after validating auth.uid(), visibility, age, and blocks.

alter table public.profiles
  add column if not exists is_private boolean not null default false;

create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (follower_id <> followed_id)
);

create unique index if not exists follow_requests_one_pending_pair_idx
  on public.follow_requests (follower_id, followed_id)
  where status = 'pending';
create index if not exists follow_requests_recipient_status_idx
  on public.follow_requests (followed_id, status, created_at desc);

alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.follow_requests enable row level security;

-- Keep profile reads to fields used by the authenticated frontend. The phone
-- number and follower-list preference are deliberately excluded.
revoke select, insert on table public.profiles from public, anon, authenticated;
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
      'revoke select (%1$I), insert (%1$I) on table public.profiles from public, anon, authenticated',
      profile_column.attname
    );
  end loop;
end;
$$;

grant select (
  id, username, display_name, bio, country_code, preferred_language,
  preferred_currency, timezone, avatar_url, updated_at, is_private
) on table public.profiles to authenticated;
grant insert (id, display_name) on table public.profiles to authenticated;

drop policy if exists "Users create own profile" on public.profiles;
create policy "Users create own profile" on public.profiles
for insert to authenticated
with check ((select auth.uid()) = id);

-- The helper schema is not a Data API schema. Only the profile visibility
-- predicate is executable by authenticated users for its RLS policy.
create schema if not exists private;
grant usage on schema private to authenticated;

-- These helpers enforce the development project's age and account restrictions.
-- Stop here rather than silently allowing follow actions if the schema is
-- missing the protections this migration relies on.
do $$
begin
  if pg_catalog.to_regprocedure('private.is_age_eligible(uuid)') is null
     or pg_catalog.to_regprocedure('private.is_account_restricted(uuid,text)') is null then
    raise exception 'Required profile eligibility helpers are missing; reconcile and apply their migrations first.';
  end if;
end;
$$;

create or replace function private.ofsocio_member_is_eligible(p_user_id uuid, p_check_posting boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  is_allowed boolean;
begin
  if p_user_id is null then
    return false;
  end if;

  if pg_catalog.to_regprocedure('private.is_age_eligible(uuid)') is null then return false; end if;
  execute 'select private.is_age_eligible($1)' into is_allowed using p_user_id;
  if is_allowed is distinct from true then return false; end if;

  if pg_catalog.to_regprocedure('private.is_account_restricted(uuid,text)') is null then return false; end if;
  execute 'select not private.is_account_restricted($1, $2)'
    into is_allowed using p_user_id, 'account_access';
  if is_allowed is distinct from true then return false; end if;
  if p_check_posting then
    execute 'select not private.is_account_restricted($1, $2)'
      into is_allowed using p_user_id, 'posting';
    if is_allowed is distinct from true then return false; end if;
  end if;

  return true;
end;
$$;

create or replace function private.ofsocio_blocked_with(p_other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is null
    or p_other_id is null
    or exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_id = p_other_id)
         or (b.blocker_id = p_other_id and b.blocked_id = (select auth.uid()))
    );
$$;

create or replace function private.ofsocio_profile_visible(p_target_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  target_private boolean;
  are_friends boolean := false;
begin
  if viewer_id is null or p_target_id is null then return false; end if;
  if viewer_id = p_target_id then return true; end if;
  if not private.ofsocio_member_is_eligible(viewer_id, false)
     or not private.ofsocio_member_is_eligible(p_target_id, false)
     or private.ofsocio_blocked_with(p_target_id) then
    return false;
  end if;

  select p.is_private into target_private
  from public.profiles p
  where p.id = p_target_id;
  if not found then return false; end if;
  if not target_private then return true; end if;

  if exists (
    select 1 from public.follows f
    where f.follower_id = viewer_id and f.followed_id = p_target_id
  ) then
    return true;
  end if;

  if pg_catalog.to_regclass('public.friendships') is not null then
    execute 'select exists (
      select 1 from public.friendships f
      where f.user_low_id = least($1, $2)
        and f.user_high_id = greatest($1, $2)
    )' into are_friends using viewer_id, p_target_id;
  end if;
  return are_friends;
end;
$$;

revoke all on function private.ofsocio_member_is_eligible(uuid, boolean) from public, anon, authenticated;
revoke all on function private.ofsocio_blocked_with(uuid) from public, anon, authenticated;
revoke all on function private.ofsocio_profile_visible(uuid) from public, anon, authenticated;
grant execute on function private.ofsocio_blocked_with(uuid) to authenticated;
grant execute on function private.ofsocio_profile_visible(uuid) to authenticated;

-- Replace the permissive starter profile read policy with the privacy-aware
-- rule used by the development project. Other authenticated users see only
-- public profiles, approved followers, or friends; blocks and age controls
-- are checked by the helper above.
drop policy if exists "Profiles visible to authenticated users" on public.profiles;
drop policy if exists "Visible profiles respect age privacy and blocks" on public.profiles;
drop policy if exists "Ofsocio privacy-aware profile reads" on public.profiles;
create policy "Ofsocio privacy-aware profile reads" on public.profiles
for select to authenticated
using (private.ofsocio_profile_visible(id));

-- Direct inserts and status edits are intentionally unavailable. The RPCs
-- below are the only path for sending or accepting a follow request.
revoke all privileges on table public.follows, public.follow_requests
  from public, anon, authenticated;
do $$
declare
  target_table text;
  target_column record;
begin
  for target_table in select unnest(array['follows', 'follow_requests']::text[])
  loop
    for target_column in
      select attname
      from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(pg_catalog.format('public.%I', target_table))
        and attnum > 0
        and not attisdropped
    loop
      execute pg_catalog.format(
        'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table public.%2$I from public, anon, authenticated',
        target_column.attname,
        target_table
      );
    end loop;
  end loop;
end;
$$;
grant select, delete on table public.follows to authenticated;
grant select on table public.follow_requests to authenticated;

drop policy if exists "Users manage own follows" on public.follows;
drop policy if exists "Follow public eligible profiles" on public.follows;
drop policy if exists "Unfollow own relationship" on public.follows;
drop policy if exists "Visible follow lists" on public.follows;
drop policy if exists "Ofsocio participants read follow relationships" on public.follows;
create policy "Ofsocio participants read follow relationships" on public.follows
for select to authenticated
using (
  (follower_id = (select auth.uid()) or followed_id = (select auth.uid()))
  and not private.ofsocio_blocked_with(
    case when follower_id = (select auth.uid()) then followed_id else follower_id end
  )
);
create policy "Unfollow own relationship" on public.follows
for delete to authenticated
using (
  follower_id = (select auth.uid())
  and not private.ofsocio_blocked_with(followed_id)
);

drop policy if exists "Eligible users request private follows" on public.follow_requests;
drop policy if exists "Follow participants read requests" on public.follow_requests;
drop policy if exists "Followers cancel pending requests" on public.follow_requests;
drop policy if exists "Followers cancel own pending requests" on public.follow_requests;
drop policy if exists "Ofsocio participants read follow requests" on public.follow_requests;
create policy "Ofsocio participants read follow requests" on public.follow_requests
for select to authenticated
using (
  (follower_id = (select auth.uid()) or followed_id = (select auth.uid()))
  and not private.ofsocio_blocked_with(
    case when follower_id = (select auth.uid()) then followed_id else follower_id end
  )
);
create or replace function public.search_ofsocio_people(p_query text)
returns table(id uuid, username text, display_name text, is_private boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  query_text text := pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_query, '')), '^@', ''));
  candidate record;
begin
  if viewer_id is null then
    raise exception 'Sign in to search for members.' using errcode = '42501';
  end if;
  if pg_catalog.char_length(query_text) < 2 or pg_catalog.char_length(query_text) > 64 then
    raise exception 'Search must be between 2 and 64 characters.' using errcode = '22023';
  end if;
  if not private.ofsocio_member_is_eligible(viewer_id, false) then return; end if;

  for candidate in
    select p.id, p.username, p.display_name, p.is_private
    from public.profiles p
    where p.id <> viewer_id
      and (
        (p.is_private and pg_catalog.lower(coalesce(p.username, '')) = query_text)
        or (
          not p.is_private
          and (
            pg_catalog.strpos(pg_catalog.lower(coalesce(p.username, '')), query_text) > 0
            or pg_catalog.strpos(pg_catalog.lower(coalesce(p.display_name, '')), query_text) > 0
          )
        )
      )
    order by
      (pg_catalog.lower(coalesce(p.username, '')) = query_text) desc,
      pg_catalog.lower(coalesce(p.username, ''))
    limit 25
  loop
    if private.ofsocio_blocked_with(candidate.id)
       or not private.ofsocio_member_is_eligible(candidate.id, false) then
      continue;
    end if;
    id := candidate.id;
    username := candidate.username;
    -- Private accounts are discoverable only by exact username and disclose
    -- no display name, avatar, bio, location, phone, or other profile fields.
    display_name := case when candidate.is_private then null else candidate.display_name end;
    is_private := candidate.is_private;
    return next;
  end loop;
end;
$$;

create or replace function public.request_ofsocio_follow(p_target_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  target_private boolean;
begin
  if viewer_id is null then raise exception 'Sign in to follow members.' using errcode = '42501'; end if;
  if p_target_id is null or p_target_id = viewer_id then
    raise exception 'You cannot follow yourself.' using errcode = '22023';
  end if;
  if not private.ofsocio_member_is_eligible(viewer_id, true)
     or not private.ofsocio_member_is_eligible(p_target_id, false)
     or private.ofsocio_blocked_with(p_target_id) then
    raise exception 'This follow action is unavailable.' using errcode = '42501';
  end if;

  -- Serialize this decision with concurrent privacy changes. The lock is held
  -- until this transaction finishes inserting a follow or follow request.
  select p.is_private into target_private
  from public.profiles p
  where p.id = p_target_id
  for share;
  if not found then raise exception 'This member is unavailable.' using errcode = 'P0002'; end if;

  if exists (
    select 1 from public.follows f
    where f.follower_id = viewer_id and f.followed_id = p_target_id
  ) then
    return 'following';
  end if;

  if target_private then
    insert into public.follow_requests (follower_id, followed_id, status)
    values (viewer_id, p_target_id, 'pending')
    on conflict (follower_id, followed_id) where status = 'pending' do nothing;
    return 'pending';
  end if;

  insert into public.follows (follower_id, followed_id)
  values (viewer_id, p_target_id)
  on conflict (follower_id, followed_id) do nothing;
  -- If the account became public while an earlier request was pending, do not
  -- leave an obsolete request that can later be accepted independently.
  update public.follow_requests
  set status = 'cancelled', updated_at = pg_catalog.now()
  where follower_id = viewer_id
    and followed_id = p_target_id
    and status = 'pending';
  return 'following';
end;
$$;

create or replace function public.respond_to_ofsocio_follow_request(p_request_id uuid, p_decision text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  request_row public.follow_requests%rowtype;
begin
  if viewer_id is null then raise exception 'Sign in to manage follow requests.' using errcode = '42501'; end if;
  if p_decision is null or p_decision not in ('accept', 'reject') then
    raise exception 'Choose accept or reject.' using errcode = '22023';
  end if;

  select r.* into request_row
  from public.follow_requests r
  where r.id = p_request_id
  for update;
  if not found or request_row.followed_id <> viewer_id or request_row.status <> 'pending' then
    raise exception 'This follow request is unavailable.' using errcode = '42501';
  end if;

  if p_decision = 'accept' then
    if private.ofsocio_blocked_with(request_row.follower_id)
       or not private.ofsocio_member_is_eligible(viewer_id, false)
       or not private.ofsocio_member_is_eligible(request_row.follower_id, true) then
      raise exception 'This follow request cannot be accepted.' using errcode = '42501';
    end if;
    insert into public.follows (follower_id, followed_id)
    values (request_row.follower_id, request_row.followed_id)
    on conflict (follower_id, followed_id) do nothing;
  end if;

  update public.follow_requests
  set status = case when p_decision = 'accept' then 'accepted' else 'declined' end,
      updated_at = pg_catalog.now()
  where id = request_row.id;
  return case when p_decision = 'accept' then 'accepted' else 'declined' end;
end;
$$;

create or replace function public.cancel_ofsocio_follow_request(p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  deleted_id uuid;
begin
  if viewer_id is null then raise exception 'Sign in to manage follow requests.' using errcode = '42501'; end if;
  delete from public.follow_requests r
  where r.id = p_request_id
    and r.follower_id = viewer_id
    and r.status = 'pending'
  returning r.id into deleted_id;
  if deleted_id is null then
    raise exception 'This follow request is unavailable.' using errcode = '42501';
  end if;
  return 'cancelled';
end;
$$;

create or replace function public.get_my_follow_requests()
returns table(
  request_id uuid,
  direction text,
  profile_id uuid,
  username text,
  display_name text,
  is_private boolean,
  is_blocked boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
begin
  if viewer_id is null then raise exception 'Sign in to view follow requests.' using errcode = '42501'; end if;

  return query
  select r.id,
    case when r.follower_id = viewer_id then 'outgoing' else 'incoming' end,
    p.id,
    case when private.ofsocio_blocked_with(p.id) then null else p.username end,
    case when p.is_private or private.ofsocio_blocked_with(p.id) then null else p.display_name end,
    p.is_private,
    private.ofsocio_blocked_with(p.id),
    r.created_at
  from public.follow_requests r
  join public.profiles p on p.id = case when r.follower_id = viewer_id then r.followed_id else r.follower_id end
  where (r.follower_id = viewer_id or r.followed_id = viewer_id)
    and r.status = 'pending'
  order by r.created_at desc;
end;
$$;

revoke all on function public.search_ofsocio_people(text) from public, anon, authenticated;
revoke all on function public.request_ofsocio_follow(uuid) from public, anon, authenticated;
revoke all on function public.respond_to_ofsocio_follow_request(uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_ofsocio_follow_request(uuid) from public, anon, authenticated;
revoke all on function public.get_my_follow_requests() from public, anon, authenticated;
grant execute on function public.search_ofsocio_people(text) to authenticated;
grant execute on function public.request_ofsocio_follow(uuid) to authenticated;
grant execute on function public.respond_to_ofsocio_follow_request(uuid, text) to authenticated;
grant execute on function public.cancel_ofsocio_follow_request(uuid) to authenticated;
grant execute on function public.get_my_follow_requests() to authenticated;
