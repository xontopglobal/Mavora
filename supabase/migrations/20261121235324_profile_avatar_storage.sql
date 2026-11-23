-- Private profile-avatar storage. Apply only after review in a development project.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from storage.buckets
    where id = 'avatars'
      and name = 'avatars'
      and public = false
      and file_size_limit = 5242880
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
  ) then
    raise exception 'The avatars bucket exists with an unexpected configuration.';
  end if;
end;
$$;

grant update (avatar_url) on table public.profiles to authenticated;

create or replace function public.validate_profile_avatar_path()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.avatar_url is distinct from old.avatar_url and new.avatar_url is not null then
    if pg_catalog.split_part(new.avatar_url, '/', 1) <> new.id::text
      or not exists (
        select 1
        from storage.objects as avatar_object
        where avatar_object.bucket_id = 'avatars'
          and avatar_object.name = new.avatar_url
          and (storage.foldername(avatar_object.name))[1] = new.id::text
      ) then
      raise exception 'Avatar must reference an existing object in the profile owner folder.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_profile_avatar_path() from public, anon, authenticated;

drop trigger if exists validate_profile_avatar_path on public.profiles;
create trigger validate_profile_avatar_path
before update of avatar_url on public.profiles
for each row execute function public.validate_profile_avatar_path();

drop policy if exists "Users read own avatars" on storage.objects;
create policy "Users read own avatars" on storage.objects
for select to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users upload own avatars" on storage.objects;
create policy "Users upload own avatars" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users delete own avatars" on storage.objects;
create policy "Users delete own avatars" on storage.objects
for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
