-- Backend/security milestone. Review against a staging database before use.
-- This file is intentionally additive and has not been applied to any project.

alter table public.profiles
  add column if not exists is_private boolean not null default false,
  add column if not exists follower_list_visibility text not null default 'followers';

alter table public.profiles
  drop constraint if exists profiles_follower_list_visibility_check;
alter table public.profiles
  add constraint profiles_follower_list_visibility_check
  check (follower_list_visibility in ('public','followers','friends','only_me'));

create table if not exists public.age_assurance (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','eligible','restricted','needs_review')),
  method text,
  provider_reference text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);
create unique index if not exists friend_requests_one_pending_pair_idx
  on public.friend_requests(sender_id, recipient_id) where status = 'pending';
create index if not exists friend_requests_recipient_status_idx
  on public.friend_requests(recipient_id, status, created_at desc);

create table if not exists public.friendships (
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  created_from_request_id uuid references public.friend_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_low_id, user_high_id),
  check (user_low_id < user_high_id)
);

create table if not exists public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (follower_id <> followed_id)
);
create unique index if not exists follow_requests_one_pending_pair_idx
  on public.follow_requests(follower_id, followed_id) where status = 'pending';

create table if not exists public.role_permissions (
  role text not null,
  permission text not null,
  created_at timestamptz not null default now(),
  primary key (role, permission)
);

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('user','moderator','support','kyc_reviewer','billing_admin','privacy_admin','admin','super_admin'));

insert into public.role_permissions(role, permission) values
  ('moderator','moderation.review'),
  ('moderator','reports.read'),
  ('support','support.read'),
  ('kyc_reviewer','kyc.read'),
  ('kyc_reviewer','kyc.review'),
  ('billing_admin','billing.read'),
  ('billing_admin','billing.review'),
  ('privacy_admin','privacy.read'),
  ('privacy_admin','audit.read'),
  ('admin','moderation.review'),
  ('admin','reports.read'),
  ('admin','kyc.read'),
  ('admin','kyc.review'),
  ('admin','billing.read'),
  ('admin','billing.review'),
  ('admin','accounts.restrict'),
  ('admin','audit.read'),
  ('super_admin','moderation.review'),
  ('super_admin','reports.read'),
  ('super_admin','kyc.read'),
  ('super_admin','kyc.review'),
  ('super_admin','billing.read'),
  ('super_admin','billing.review'),
  ('super_admin','accounts.restrict'),
  ('super_admin','audit.read'),
  ('super_admin','roles.manage'),
  ('super_admin','plans.manage')
on conflict do nothing;

create table if not exists public.membership_plans (
  code text primary key check (code in ('free','premium','business_pro')),
  display_name text not null,
  stage smallint not null unique check (stage between 1 and 3),
  requires_individual_kyc boolean not null default false,
  requires_business_kyc boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (not (requires_individual_kyc and requires_business_kyc))
);
insert into public.membership_plans(code, display_name, stage, requires_individual_kyc, requires_business_kyc) values
  ('free','Mavora Free',1,false,false),
  ('premium','Mavora Premium',2,true,false),
  ('business_pro','Mavora Business / Pro',3,false,true)
on conflict (code) do update set
  display_name = excluded.display_name,
  stage = excluded.stage,
  requires_individual_kyc = excluded.requires_individual_kyc,
  requires_business_kyc = excluded.requires_business_kyc;

create table if not exists public.membership_prices (
  plan_code text not null references public.membership_plans(code),
  country_code char(2) not null,
  billing_period text not null check (billing_period in ('monthly','annual')),
  currency char(3) not null,
  amount numeric(14,2) not null check (amount > 0),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (plan_code, country_code, billing_period, currency)
);

create table if not exists public.plan_entitlements (
  plan_code text not null references public.membership_plans(code) on delete cascade,
  entitlement_key text not null,
  enabled boolean not null default true,
  primary key (plan_code, entitlement_key)
);
insert into public.plan_entitlements(plan_code, entitlement_key) values
  ('free','profile.basic'),('free','feed.read'),('free','feed.create'),
  ('free','friends.use'),('free','follows.use'),('free','groups.use'),('free','messages.use'),
  ('premium','profile.premium'),('premium','creator.analytics'),('premium','creator.tools'),
  ('business_pro','business.profile'),('business_pro','business.listings'),('business_pro','business.analytics')
