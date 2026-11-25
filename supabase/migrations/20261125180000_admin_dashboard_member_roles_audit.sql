-- Ofsocio Admin Dashboard Phase 1: secure metrics, member directory, role changes and audit log.
-- Apply after the existing migrations. RLS stays enabled; only support-ticket policies are replaced with the current member/staff access rules.


grant usage on schema public to authenticated;

-- Ensure the support tables used by the current Ofsocio customer-service UI exist.
-- Existing ticket rows are preserved; legacy user_id/body columns are copied when present.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) on delete cascade,
  subject text not null default 'Support request',
  category text not null default 'other',
  description text not null default '',
  status text not null default 'open',
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_tickets add column if not exists requester_id uuid references auth.users(id) on delete cascade;
alter table public.support_tickets add column if not exists subject text default 'Support request';
alter table public.support_tickets add column if not exists category text default 'other';
alter table public.support_tickets add column if not exists description text default '';
alter table public.support_tickets add column if not exists status text default 'open';
alter table public.support_tickets add column if not exists assigned_to uuid references auth.users(id) on delete set null;
alter table public.support_tickets add column if not exists created_at timestamptz default now();
alter table public.support_tickets add column if not exists updated_at timestamptz default now();
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='support_tickets' and column_name='user_id') then
    execute 'update public.support_tickets set requester_id=user_id where requester_id is null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='support_tickets' and column_name='body') then
    execute $sql$update public.support_tickets set description=body where description is null or description = ''$sql$;
  end if;
end;
$$;
update public.support_tickets set subject='Support request' where subject is null or btrim(subject)='';
update public.support_tickets set category='other' where category is null or btrim(category)='';
update public.support_tickets set description='No description provided' where description is null or btrim(description)='';
update public.support_tickets set status='open' where status is null or status not in ('open','in_progress','waiting_customer','escalated','resolved','closed');
update public.support_tickets set created_at=now() where created_at is null;
update public.support_tickets set updated_at=coalesce(updated_at,created_at,now()) where updated_at is null;
alter table public.support_tickets alter column subject set default 'Support request';
alter table public.support_tickets alter column subject set not null;
alter table public.support_tickets alter column category set default 'other';
alter table public.support_tickets alter column category set not null;
alter table public.support_tickets alter column description set default 'No description provided';
alter table public.support_tickets alter column description set not null;
alter table public.support_tickets alter column status set default 'open';
alter table public.support_tickets alter column status set not null;
alter table public.support_tickets alter column created_at set default now();
alter table public.support_tickets alter column created_at set not null;
alter table public.support_tickets alter column updated_at set default now();
alter table public.support_tickets alter column updated_at set not null;

-- If an older support schema used user_id/body, keep those legacy NOT NULL columns
-- synchronized while the current client writes requester_id/description.
create or replace function public.ofsocio_sync_support_ticket_legacy_fields()
returns trigger language plpgsql set search_path=public,pg_temp
as $$
declare row_json jsonb;
begin
  row_json:=to_jsonb(new);
  if row_json ? 'user_id' and new.requester_id is not null then
    new:=jsonb_populate_record(new,jsonb_build_object('user_id',new.requester_id));
  end if;
  row_json:=to_jsonb(new);
  if row_json ? 'body' and new.description is not null then
    new:=jsonb_populate_record(new,jsonb_build_object('body',new.description));
  end if;
  return new;
end;
$$;
revoke all on function public.ofsocio_sync_support_ticket_legacy_fields() from public;
drop trigger if exists ofsocio_sync_support_ticket_legacy_fields on public.support_tickets;
create trigger ofsocio_sync_support_ticket_legacy_fields before insert or update on public.support_tickets
for each row execute function public.ofsocio_sync_support_ticket_legacy_fields();

do $$
declare c record;
begin
  for c in select conname from pg_constraint where conrelid='public.support_tickets'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table public.support_tickets drop constraint %I',c.conname);
  end loop;
end;
$$;
alter table public.support_tickets add constraint support_tickets_status_check
  check (status in ('open','in_progress','waiting_customer','escalated','resolved','closed'));
