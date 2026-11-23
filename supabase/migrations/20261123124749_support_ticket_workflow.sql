-- Customer-owned tickets with permission-checked, audit-backed staff actions.
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  category text not null check (category in ('account','privacy','business','payments','safety','technical','other')),
  description text not null check (char_length(btrim(description)) between 10 and 5000),
  status text not null default 'open' check (status in ('open','in_progress','escalated','resolved','closed')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_kind text not null default 'customer' check (sender_kind in ('customer','staff')),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_requester_updated_idx
  on public.support_tickets (requester_id, updated_at desc);
create index if not exists support_tickets_queue_idx
  on public.support_tickets (status, updated_at desc);
create index if not exists support_ticket_messages_ticket_created_idx
  on public.support_ticket_messages (ticket_id, created_at);

create or replace function private.touch_support_ticket_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.support_tickets set updated_at = now() where id = new.ticket_id;
  return new;
end;
$$;

revoke all on function private.touch_support_ticket_activity() from public, anon, authenticated;
create trigger support_ticket_message_activity
after insert on public.support_ticket_messages
for each row execute function private.touch_support_ticket_activity();

alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
revoke all on table public.support_tickets, public.support_ticket_messages from public, anon, authenticated;
grant select on table public.support_tickets, public.support_ticket_messages to authenticated;
grant insert (requester_id, subject, category, description) on public.support_tickets to authenticated;
grant insert (ticket_id, sender_id, body) on public.support_ticket_messages to authenticated;

create policy "Customers and authorized staff read support tickets" on public.support_tickets
for select to authenticated using (
  requester_id = (select auth.uid()) or private.has_permission('support.read')
);

create policy "Customers create own support tickets" on public.support_tickets
for insert to authenticated with check (
  requester_id = (select auth.uid())
  and status = 'open'
  and assigned_to is null
);

create policy "Customers and authorized staff read ticket messages" on public.support_ticket_messages
for select to authenticated using (
  exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and (t.requester_id = (select auth.uid()) or private.has_permission('support.read'))
  )
);

create policy "Customers append messages to own open tickets" on public.support_ticket_messages
for insert to authenticated with check (
  sender_id = (select auth.uid())
  and sender_kind = 'customer'
  and exists (
    select 1 from public.support_tickets t
    where t.id = support_ticket_messages.ticket_id
      and t.requester_id = (select auth.uid())
      and t.status in ('open','in_progress','escalated')
  )
);

insert into public.role_permissions (role, permission)
values ('support','support.reply'), ('admin','support.reply'), ('super_admin','support.reply')
on conflict (role, permission) do nothing;

create or replace function public.reply_to_support_ticket(p_ticket_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  ticket_row public.support_tickets%rowtype;
  message_id uuid;
  clean_body text := btrim(coalesce(p_body, ''));
begin
  if actor_id is null or not private.has_permission('support.reply') then
    raise exception 'You are not authorized to reply to support tickets.' using errcode = '42501';
  end if;
  if p_ticket_id is null or char_length(clean_body) < 1 or char_length(clean_body) > 5000 then
    raise exception 'Enter a reply of 1 to 5,000 characters.' using errcode = '22023';
  end if;

  select * into ticket_row from public.support_tickets where id = p_ticket_id for update;
  if not found or ticket_row.status in ('resolved','closed') then
    raise exception 'This support ticket is unavailable for replies.' using errcode = '22023';
  end if;

  insert into public.support_ticket_messages (ticket_id, sender_id, sender_kind, body)
  values (ticket_row.id, actor_id, 'staff', clean_body)
  returning id into message_id;

  update public.support_tickets
  set status = case when status = 'open' then 'in_progress' else status end,
      assigned_to = coalesce(assigned_to, actor_id),
      updated_at = now()
  where id = ticket_row.id;

  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (actor_id, 'support.ticket.replied', 'support_ticket', ticket_row.id::text,
          jsonb_build_object('message_id', message_id));
  return message_id;
end;
$$;

create or replace function public.set_support_ticket_status(p_ticket_id uuid, p_status text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  ticket_row public.support_tickets%rowtype;
begin
  if actor_id is null or not private.has_permission('support.reply') then
    raise exception 'You are not authorized to update support tickets.' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('open','in_progress','escalated','resolved','closed') then
    raise exception 'Choose a supported ticket status.' using errcode = '22023';
  end if;

  select * into ticket_row from public.support_tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'This support ticket is unavailable.' using errcode = '22023';
  end if;

  update public.support_tickets set status = p_status, updated_at = now()
  where id = ticket_row.id;
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (actor_id, 'support.ticket.status_changed', 'support_ticket', ticket_row.id::text,
          jsonb_build_object('from', ticket_row.status, 'to', p_status));
  return ticket_row.id;
end;
$$;

revoke all on function public.reply_to_support_ticket(uuid,text) from public, anon, authenticated;
revoke all on function public.set_support_ticket_status(uuid,text) from public, anon, authenticated;
grant execute on function public.reply_to_support_ticket(uuid,text) to authenticated;
grant execute on function public.set_support_ticket_status(uuid,text) to authenticated;

comment on function public.reply_to_support_ticket(uuid,text) is
  'Adds a support reply, advances the ticket state, and records an audit event atomically for authorized staff.';