on conflict do nothing;

create table if not exists public.user_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_key text not null,
  plan_code text not null references public.membership_plans(code),
  source_subscription_id uuid references public.subscriptions(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, entitlement_key)
);

create table if not exists public.kyc_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references auth.users(id) on delete cascade,
  application_type text not null check (application_type in ('individual','business')),
  status text not null default 'submitted'
    check (status in ('submitted','in_review','verified','rejected','needs_more_information','expired','suspended')),
  reason_category text,
  appeal_status text not null default 'not_requested'
    check (appeal_status in ('not_requested','submitted','in_review','resolved')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create index if not exists kyc_applications_applicant_status_idx
  on public.kyc_applications(applicant_id, status, submitted_at desc);
create index if not exists kyc_applications_review_queue_idx
  on public.kyc_applications(status, submitted_at) where status in ('submitted','in_review','needs_more_information');

create table if not exists public.kyc_provider_records (
  application_id uuid primary key references public.kyc_applications(id) on delete cascade,
  provider text not null,
  provider_reference text not null,
  result_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text not null,
  reason_category text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_target_created_idx
  on public.audit_logs(target_type, target_id, created_at desc);
create index if not exists audit_logs_actor_created_idx
  on public.audit_logs(actor_id, created_at desc);

create table if not exists public.account_restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  restriction_type text not null
    check (restriction_type in ('account_access','posting','messaging','monetization','advertising')),
  reason_category text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users(id),
  lifted_at timestamptz,
  lifted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists account_restrictions_active_idx
  on public.account_restrictions(user_id, restriction_type, starts_at, ends_at)
  where lifted_at is null;

alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check
  check (plan in ('free','premium','business_pro'));
alter table public.subscriptions add column if not exists billing_period text
  check (billing_period in ('monthly','annual'));
alter table public.payment_transactions add column if not exists plan_code text
  references public.membership_plans(code);
alter table public.payment_transactions add column if not exists billing_period text
  check (billing_period in ('monthly','annual'));
alter table public.payment_transactions add column if not exists checkout_country char(2);
alter table public.payment_transactions add column if not exists provider_transaction_id text;
create unique index if not exists payment_transactions_provider_txn_uq
  on public.payment_transactions(provider, provider_transaction_id)
  where provider_transaction_id is not null;

create or replace function public.is_age_eligible(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.age_assurance aa
    where aa.user_id = p_user_id and aa.status = 'eligible'
  );
$$;

create or replace function public.has_block_relationship(p_user_id uuid, p_other_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_user_id and b.blocked_id = p_other_id)
       or (b.blocker_id = p_other_id and b.blocked_id = p_user_id)
  );
$$;

create or replace function public.are_friends(p_user_id uuid, p_other_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.friendships f
    where f.user_low_id = least(p_user_id, p_other_id)
      and f.user_high_id = greatest(p_user_id, p_other_id)
  );
$$;

create or replace function public.is_approved_follower(p_follower_id uuid, p_followed_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.follows f
    where f.follower_id = p_follower_id and f.followed_id = p_followed_id
  );
$$;

create or replace function public.is_account_restricted(p_user_id uuid, p_type text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
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

create or replace function public.can_view_profile(p_target_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  target_private boolean;
begin
  if viewer_id is null then return false; end if;
  if viewer_id = p_target_id then return true; end if;
  if not public.is_age_eligible(viewer_id) or not public.is_age_eligible(p_target_id) then return false; end if;
  if public.has_block_relationship(viewer_id, p_target_id) then return false; end if;
  if public.is_account_restricted(viewer_id, 'account_access')
     or public.is_account_restricted(p_target_id, 'account_access') then return false; end if;

  select p.is_private into target_private from public.profiles p where p.id = p_target_id;
  if target_private is null then return false; end if;
  return not target_private
    or public.is_approved_follower(viewer_id, p_target_id)
    or public.are_friends(viewer_id, p_target_id);
end;
$$;

create or replace function public.can_view_follower_list(p_target_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
  list_visibility text;
begin
  if viewer_id is null then return false; end if;
  if viewer_id = p_target_id then return true; end if;
  if not public.can_view_profile(p_target_id) then return false; end if;
  select p.follower_list_visibility into list_visibility
  from public.profiles p where p.id = p_target_id;
  return list_visibility = 'public'
    or (list_visibility = 'followers' and public.is_approved_follower(viewer_id, p_target_id))
    or (list_visibility = 'friends' and public.are_friends(viewer_id, p_target_id));
end;
$$;

create or replace function public.can_view_post(p_author_id uuid, p_visibility text)
returns boolean
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  viewer_id uuid := auth.uid();
begin
  if viewer_id is null then return false; end if;
  if viewer_id = p_author_id then return true; end if;
  if not public.is_age_eligible(viewer_id) or not public.is_age_eligible(p_author_id) then return false; end if;
  if public.has_block_relationship(viewer_id, p_author_id) then return false; end if;
  if public.is_account_restricted(viewer_id, 'account_access')
     or public.is_account_restricted(p_author_id, 'account_access') then return false; end if;

  if p_visibility = 'public' then return public.can_view_profile(p_author_id); end if;
  if p_visibility = 'followers' then
    return public.is_approved_follower(viewer_id, p_author_id)
      or public.are_friends(viewer_id, p_author_id);
  end if;
  if p_visibility = 'friends' then return public.are_friends(viewer_id, p_author_id); end if;
  return false;
end;
$$;

create or replace function public.has_permission(p_permission text)
returns boolean
language sql stable security definer set search_path = public, pg_temp
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

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role <> 'user'
  );
$$;

create or replace function public.accept_friend_request(p_request_id uuid)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  request_row public.friend_requests%rowtype;
  friendship_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into request_row from public.friend_requests
  where id = p_request_id and recipient_id = auth.uid() and status = 'pending'
  for update;
  if not found then raise exception 'Friend request not found' using errcode = 'P0002'; end if;
  if public.has_block_relationship(request_row.sender_id, request_row.recipient_id) then
    raise exception 'This request cannot be accepted' using errcode = '42501';
  end if;
  if not public.is_age_eligible(auth.uid()) then
    raise exception 'Age eligibility required' using errcode = '42501';
  end if;

  update public.friend_requests set status = 'accepted', updated_at = now() where id = p_request_id;
  insert into public.friendships(user_low_id, user_high_id, created_from_request_id)
  values (least(request_row.sender_id, request_row.recipient_id), greatest(request_row.sender_id, request_row.recipient_id), p_request_id)
  on conflict do nothing;
  insert into public.follows(follower_id, followed_id)
  values (request_row.sender_id, request_row.recipient_id), (request_row.recipient_id, request_row.sender_id)
  on conflict do nothing;
  return p_request_id;
end;
$$;

create or replace function public.request_follow(p_followed_id uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  target_private boolean;
begin
  if auth.uid() is null or p_followed_id is null or p_followed_id = auth.uid() then
    raise exception 'A valid target account is required' using errcode = '22023';
  end if;
  if not public.is_age_eligible(auth.uid())
     or public.is_account_restricted(auth.uid(), 'posting') then
    raise exception 'Account is not eligible to follow' using errcode = '42501';
  end if;
  if public.has_block_relationship(auth.uid(), p_followed_id) then
    raise exception 'This account cannot be followed' using errcode = '42501';
  end if;
  if public.is_approved_follower(auth.uid(), p_followed_id) then return 'following'; end if;

  select p.is_private into target_private from public.profiles p where p.id = p_followed_id;
  if target_private is null then raise exception 'Profile not found' using errcode = 'P0002'; end if;
  if target_private then
    insert into public.follow_requests(follower_id, followed_id, status)
    values (auth.uid(), p_followed_id, 'pending')
    on conflict (follower_id, followed_id) where status = 'pending' do nothing;
    return 'requested';
  end if;

  insert into public.follows(follower_id, followed_id)
  values (auth.uid(), p_followed_id) on conflict do nothing;
  return 'following';
end;
$$;

create or replace function public.review_follow_request(p_request_id uuid, p_approve boolean)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  request_row public.follow_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into request_row from public.follow_requests
  where id = p_request_id and followed_id = auth.uid() and status = 'pending'
  for update;
  if not found then raise exception 'Follow request not found' using errcode = 'P0002'; end if;
  if public.has_block_relationship(request_row.follower_id, request_row.followed_id) then
    raise exception 'This request cannot be approved' using errcode = '42501';
  end if;
  if p_approve then
    update public.follow_requests set status = 'accepted', updated_at = now() where id = p_request_id;
    insert into public.follows(follower_id, followed_id)
    values (request_row.follower_id, request_row.followed_id) on conflict do nothing;
  else
    update public.follow_requests set status = 'declined', updated_at = now() where id = p_request_id;
  end if;
  return p_request_id;
end;
$$;

create or replace function public.review_kyc(
  p_application_id uuid,
  p_decision text,
  p_reason_category text default null
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  application_row public.kyc_applications%rowtype;
begin
  if auth.uid() is null or not public.has_permission('kyc.review') then
    raise exception 'KYC review permission required' using errcode = '42501';
  end if;
  if p_decision not in ('verified','rejected','needs_more_information','suspended') then
    raise exception 'Invalid KYC decision' using errcode = '22023';
  end if;
  select * into application_row from public.kyc_applications
  where id = p_application_id for update;
  if not found then raise exception 'KYC application not found' using errcode = 'P0002'; end if;
  if application_row.applicant_id = auth.uid() then
    raise exception 'Reviewers cannot decide their own application' using errcode = '42501';
  end if;
  if application_row.status not in ('submitted','in_review','needs_more_information') then
    raise exception 'Application is not reviewable' using errcode = '23514';
  end if;

  update public.kyc_applications set
    status = p_decision,
    reason_category = p_reason_category,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = p_application_id;
  insert into public.audit_logs(actor_id, action, target_type, target_id, reason_category)
  values (auth.uid(), 'kyc.' || p_decision, 'kyc_application', p_application_id::text, p_reason_category);
  return p_application_id;
end;
$$;

create or replace function public.finalize_verified_payment(
  p_provider_reference text,
  p_provider_transaction_id text,
  p_amount numeric,
  p_currency text,
  p_provider_status text
)
returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  payment_row public.payment_transactions%rowtype;
  plan_row public.membership_plans%rowtype;
  new_subscription_id uuid;
begin
  if p_provider_status <> 'successful' or p_provider_transaction_id is null then
    raise exception 'Provider transaction is not successful' using errcode = '22023';
  end if;

  select * into payment_row from public.payment_transactions
  where provider_reference = p_provider_reference and provider = 'flutterwave'
  for update;
  if not found then raise exception 'Pending payment not found' using errcode = 'P0002'; end if;
  if payment_row.status = 'successful' then
    if payment_row.provider_transaction_id = p_provider_transaction_id then return payment_row.id; end if;
    raise exception 'Payment reference already finalized' using errcode = '23505';
  end if;
  if payment_row.status <> 'pending'
     or payment_row.amount <> p_amount
     or upper(payment_row.currency) <> upper(p_currency) then
    raise exception 'Verified payment does not match pending transaction' using errcode = '23514';
  end if;

  if payment_row.purpose = 'subscription' then
    select * into plan_row from public.membership_plans
    where code = payment_row.plan_code and active = true;
    if not found then raise exception 'Membership plan is unavailable' using errcode = '23514'; end if;
    if not public.is_age_eligible(payment_row.user_id) then
      raise exception 'Age eligibility is required' using errcode = '42501';
    end if;
    if plan_row.requires_individual_kyc and not exists (
      select 1 from public.kyc_applications k
      where k.applicant_id = payment_row.user_id and k.application_type = 'individual' and k.status = 'verified'
    ) then raise exception 'Individual KYC is required' using errcode = '42501'; end if;
    if plan_row.requires_business_kyc and not exists (
      select 1 from public.kyc_applications k
      where k.applicant_id = payment_row.user_id and k.application_type = 'business' and k.status = 'verified'
    ) then raise exception 'Business KYC is required' using errcode = '42501'; end if;
  end if;

  update public.payment_transactions set
    status = 'successful',
    provider_transaction_id = p_provider_transaction_id,
    verified_at = now()
  where id = payment_row.id;

  if payment_row.purpose = 'subscription' then
    update public.subscriptions set status = 'expired'
    where user_id = payment_row.user_id and status = 'active';
    insert into public.subscriptions(
      user_id, plan, status, billing_provider, provider_reference,
      current_period_start, current_period_end, billing_period
    ) values (
      payment_row.user_id,
      payment_row.plan_code,
      'active',
      'flutterwave',
      payment_row.provider_reference,
      now(),
      case when payment_row.billing_period = 'annual' then now() + interval '1 year' else now() + interval '1 month' end,
      payment_row.billing_period
    ) returning id into new_subscription_id;
    delete from public.user_entitlements where user_id = payment_row.user_id;
    insert into public.user_entitlements(user_id, entitlement_key, plan_code, source_subscription_id)
    select payment_row.user_id, pe.entitlement_key, payment_row.plan_code, new_subscription_id
    from public.plan_entitlements pe
    where pe.plan_code = payment_row.plan_code and pe.enabled;
  end if;

  insert into public.audit_logs(actor_id, action, target_type, target_id, metadata)
  values (null, 'payment.verified', 'payment_transaction', payment_row.id::text,
    jsonb_build_object('provider', payment_row.provider, 'provider_transaction_id', p_provider_transaction_id, 'purpose', payment_row.purpose));
  return payment_row.id;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name',''))
  on conflict (id) do nothing;
  insert into public.user_roles(user_id, role) values (new.id, 'user') on conflict (user_id) do nothing;
  insert into public.age_assurance(user_id, status) values (new.id, 'pending') on conflict (user_id) do nothing;
  insert into public.user_entitlements(user_id, entitlement_key, plan_code)
  select new.id, pe.entitlement_key, 'free' from public.plan_entitlements pe
  where pe.plan_code = 'free' and pe.enabled
  on conflict (user_id, entitlement_key) do nothing;
  return new;
end;
$$;

insert into public.age_assurance(user_id, status)
select u.id, 'pending' from auth.users u
on conflict (user_id) do nothing;
insert into public.user_entitlements(user_id, entitlement_key, plan_code)
select p.id, pe.entitlement_key, 'free'
from public.profiles p cross join public.plan_entitlements pe
where pe.plan_code = 'free' and pe.enabled
  and not exists (select 1 from public.subscriptions s where s.user_id = p.id and s.status = 'active' and s.plan <> 'free')
on conflict (user_id, entitlement_key) do nothing;

alter table public.age_assurance enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.follow_requests enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_plans enable row level security;
alter table public.membership_prices enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.kyc_applications enable row level security;
alter table public.kyc_provider_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.account_restrictions enable row level security;

drop policy if exists "Profiles visible to authenticated users" on public.profiles;
drop policy if exists "Users create own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
create policy "Visible profiles respect age privacy and blocks" on public.profiles
for select to authenticated using (public.can_view_profile(id));
create policy "Users update only editable profile fields" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Users read own role only" on public.user_roles;
create policy "Users read own role" on public.user_roles
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users read own subscriptions" on public.subscriptions;
create policy "Users read own subscriptions" on public.subscriptions
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users manage own follows" on public.follows;
create policy "Visible follow lists" on public.follows
for select to authenticated using (public.can_view_follower_list(followed_id));
create policy "Follow public eligible profiles" on public.follows
for insert to authenticated with check (
  follower_id = auth.uid()
  and public.is_age_eligible(auth.uid())
  and not public.is_account_restricted(auth.uid(), 'posting')
  and not public.has_block_relationship(auth.uid(), followed_id)
  and exists (select 1 from public.profiles p where p.id = followed_id and not p.is_private)
);
create policy "Unfollow own relationship" on public.follows
for delete to authenticated using (follower_id = auth.uid());

drop policy if exists "Authenticated users read public posts" on public.posts;
drop policy if exists "Users create own posts" on public.posts;
drop policy if exists "Users update own posts" on public.posts;
drop policy if exists "Users delete own posts" on public.posts;
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility in ('public','followers','friends','private','only_me'));
create policy "Posts respect audience privacy and blocks" on public.posts
for select to authenticated using (public.can_view_post(author_id, visibility));
create policy "Eligible users create own posts" on public.posts
for insert to authenticated with check (
  author_id = auth.uid()
  and public.is_age_eligible(auth.uid())
  and not public.is_account_restricted(auth.uid(), 'posting')
);
create policy "Authors update own posts" on public.posts
for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Authors delete own posts" on public.posts
for delete to authenticated using (author_id = auth.uid());

drop policy if exists "Users manage own blocks" on public.user_blocks;
create policy "Users read blocks they created" on public.user_blocks
for select to authenticated using (blocker_id = auth.uid());
create policy "Users block other accounts" on public.user_blocks
for insert to authenticated with check (blocker_id = auth.uid() and blocker_id <> blocked_id);
create policy "Users unblock own relationships" on public.user_blocks
for delete to authenticated using (blocker_id = auth.uid());

drop policy if exists "Users create reports" on public.content_reports;
drop policy if exists "Users see own reports and staff see all" on public.content_reports;
create policy "Users submit own reports" on public.content_reports
for insert to authenticated with check (reporter_id = auth.uid());
create policy "Users read own reports" on public.content_reports
for select to authenticated using (reporter_id = auth.uid());
create policy "Moderators read reports" on public.content_reports
for select to authenticated using (public.has_permission('reports.read'));

drop policy if exists "Users read own payment transactions" on public.payment_transactions;
create policy "Users read own payments" on public.payment_transactions
for select to authenticated using (user_id = auth.uid());

drop policy if exists "Staff read ad reviews" on public.ad_reviews;
drop policy if exists "Staff create ad reviews" on public.ad_reviews;
create policy "Ad reviewers read decisions" on public.ad_reviews
for select to authenticated using (public.has_permission('moderation.review'));
create policy "Ad reviewers create decisions for others" on public.ad_reviews
for insert to authenticated with check (
  public.has_permission('moderation.review')
  and reviewer_id = auth.uid()
  and not exists (
    select 1 from public.ad_campaigns c
    where c.id = campaign_id and c.advertiser_id = auth.uid()
  )
);

drop policy if exists "Reactions visible to authenticated users" on public.post_reactions;
drop policy if exists "Users manage own reactions" on public.post_reactions;
create policy "Reactions visible with parent post" on public.post_reactions
for select to authenticated using (
  exists (select 1 from public.posts p where p.id = post_id and public.can_view_post(p.author_id, p.visibility))
);
create policy "Eligible users react to visible posts" on public.post_reactions
for insert to authenticated with check (
  user_id = auth.uid()
  and public.is_age_eligible(auth.uid())
  and not public.is_account_restricted(auth.uid(), 'posting')
  and exists (select 1 from public.posts p where p.id = post_id and public.can_view_post(p.author_id, p.visibility))
);
create policy "Users remove own reactions" on public.post_reactions
for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Comments visible to authenticated users" on public.comments;
drop policy if exists "Users create own comments" on public.comments;
drop policy if exists "Users manage own comments" on public.comments;
drop policy if exists "Users delete own comments" on public.comments;
create policy "Comments visible with parent post" on public.comments
for select to authenticated using (
  exists (select 1 from public.posts p where p.id = post_id and public.can_view_post(p.author_id, p.visibility))
);
create policy "Eligible users comment on visible posts" on public.comments
for insert to authenticated with check (
  author_id = auth.uid()
  and public.is_age_eligible(auth.uid())
  and not public.is_account_restricted(auth.uid(), 'posting')
  and exists (select 1 from public.posts p where p.id = post_id and public.can_view_post(p.author_id, p.visibility))
);
create policy "Authors update own comments" on public.comments
for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Authors delete own comments" on public.comments
for delete to authenticated using (author_id = auth.uid());

drop policy if exists "Group members see own memberships" on public.group_members;
create policy "Members and authorized moderators read memberships" on public.group_members
for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
  or public.has_permission('moderation.review')
);

drop policy if exists "Advertisers read own campaigns" on public.ad_campaigns;
create policy "Advertisers and ad reviewers read campaigns" on public.ad_campaigns
for select to authenticated using (
  advertiser_id = auth.uid() or public.has_permission('moderation.review')
);

create policy "Users read own age status" on public.age_assurance
for select to authenticated using (user_id = auth.uid());
create policy "Friend participants read requests" on public.friend_requests
for select to authenticated using (
  (sender_id = auth.uid() or recipient_id = auth.uid())
  and not public.has_block_relationship(sender_id, recipient_id)
);
create policy "Eligible users send friend requests" on public.friend_requests
for insert to authenticated with check (
  sender_id = auth.uid()
  and status = 'pending'
  and public.is_age_eligible(auth.uid())
  and not public.is_account_restricted(auth.uid(), 'posting')
  and not public.has_block_relationship(sender_id, recipient_id)
  and exists (select 1 from public.profiles p where p.id = recipient_id)
);
create policy "Senders cancel pending friend requests" on public.friend_requests
for delete to authenticated using (sender_id = auth.uid() and status = 'pending');
create policy "Friend participants read friendships" on public.friendships
for select to authenticated using (auth.uid() in (user_low_id, user_high_id));
create policy "Friend participants remove friendships" on public.friendships
for delete to authenticated using (auth.uid() in (user_low_id, user_high_id));

create policy "Follow participants read requests" on public.follow_requests
for select to authenticated using (
  (follower_id = auth.uid() or followed_id = auth.uid())
  and not public.has_block_relationship(follower_id, followed_id)
);
create policy "Eligible users request private follows" on public.follow_requests
for insert to authenticated with check (
  follower_id = auth.uid()
  and status = 'pending'
  and public.is_age_eligible(auth.uid())
  and not public.is_account_restricted(auth.uid(), 'posting')
  and not public.has_block_relationship(follower_id, followed_id)
  and exists (select 1 from public.profiles p where p.id = followed_id and p.is_private)
);
create policy "Followers cancel pending requests" on public.follow_requests
for delete to authenticated using (follower_id = auth.uid() and status = 'pending');

create policy "Active membership plans are readable" on public.membership_plans
for select to authenticated using (active);
create policy "Active regional prices are readable" on public.membership_prices
for select to authenticated using (active);
create policy "Plan entitlements are readable" on public.plan_entitlements
for select to authenticated using (enabled);
create policy "Users read own entitlements" on public.user_entitlements
for select to authenticated using (user_id = auth.uid());

create policy "Applicants read own KYC status" on public.kyc_applications
for select to authenticated using (applicant_id = auth.uid());
create policy "KYC reviewers read applications" on public.kyc_applications
for select to authenticated using (public.has_permission('kyc.read'));
create policy "Eligible users submit own KYC application" on public.kyc_applications
for insert to authenticated with check (
  applicant_id = auth.uid()
  and status = 'submitted'
  and reviewed_by is null
  and reviewed_at is null
  and public.is_age_eligible(auth.uid())
);
create policy "KYC provider records are server only" on public.kyc_provider_records
for all to service_role using (true) with check (true);

create policy "Account holders read own restrictions" on public.account_restrictions
for select to authenticated using (user_id = auth.uid());
create policy "Authorized staff read audit logs" on public.audit_logs
for select to authenticated using (public.has_permission('audit.read'));

drop policy if exists "Participants read messages" on public.messages;
drop policy if exists "Participants send own messages" on public.messages;
create policy "Eligible conversation participants read messages" on public.messages
for select to authenticated using (
  public.is_age_eligible(auth.uid())
  and not public.is_account_restricted(auth.uid(), 'messaging')
  and not exists (
    select 1 from public.conversation_members cm
    join public.conversation_members other_cm on other_cm.conversation_id = cm.conversation_id
    where cm.conversation_id = messages.conversation_id
      and cm.user_id = auth.uid()
      and public.has_block_relationship(auth.uid(), other_cm.user_id)
  )
  and exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid())
);
create policy "Eligible participants send own messages" on public.messages
for insert to authenticated with check (
  sender_id = auth.uid()
  and public.is_age_eligible(auth.uid())
  and not public.is_account_restricted(auth.uid(), 'messaging')
  and exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid())
  and not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id
      and public.has_block_relationship(auth.uid(), cm.user_id)
  )
);

alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.follow_requests enable row level security;

revoke all on public.user_roles, public.role_permissions, public.age_assurance,
  public.kyc_provider_records, public.audit_logs, public.account_restrictions,
  public.membership_prices, public.user_entitlements, public.payment_transactions,
  public.kyc_applications, public.friendships, public.friend_requests,
  public.subscriptions, public.membership_plans, public.plan_entitlements,
  public.follow_requests from anon, authenticated;
revoke all on public.profiles from anon, authenticated;

grant select (user_id, role, created_at) on public.user_roles to authenticated;
grant select (user_id, status, verified_at, created_at, updated_at) on public.age_assurance to authenticated;
grant select on public.role_permissions to service_role;
grant select on public.membership_plans, public.membership_prices, public.plan_entitlements to authenticated;
grant select (user_id, entitlement_key, plan_code, source_subscription_id, created_at) on public.user_entitlements to authenticated;
grant select (id, applicant_id, application_type, status, reason_category, appeal_status, submitted_at, reviewed_at, updated_at)
  on public.kyc_applications to authenticated;
grant insert (applicant_id, application_type, status) on public.kyc_applications to authenticated;
grant select (id, applicant_id, application_type, status, reason_category, appeal_status, submitted_at, reviewed_at, updated_at)
  on public.kyc_applications to service_role;