create index if not exists support_tickets_updated_idx on public.support_tickets(updated_at desc);
create index if not exists support_tickets_requester_idx on public.support_tickets(requester_id,updated_at desc);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_kind text not null check(sender_kind in ('customer','staff')),
  body text not null check(char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
alter table public.support_ticket_messages add column if not exists ticket_id uuid references public.support_tickets(id) on delete cascade;
alter table public.support_ticket_messages add column if not exists sender_id uuid references auth.users(id) on delete cascade;
alter table public.support_ticket_messages add column if not exists sender_kind text default 'customer';
alter table public.support_ticket_messages add column if not exists body text default 'Message unavailable';
alter table public.support_ticket_messages add column if not exists created_at timestamptz default now();
update public.support_ticket_messages set sender_kind='customer' where sender_kind is null or sender_kind not in ('customer','staff');
update public.support_ticket_messages set body='Message unavailable' where body is null or btrim(body)='';
update public.support_ticket_messages set created_at=now() where created_at is null;
alter table public.support_ticket_messages alter column sender_kind set default 'customer';
alter table public.support_ticket_messages alter column sender_kind set not null;
alter table public.support_ticket_messages alter column body set default 'Message unavailable';
alter table public.support_ticket_messages alter column body set not null;
alter table public.support_ticket_messages alter column created_at set default now();
alter table public.support_ticket_messages alter column created_at set not null;
create index if not exists support_ticket_messages_ticket_created_idx on public.support_ticket_messages(ticket_id,created_at);

create or replace function public.ofsocio_is_support_staff()
returns boolean language sql stable security definer set search_path=public,pg_temp
as $$ select exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('support','admin','super_admin')); $$;
revoke all on function public.ofsocio_is_support_staff() from public;
grant execute on function public.ofsocio_is_support_staff() to authenticated;

-- Support staff can see only the profile columns already approved for authenticated clients,
-- including the requester identity needed to answer a ticket. Phone numbers remain ungranted.
revoke select on public.profiles from authenticated;
grant select (id,username,display_name,bio,country_code,preferred_language,preferred_currency,timezone,avatar_url,created_at,updated_at,is_private,follower_list_visibility)
  on public.profiles to authenticated;
drop policy if exists "Ofsocio support staff see ticket requester profiles" on public.profiles;
create policy "Ofsocio support staff see ticket requester profiles" on public.profiles
for select to authenticated using (public.ofsocio_is_support_staff());

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
revoke all on public.support_tickets from anon,authenticated;
revoke all on public.support_ticket_messages from anon,authenticated;
grant select,insert on public.support_tickets to authenticated;
grant select,insert on public.support_ticket_messages to authenticated;
do $$
declare p record;
begin
  for p in select policyname,tablename from pg_policies where schemaname='public' and tablename in ('support_tickets','support_ticket_messages') loop
    execute format('drop policy if exists %I on public.%I',p.policyname,p.tablename);
  end loop;
end;
$$;
drop policy if exists "Ofsocio members and staff read support tickets" on public.support_tickets;
create policy "Ofsocio members and staff read support tickets" on public.support_tickets
for select to authenticated using (requester_id=auth.uid() or public.ofsocio_is_support_staff());
drop policy if exists "Ofsocio member creates own support tickets" on public.support_tickets;
create policy "Ofsocio member creates own support tickets" on public.support_tickets
for insert to authenticated with check (requester_id=auth.uid() and status='open' and assigned_to is null);
drop policy if exists "Ofsocio ticket participants read messages" on public.support_ticket_messages;
create policy "Ofsocio ticket participants read messages" on public.support_ticket_messages
for select to authenticated using (
  exists(select 1 from public.support_tickets t where t.id=support_ticket_messages.ticket_id and (t.requester_id=auth.uid() or public.ofsocio_is_support_staff()))
);
drop policy if exists "Ofsocio customers append own ticket messages" on public.support_ticket_messages;
create policy "Ofsocio customers append own ticket messages" on public.support_ticket_messages
for insert to authenticated with check (
  sender_id=auth.uid() and sender_kind='customer' and exists(
    select 1 from public.support_tickets t where t.id=support_ticket_messages.ticket_id and t.requester_id=auth.uid()
      and t.status in ('open','in_progress','waiting_customer','escalated')
  )
);
drop policy if exists "Authorized support staff reply to tickets" on public.support_ticket_messages;
drop policy if exists "Ofsocio staff append ticket messages" on public.support_ticket_messages;
create policy "Ofsocio staff append ticket messages" on public.support_ticket_messages
for insert to authenticated with check (sender_id=auth.uid() and sender_kind='staff' and public.ofsocio_is_support_staff()
  and exists(select 1 from public.support_tickets t where t.id=support_ticket_messages.ticket_id));

