-- Suggest only eligible, public members. The RPC returns no private profiles.
create or replace function public.get_my_member_suggestions(p_limit integer default 6)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  mutual_follows bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  result_limit integer := least(greatest(coalesce(p_limit, 6), 1), 10);
begin
  if viewer_id is null then
    raise exception 'Sign in to see member suggestions.' using errcode = '42501';
  end if;
  if not private.ofsocio_member_is_eligible(viewer_id, false) then
    return;
  end if;

  return query
  select p.id, p.username, p.display_name, p.avatar_url, mutual.total
  from public.profiles p
  cross join lateral (
    select count(*)::bigint as total
    from public.follows mine
    join public.follows theirs on theirs.followed_id = mine.followed_id
    where mine.follower_id = viewer_id and theirs.follower_id = p.id
  ) mutual
  where p.id <> viewer_id
    and p.is_private = false
    and private.ofsocio_member_is_eligible(p.id, false)
    and private.ofsocio_profile_visible(p.id)
    and not private.ofsocio_blocked_with(p.id)
    and not exists (
      select 1 from public.follows f
      where f.follower_id = viewer_id and f.followed_id = p.id
    )
    and not exists (
      select 1 from public.follow_requests r
      where r.status = 'pending'
        and ((r.follower_id = viewer_id and r.followed_id = p.id)
          or (r.follower_id = p.id and r.followed_id = viewer_id))
    )
  order by mutual.total desc, p.created_at desc, p.id
  limit result_limit;
end;
$$;

revoke all on function public.get_my_member_suggestions(integer) from public, anon, authenticated;
grant execute on function public.get_my_member_suggestions(integer) to authenticated;

drop policy if exists "Members read avatars of visible profiles" on storage.objects;
create policy "Members read avatars of visible profiles" on storage.objects
for select to authenticated using (
  bucket_id = 'avatars'
  and exists (
    select 1 from public.profiles p
    where p.id::text = (storage.foldername(name))[1]
      and private.ofsocio_profile_visible(p.id)
      and not private.ofsocio_blocked_with(p.id)
  )
);

comment on function public.get_my_member_suggestions(integer) is
  'Returns a bounded, backend-filtered list of eligible public profiles, ranked by mutual follows.';