grant all on public.kyc_applications, public.kyc_provider_records, public.account_restrictions,
  public.audit_logs, public.membership_prices, public.user_entitlements,
  public.payment_transactions, public.subscriptions, public.friendships,
  public.friend_requests, public.follow_requests, public.follows,
  public.user_roles, public.role_permissions, public.age_assurance,
  public.membership_plans, public.plan_entitlements to service_role;
grant select (id, user_id, provider, provider_reference, amount, currency, status, purpose, verified_at, created_at)
  on public.payment_transactions to authenticated;
grant select (id, user_id, plan, status, billing_provider, current_period_start, current_period_end, billing_period, created_at)
  on public.subscriptions to authenticated;
grant select on public.friendships, public.friend_requests, public.follow_requests to authenticated;
grant insert (sender_id, recipient_id, status) on public.friend_requests to authenticated;
grant insert (follower_id, followed_id, status) on public.follow_requests to authenticated;
grant delete on public.friend_requests, public.friendships, public.follow_requests to authenticated;
grant select on public.follows to authenticated;
grant insert (follower_id, followed_id) on public.follows to authenticated;
grant delete on public.follows to authenticated;
grant select (id, is_private, follower_list_visibility, username, display_name, bio, country_code, preferred_language, preferred_currency, timezone, avatar_url, created_at, updated_at)
  on public.profiles to authenticated;