create table if not exists public.staff_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists staff_audit_log_created_idx on public.staff_audit_log(created_at desc);
create index if not exists staff_audit_log_entity_idx on public.staff_audit_log(entity_type, entity_id, created_at desc);
alter table public.staff_audit_log enable row level security;
drop policy if exists "Admins read staff audit log" on public.staff_audit_log;
create policy "Admins read staff audit log" on public.staff_audit_log
for select to authenticated using (
  exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('admin','super_admin'))
);
grant select on public.staff_audit_log to authenticated;

create or replace function public.ofsocio_audit_staff_ticket_message()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_role text;
begin
  if new.sender_kind='staff' then
    select role into v_role from public.user_roles where user_id=new.sender_id;
    insert into public.staff_audit_log(actor_id,actor_role,action,entity_type,entity_id,details)
    values(new.sender_id,coalesce(v_role,'support'),'support_ticket_replied','support_ticket',new.ticket_id,
      jsonb_build_object('message_id',new.id,'body_length',char_length(new.body)));
  end if;
  return new;
end;
$$;
revoke all on function public.ofsocio_audit_staff_ticket_message() from public;
drop trigger if exists ofsocio_audit_staff_ticket_message on public.support_ticket_messages;
create trigger ofsocio_audit_staff_ticket_message after insert on public.support_ticket_messages
for each row execute function public.ofsocio_audit_staff_ticket_message();

create or replace function public.ofsocio_staff_update_support_ticket(p_ticket_id uuid,p_status text,p_assigned_to uuid default null)
returns public.support_tickets language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_before public.support_tickets; v_after public.support_tickets; v_role text;
begin
  if auth.uid() is null or not public.ofsocio_is_support_staff() then raise exception 'Customer-service staff access required' using errcode='42501'; end if;
  if p_status is null or p_status not in ('open','in_progress','waiting_customer','escalated','resolved','closed') then raise exception 'Invalid support status' using errcode='22023'; end if;
  if p_assigned_to is not null and not exists(select 1 from public.user_roles where user_id=p_assigned_to and role in ('support','admin','super_admin')) then
    raise exception 'Assignee must have a customer-service or admin role' using errcode='42501';
  end if;
  select role into v_role from public.user_roles where user_id=auth.uid();
  select * into v_before from public.support_tickets where id=p_ticket_id for update;
  if not found then raise exception 'Support ticket not found' using errcode='P0002'; end if;
  update public.support_tickets set status=p_status,assigned_to=p_assigned_to,updated_at=now() where id=p_ticket_id returning * into v_after;
  insert into public.staff_audit_log(actor_id,actor_role,action,entity_type,entity_id,details)
  values(auth.uid(),v_role,'support_ticket_updated','support_ticket',p_ticket_id,
    jsonb_build_object('previous_status',v_before.status,'new_status',v_after.status,'previous_assignee',v_before.assigned_to,'new_assignee',v_after.assigned_to));
  return v_after;
end;
$$;
revoke all on function public.ofsocio_staff_update_support_ticket(uuid,text,uuid) from public;
grant execute on function public.ofsocio_staff_update_support_ticket(uuid,text,uuid) to authenticated;

create or replace function public.ofsocio_admin_check()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('admin','super_admin'));
$$;
revoke all on function public.ofsocio_admin_check() from public;
grant execute on function public.ofsocio_admin_check() to authenticated;

create or replace function public.admin_dashboard_summary()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.ofsocio_admin_check() then raise exception 'Admin access required' using errcode='42501'; end if;
  select jsonb_build_object(
    'members_total',(select count(*) from public.profiles),
    'posts_total',(select count(*) from public.posts),
    'reports_open',(select count(*) from public.content_reports where status in ('open','reviewing')),
    'tickets_open',(select count(*) from public.support_tickets where status in ('open','in_progress','waiting_customer','escalated')),
    'premium_active',(select count(*) from public.subscriptions where plan='premium' and status='active'),
    'ads_pending',(select count(*) from public.ad_campaigns where status='pending_review')
  ) into result;
  return result;
end;
$$;

create or replace function public.admin_list_members(p_search text default null,p_limit integer default 50,p_offset integer default 0)
returns table(member_id uuid,username text,display_name text,email text,role text,created_at timestamptz)
language plpgsql stable security definer set search_path = public, auth, pg_temp
as $$
declare search_text text:=left(trim(coalesce(p_search,'')),100); row_limit integer:=least(greatest(coalesce(p_limit,50),1),100); row_offset integer:=greatest(coalesce(p_offset,0),0);
begin
  if auth.uid() is null or not public.ofsocio_admin_check() then raise exception 'Admin access required' using errcode='42501'; end if;
  return query
    select p.id,p.username,p.display_name,u.email::text,coalesce(ur.role,'user'),p.created_at
    from public.profiles p
    join auth.users u on u.id=p.id
    left join public.user_roles ur on ur.user_id=p.id
    where search_text='' or p.username ilike '%'||search_text||'%'
      or p.display_name ilike '%'||search_text||'%'
      or u.email ilike '%'||search_text||'%'
    order by p.created_at desc nulls last
    limit row_limit offset row_offset;
