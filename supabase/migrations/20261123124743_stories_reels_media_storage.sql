-- Private media storage for ephemeral Stories and published Reels.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-media',
  'social-media',
  false,
  104857600,
  array['image/jpeg','image/png','image/webp','video/mp4','video/webm']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  caption text not null default '' check (char_length(caption) <= 280),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (expires_at > created_at and expires_at <= created_at + interval '25 hours')
);

create index if not exists stories_active_created_idx
  on public.stories (expires_at, created_at desc);
create index if not exists stories_user_active_idx
  on public.stories (user_id, expires_at, created_at desc);

alter table public.stories enable row level security;
revoke all on table public.stories from public, anon, authenticated;
grant select on table public.stories to authenticated;
grant insert (user_id, media_path, media_type, caption) on table public.stories to authenticated;
grant delete on table public.stories to authenticated;

create policy "Members view active stories from visible circles" on public.stories
for select to authenticated using (
  expires_at > now()
  and private.ofsocio_member_is_eligible((select auth.uid()), false)
  and not private.ofsocio_blocked_with(user_id)
  and (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.followed_id = stories.user_id
    )
  )
);

create policy "Eligible members publish own stories" on public.stories
for insert to authenticated with check (
  user_id = (select auth.uid())
  and expires_at > now()
  and media_path like ((select auth.uid())::text || '/stories/%')
  and private.ofsocio_member_is_eligible((select auth.uid()), true)
);

create policy "Members delete own stories" on public.stories
for delete to authenticated using (user_id = (select auth.uid()));

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  video_path text not null unique,
  cover_path text,
  caption text not null default '' check (char_length(caption) <= 2200),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reels_published_created_idx
  on public.reels (created_at desc) where status = 'published';
create index if not exists reels_creator_created_idx
  on public.reels (creator_id, created_at desc);

alter table public.reels enable row level security;
revoke all on table public.reels from public, anon, authenticated;
grant select on table public.reels to authenticated;
grant insert (creator_id, video_path, cover_path, caption) on table public.reels to authenticated;
grant update (caption, cover_path, status, updated_at) on table public.reels to authenticated;
grant delete on table public.reels to authenticated;

create policy "Members view published reels and own drafts" on public.reels
for select to authenticated using (
  private.ofsocio_member_is_eligible((select auth.uid()), false)
  and not private.ofsocio_blocked_with(creator_id)
  and (creator_id = (select auth.uid()) or private.ofsocio_profile_visible(creator_id))
  and (status = 'published' or creator_id = (select auth.uid()))
);

create policy "Eligible members create own reels" on public.reels
for insert to authenticated with check (
  creator_id = (select auth.uid())
  and status = 'draft'
  and video_path like ((select auth.uid())::text || '/reels/%')
  and (cover_path is null or cover_path like ((select auth.uid())::text || '/reels/%'))
  and private.ofsocio_member_is_eligible((select auth.uid()), true)
);

create policy "Creators update own reels" on public.reels
for update to authenticated using (creator_id = (select auth.uid()))
with check (
  creator_id = (select auth.uid())
  and video_path like ((select auth.uid())::text || '/reels/%')
  and (cover_path is null or cover_path like ((select auth.uid())::text || '/reels/%'))
  and private.ofsocio_member_is_eligible((select auth.uid()), true)
);

create policy "Creators delete own reels" on public.reels
for delete to authenticated using (creator_id = (select auth.uid()));

create policy "Members upload own social media" on storage.objects
for insert to authenticated with check (
  bucket_id = 'social-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (storage.foldername(name))[2] in ('stories','reels')
  and private.ofsocio_member_is_eligible((select auth.uid()), true)
);

create policy "Members read visible social media" on storage.objects
for select to authenticated using (
  bucket_id = 'social-media'
  and (
    exists (
      select 1 from public.stories s
      where s.media_path = storage.objects.name
    )
    or exists (
      select 1 from public.reels r
      where (r.video_path = storage.objects.name or r.cover_path = storage.objects.name)
        and r.status = 'published'
    )
  )
);

create policy "Members delete own social media" on storage.objects
for delete to authenticated using (
  bucket_id = 'social-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

comment on table public.stories is 'Private, expiring Stories. Expired rows are hidden from members; storage cleanup must be scheduled separately.';
comment on table public.reels is 'Private video objects with authenticated, published-Reel discovery.';