revoke insert, update, delete on public.profiles from authenticated;
grant update (username, display_name, bio, country_code, preferred_language, preferred_currency, timezone, avatar_url, is_private, follower_list_visibility)
  on public.profiles to authenticated;

revoke all on function public.finalize_verified_payment(text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.finalize_verified_payment(text,text,numeric,text,text) to service_role;
revoke all on function public.review_kyc(uuid,text,text) from public, anon;
grant execute on function public.review_kyc(uuid,text,text) to authenticated;
revoke all on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.accept_friend_request(uuid) to authenticated;
revoke all on function public.review_follow_request(uuid,boolean) from public, anon;
grant execute on function public.review_follow_request(uuid,boolean) to authenticated;
revoke all on function public.request_follow(uuid) from public, anon;
grant execute on function public.request_follow(uuid) to authenticated;
grant execute on function public.is_age_eligible(uuid), public.has_block_relationship(uuid,uuid),
  public.are_friends(uuid,uuid), public.is_approved_follower(uuid,uuid),
  public.is_account_restricted(uuid,text), public.can_view_profile(uuid),
  public.can_view_follower_list(uuid), public.can_view_post(uuid,text),
  public.has_permission(text), public.is_staff() to authenticated, service_role;
revoke insert, update, delete on public.user_roles, public.role_permissions,
  public.age_assurance, public.membership_plans, public.membership_prices,
  public.plan_entitlements, public.user_entitlements, public.audit_logs,
  public.account_restrictions, public.kyc_provider_records,
  public.payment_transactions, public.subscriptions from authenticated;

commit;