end;
$$;

create or replace function public.admin_set_member_role(p_user_id uuid,p_role text,p_reason text default null)
returns text language plpgsql security definer set search_path = public, pg_temp
as $$
declare caller_role text; target_role text; super_admin_count integer;
begin
  if auth.uid() is null or not public.ofsocio_admin_check() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_role is null or p_role not in ('user','moderator','support','admin','super_admin') then raise exception 'Invalid role' using errcode='22023'; end if;
  if p_user_id is null or p_user_id=auth.uid() then raise exception 'You cannot change your own role' using errcode='42501'; end if;
  select role into caller_role from public.user_roles where user_id=auth.uid();
  select role into target_role from public.user_roles where user_id=p_user_id;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Member not found'; end if;
  if caller_role <> 'super_admin' and (p_role in ('admin','super_admin') or target_role in ('admin','super_admin')) then
    raise exception 'Only a super administrator can grant or modify admin roles' using errcode='42501';
  end if;
  if target_role='super_admin' and p_role<>'super_admin' then
    select count(*) into super_admin_count from public.user_roles where role='super_admin';
    if super_admin_count <= 1 then raise exception 'The last super administrator cannot be demoted' using errcode='42501'; end if;
  end if;
  insert into public.user_roles(user_id,role) values(p_user_id,p_role)
  on conflict(user_id) do update set role=excluded.role;
  insert into public.staff_audit_log(actor_id,actor_role,action,entity_type,entity_id,details)
  values(auth.uid(),caller_role,'member_role_changed','member',p_user_id,
    jsonb_build_object('previous_role',coalesce(target_role,'user'),'new_role',p_role,'reason',left(coalesce(p_reason,''),500)));
  return p_role;
end;
$$;

create or replace function public.admin_list_staff_audit(p_limit integer default 50)
returns table(id uuid,actor_id uuid,actor_role text,action text,entity_type text,entity_id uuid,details jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.ofsocio_admin_check() then raise exception 'Admin access required' using errcode='42501'; end if;
  return query select a.id,a.actor_id,a.actor_role,a.action,a.entity_type,a.entity_id,a.details,a.created_at
    from public.staff_audit_log a order by a.created_at desc limit least(greatest(coalesce(p_limit,50),1),100);
end;
$$;


create or replace function public.admin_dashboard_review_report(p_report_id uuid,p_status text,p_reason_category text default null)
returns public.content_reports language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_before public.content_reports; v_after public.content_reports; v_role text;
begin
  if auth.uid() is null or not public.ofsocio_admin_check() then raise exception 'Admin access required' using errcode='42501'; end if;
  if p_status is null or p_status not in ('open','reviewing','resolved','dismissed') then raise exception 'Invalid report status' using errcode='22023'; end if;
  select role into v_role from public.user_roles where user_id=auth.uid();
  select * into v_before from public.content_reports where id=p_report_id for update;
  if not found then raise exception 'Content report not found' using errcode='P0002'; end if;
  update public.content_reports set status=p_status where id=p_report_id returning * into v_after;
  insert into public.staff_audit_log(actor_id,actor_role,action,entity_type,entity_id,details)
  values(auth.uid(),v_role,'content_report_reviewed','content_report',p_report_id,
    jsonb_build_object('previous_status',v_before.status,'new_status',v_after.status,'reason_category',left(coalesce(p_reason_category,''),100),'target_type',v_after.target_type,'target_id',v_after.target_id));
  return v_after;
end;
$$;
revoke all on function public.admin_dashboard_review_report(uuid,text,text) from public;
grant execute on function public.admin_dashboard_review_report(uuid,text,text) to authenticated;

revoke all on function public.admin_dashboard_summary() from public;
revoke all on function public.admin_list_members(text,integer,integer) from public;
revoke all on function public.admin_set_member_role(uuid,text,text) from public;
revoke all on function public.admin_list_staff_audit(integer) from public;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.admin_list_members(text,integer,integer) to authenticated;
grant execute on function public.admin_set_member_role(uuid,text,text) to authenticated;
grant execute on function public.admin_list_staff_audit(integer) to authenticated;
