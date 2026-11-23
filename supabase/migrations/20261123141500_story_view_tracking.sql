-- Record unique authenticated Story views without exposing the viewer list.
create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table public.story_views enable row level security;
revoke all on table public.story_views from public, anon, authenticated;

create or replace function public.record_story_view(p_story_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  story_owner uuid;
  inserted boolean := false;
begin
  if viewer_id is null then
    raise exception 'Sign in to view Stories.' using errcode = '42501';
  end if;

  select s.user_id into story_owner
  from public.stories s
  where s.id = p_story_id
    and s.expires_at > now()
    and private.ofsocio_member_is_eligible(viewer_id, false)
    and not private.ofsocio_blocked_with(s.user_id)
    and (
      s.user_id = viewer_id
      or exists (
        select 1 from public.follows f
        where f.follower_id = viewer_id and f.followed_id = s.user_id
      )
    );

  if story_owner is null then
    raise exception 'This Story is unavailable.' using errcode = '42501';
  end if;

  if story_owner = viewer_id then
    return false;
  end if;

  insert into public.story_views (story_id, viewer_id)
  values (p_story_id, viewer_id)
  on conflict (story_id, viewer_id) do nothing;
  inserted := found;
  return inserted;
end;
$$;

create or replace function public.get_my_story_view_count(p_story_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  total bigint;
begin
  if viewer_id is null or not exists (
    select 1 from public.stories s where s.id = p_story_id and s.user_id = viewer_id
  ) then
    raise exception 'This Story is unavailable.' using errcode = '42501';
  end if;
  select count(*) into total from public.story_views v where v.story_id = p_story_id;
  return total;
end;
$$;

revoke all on function public.record_story_view(uuid) from public, anon, authenticated;
revoke all on function public.get_my_story_view_count(uuid) from public, anon, authenticated;
grant execute on function public.record_story_view(uuid) to authenticated;
grant execute on function public.get_my_story_view_count(uuid) to authenticated;

comment on table public.story_views is
  'Unique Story view records. Viewers are not directly selectable; owners receive aggregate counts through a permission-checked RPC.';
