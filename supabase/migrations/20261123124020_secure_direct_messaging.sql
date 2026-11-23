-- Secure one-to-one messaging using the existing conversations, members, and messages tables.
-- Direct table access remains constrained by the established RLS policies.

grant select on table public.messages to authenticated;
grant insert (conversation_id, sender_id, body) on table public.messages to authenticated;

create or replace function public.get_my_conversations()
returns table (
  conversation_id uuid,
  created_at timestamptz,
  other_user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  last_message text,
  last_message_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
begin
  if viewer_id is null then
    raise exception 'Sign in to view conversations.' using errcode = '42501';
  end if;

  return query
  select c.id,
         c.created_at,
         other_member.user_id,
         p.username,
         p.display_name,
         p.avatar_url,
         latest.body,
         latest.created_at
  from public.conversations c
  join public.conversation_members own_member
    on own_member.conversation_id = c.id and own_member.user_id = viewer_id
  join public.conversation_members other_member
    on other_member.conversation_id = c.id and other_member.user_id <> viewer_id
  join public.profiles p on p.id = other_member.user_id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest on true
  where (select count(*) from public.conversation_members members where members.conversation_id = c.id) = 2
    and private.ofsocio_member_is_eligible(viewer_id, false)
    and private.ofsocio_profile_visible(other_member.user_id)
  order by coalesce(latest.created_at, c.created_at) desc, c.id desc;
end;
$$;

create or replace function public.create_or_get_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := (select auth.uid());
  v_conversation_id uuid;
  lock_key bigint;
begin
  if viewer_id is null then
    raise exception 'Sign in to start a conversation.' using errcode = '42501';
  end if;
  if p_other_user_id is null or p_other_user_id = viewer_id then
    raise exception 'Choose another Ofsocio member.' using errcode = '22023';
  end if;
  if not private.ofsocio_member_is_eligible(viewer_id, false)
     or not private.ofsocio_member_is_eligible(p_other_user_id, false)
     or not private.ofsocio_profile_visible(p_other_user_id) then
    raise exception 'This conversation is unavailable.' using errcode = '42501';
  end if;

  lock_key := pg_catalog.hashtextextended(
    least(viewer_id::text, p_other_user_id::text) || ':' || greatest(viewer_id::text, p_other_user_id::text),
    0
  );
  perform pg_catalog.pg_advisory_xact_lock(lock_key);

  select c.id into v_conversation_id
  from public.conversations c
  where exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = c.id and cm.user_id = viewer_id
    )
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = c.id and cm.user_id = p_other_user_id
    )
    and (select count(*) from public.conversation_members cm where cm.conversation_id = c.id) = 2
  order by c.created_at desc
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations default values returning id into v_conversation_id;
  insert into public.conversation_members (conversation_id, user_id)
  values (v_conversation_id, viewer_id), (v_conversation_id, p_other_user_id);
  return v_conversation_id;
end;
$$;

revoke all on function public.get_my_conversations() from public, anon, authenticated;
revoke all on function public.create_or_get_conversation(uuid) from public, anon, authenticated;
grant execute on function public.get_my_conversations() to authenticated;
grant execute on function public.create_or_get_conversation(uuid) to authenticated;

comment on function public.get_my_conversations() is
  'Returns only the signed-in user’s eligible one-to-one conversations and the other participant’s public profile fields.';
comment on function public.create_or_get_conversation(uuid) is
  'Atomically creates or returns a one-to-one conversation after eligibility, profile visibility, and block checks.';

do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_catalog.pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
     ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;
