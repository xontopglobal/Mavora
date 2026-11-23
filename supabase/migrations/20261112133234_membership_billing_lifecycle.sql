begin;

-- Membership renewals use a new hosted checkout; no recurring mandate is created.
alter table public.payment_transactions drop constraint if exists payment_transactions_status_check;
alter table public.payment_transactions add constraint payment_transactions_status_check
  check (status in ('pending','successful','failed','reversed','refunded'));
alter table public.payment_transactions
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists membership_period_start timestamptz,
  add column if not exists membership_period_end timestamptz,
  add column if not exists refund_status text,
  add column if not exists provider_refund_id text;
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists subscriptions_one_active_per_user_idx
  on public.subscriptions(user_id) where status = 'active';
create index if not exists payment_transactions_reconcile_idx
  on public.payment_transactions(user_id, created_at)
  where provider = 'flutterwave' and purpose = 'subscription' and status in ('pending','successful');

create table if not exists public.billing_event_log (
  event_key text primary key,
  payment_transaction_id uuid references public.payment_transactions(id) on delete set null,
  event_type text not null,
  provider_transaction_id text,
  provider_reference text,
  outcome text not null,
  created_at timestamptz not null default now()
);
alter table public.billing_event_log enable row level security;
revoke all on public.billing_event_log from anon, authenticated;
grant all on public.billing_event_log to service_role;

-- RLS prevents paid access after period end even before the expiry routine runs.
drop policy if exists "Users read own entitlements" on public.user_entitlements;
create policy "Users read current own entitlements" on public.user_entitlements
for select to authenticated using (
  user_id = auth.uid() and (
    plan_code = 'free' or exists (
      select 1 from public.subscriptions s
      where s.id = user_entitlements.source_subscription_id
        and s.user_id = auth.uid() and s.status = 'active'
        and s.current_period_end > now()
    )
  )
);

-- Paid tiers include all free-tier entitlements.
insert into public.plan_entitlements(plan_code, entitlement_key, enabled)
select paid.code, free.entitlement_key, true
from public.membership_plans paid cross join public.plan_entitlements free
where paid.code in ('premium','business_pro') and free.plan_code = 'free' and free.enabled
on conflict (plan_code, entitlement_key) do nothing;

create or replace function public.finalize_verified_payment(
  p_provider_reference text, p_provider_transaction_id text,
  p_amount numeric, p_currency text, p_provider_status text
)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  payment_row public.payment_transactions%rowtype;
  plan_row public.membership_plans%rowtype;
  active_row public.subscriptions%rowtype;
  subscription_id_value uuid;
  period_start timestamptz;
  period_end timestamptz;
  period_interval interval;
  is_renewal boolean := false;
begin
  if p_provider_status <> 'successful' or p_provider_transaction_id !~ '^[0-9]+$' then
    raise exception 'Provider transaction is not successful' using errcode = '22023';
  end if;
  select * into payment_row from public.payment_transactions
  where provider_reference = p_provider_reference and provider = 'flutterwave' for update;
  if not found then raise exception 'Pending payment not found' using errcode = 'P0002'; end if;
  if payment_row.status = 'successful' then
    if payment_row.provider_transaction_id = p_provider_transaction_id then return payment_row.id; end if;
    raise exception 'Payment reference already finalized' using errcode = '23505';
  end if;
  if payment_row.status not in ('pending','failed') or payment_row.purpose <> 'subscription'
     or payment_row.amount <> p_amount or upper(payment_row.currency) <> upper(p_currency) then
    raise exception 'Verified payment does not match membership payment' using errcode = '23514';
  end if;
  select * into plan_row from public.membership_plans
  where code = payment_row.plan_code and active = true;
  if not found then raise exception 'Membership plan is unavailable' using errcode = '23514'; end if;
  if not public.is_age_eligible(payment_row.user_id) then
    raise exception 'Age eligibility is required' using errcode = '42501';
  end if;
  if plan_row.requires_individual_kyc and not exists (
    select 1 from public.kyc_applications k where k.applicant_id = payment_row.user_id
      and k.application_type = 'individual' and k.status = 'verified'
  ) then raise exception 'Individual KYC is required' using errcode = '42501'; end if;
  if plan_row.requires_business_kyc and not exists (
    select 1 from public.kyc_applications k where k.applicant_id = payment_row.user_id
      and k.application_type = 'business' and k.status = 'verified'
  ) then raise exception 'Business KYC is required' using errcode = '42501'; end if;

  period_interval := case payment_row.billing_period
    when 'annual' then interval '1 year' when 'monthly' then interval '1 month' else null end;
  if period_interval is null then raise exception 'Invalid billing period' using errcode = '23514'; end if;
  select * into active_row from public.subscriptions
  where user_id = payment_row.user_id and status = 'active' for update;
  if found and active_row.plan = payment_row.plan_code and active_row.current_period_end > now() then
    is_renewal := true;
    period_start := active_row.current_period_end;
    period_end := period_start + period_interval;
    subscription_id_value := active_row.id;
    update public.subscriptions set provider_reference = payment_row.provider_reference,
      billing_period = payment_row.billing_period, current_period_end = period_end,
      cancel_at_period_end = false, cancelled_at = null, updated_at = now()
    where id = subscription_id_value;
  else
    if found then
      update public.subscriptions set status = 'expired', updated_at = now() where id = active_row.id;
    end if;
    period_start := now();
    period_end := period_start + period_interval;
    insert into public.subscriptions(user_id, plan, status, billing_provider, provider_reference,
      current_period_start, current_period_end, billing_period, updated_at)
    values (payment_row.user_id, payment_row.plan_code, 'active', 'flutterwave',
      payment_row.provider_reference, period_start, period_end, payment_row.billing_period, now())
    returning id into subscription_id_value;
  end if;

  update public.payment_transactions set status = 'successful',
    provider_transaction_id = p_provider_transaction_id, verified_at = now(),
    subscription_id = subscription_id_value, membership_period_start = period_start,
    membership_period_end = period_end, refund_status = null, provider_refund_id = null
  where id = payment_row.id;
  delete from public.user_entitlements where user_id = payment_row.user_id and plan_code <> 'free';
  insert into public.user_entitlements(user_id, entitlement_key, plan_code, source_subscription_id)
  select payment_row.user_id, pe.entitlement_key, payment_row.plan_code, subscription_id_value
  from public.plan_entitlements pe where pe.plan_code = payment_row.plan_code and pe.enabled
  on conflict (user_id, entitlement_key) do update set plan_code = excluded.plan_code,
    source_subscription_id = excluded.source_subscription_id, created_at = now();
  insert into public.billing_event_log(event_key, payment_transaction_id, event_type,
    provider_transaction_id, provider_reference, outcome)
  values ('payment.successful:' || p_provider_transaction_id, payment_row.id,
    'payment.successful', p_provider_transaction_id, payment_row.provider_reference,
    case when is_renewal then 'membership_renewed' else 'membership_activated' end)
  on conflict (event_key) do nothing;
  insert into public.audit_logs(actor_id, action, target_type, target_id, metadata)
  values (null, case when is_renewal then 'membership.renewed' else 'membership.activated' end,
    'payment_transaction', payment_row.id::text,
    jsonb_build_object('provider_transaction_id', p_provider_transaction_id,
      'plan_code', payment_row.plan_code, 'period_start', period_start, 'period_end', period_end));
  return payment_row.id;
end;
$$;

create or replace function public.fail_pending_membership_payment(
  p_provider_reference text, p_provider_transaction_id text, p_provider_status text
)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare payment_row public.payment_transactions%rowtype;
begin
  if p_provider_status <> 'failed' or p_provider_transaction_id !~ '^[0-9]+$' then
    raise exception 'Provider failure was not verified' using errcode = '22023';
  end if;
  select * into payment_row from public.payment_transactions
  where provider_reference = p_provider_reference and provider = 'flutterwave'
    and purpose = 'subscription' for update;
  if not found then raise exception 'Payment reference not found' using errcode = 'P0002'; end if;
  if payment_row.status = 'successful' then return false; end if;
  if payment_row.status = 'pending' then
    update public.payment_transactions set status = 'failed' where id = payment_row.id;
    insert into public.audit_logs(actor_id, action, target_type, target_id, metadata)
    values (null, 'payment.failed', 'payment_transaction', payment_row.id::text,
      jsonb_build_object('provider_transaction_id', p_provider_transaction_id));
    insert into public.billing_event_log(event_key, payment_transaction_id, event_type,
      provider_transaction_id, provider_reference, outcome)
    values ('payment.failed:' || p_provider_transaction_id, payment_row.id, 'payment.failed',
      p_provider_transaction_id, payment_row.provider_reference, 'payment_failed')
    on conflict (event_key) do nothing;
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.cancel_my_membership()
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare subscription_row public.subscriptions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into subscription_row from public.subscriptions
  where user_id = auth.uid() and status = 'active' and current_period_end > now()
  order by current_period_end desc limit 1 for update;
  if not found then raise exception 'Active membership not found' using errcode = 'P0002'; end if;
  update public.subscriptions set cancel_at_period_end = true,
    cancelled_at = coalesce(cancelled_at, now()), updated_at = now()
  where id = subscription_row.id;
  insert into public.audit_logs(actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'membership.cancellation_scheduled', 'subscription', subscription_row.id::text,
    jsonb_build_object('access_until', subscription_row.current_period_end));
  return subscription_row.id;
end;
$$;

create or replace function public.expire_user_membership(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare subscription_row public.subscriptions%rowtype;
begin
  select * into subscription_row from public.subscriptions
  where user_id = p_user_id and status = 'active' and current_period_end <= now()
  order by current_period_end desc limit 1 for update;
  if not found then return false; end if;
  update public.subscriptions set status = 'expired', updated_at = now() where id = subscription_row.id;
  delete from public.user_entitlements where user_id = p_user_id and plan_code <> 'free';
  insert into public.user_entitlements(user_id, entitlement_key, plan_code)
  select p_user_id, pe.entitlement_key, 'free' from public.plan_entitlements pe
  where pe.plan_code = 'free' and pe.enabled
  on conflict (user_id, entitlement_key) do update set plan_code = 'free',
    source_subscription_id = null, created_at = now();
  insert into public.audit_logs(actor_id, action, target_type, target_id, metadata)
  values (null, 'membership.expired', 'subscription', subscription_row.id::text,
    jsonb_build_object('expired_at', now()));
  return true;
end;
$$;

create or replace function public.apply_verified_membership_reversal(
  p_provider_reference text, p_provider_transaction_id text, p_provider_status text
)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  payment_row public.payment_transactions%rowtype;
  latest_valid_end timestamptz;
begin
  if p_provider_status not in ('reversed','refunded') or p_provider_transaction_id !~ '^[0-9]+$' then
    raise exception 'Provider reversal was not verified' using errcode = '22023';
  end if;
  select * into payment_row from public.payment_transactions
  where provider_reference = p_provider_reference and provider = 'flutterwave' for update;
  if not found then raise exception 'Payment reference not found' using errcode = 'P0002'; end if;
  if payment_row.status in ('reversed','refunded') then return false; end if;
  if payment_row.status <> 'successful' or payment_row.provider_transaction_id <> p_provider_transaction_id then
    raise exception 'Payment is not eligible for reversal' using errcode = '23514';
  end if;
  update public.payment_transactions set status = p_provider_status,
    refund_status = case when p_provider_status = 'refunded' then 'completed' else refund_status end
  where id = payment_row.id;
  insert into public.audit_logs(actor_id, action, target_type, target_id, metadata)
  values (null, 'payment.' || p_provider_status, 'payment_transaction', payment_row.id::text,
    jsonb_build_object('provider_transaction_id', p_provider_transaction_id));
  insert into public.billing_event_log(event_key, payment_transaction_id, event_type,
    provider_transaction_id, provider_reference, outcome)
  values ('payment.' || p_provider_status || ':' || p_provider_transaction_id,
    payment_row.id, 'payment.' || p_provider_status, p_provider_transaction_id,
    payment_row.provider_reference, 'membership_payment_reversed')
  on conflict (event_key) do nothing;

  if payment_row.subscription_id is not null then
    select max(membership_period_end) into latest_valid_end
    from public.payment_transactions
    where subscription_id = payment_row.subscription_id and id <> payment_row.id and status = 'successful';
    if latest_valid_end > now() then
      update public.subscriptions set current_period_end = latest_valid_end,
        provider_reference = (select provider_reference from public.payment_transactions
          where subscription_id = payment_row.subscription_id and status = 'successful'
          order by membership_period_end desc limit 1), updated_at = now()
      where id = payment_row.subscription_id and status = 'active';
    else
      update public.subscriptions set status = 'expired', updated_at = now()
      where id = payment_row.subscription_id and status = 'active';
      delete from public.user_entitlements where user_id = payment_row.user_id and plan_code <> 'free';
      insert into public.user_entitlements(user_id, entitlement_key, plan_code)
      select payment_row.user_id, pe.entitlement_key, 'free' from public.plan_entitlements pe
      where pe.plan_code = 'free' and pe.enabled
      on conflict (user_id, entitlement_key) do update set plan_code = 'free',
        source_subscription_id = null, created_at = now();
    end if;
  end if;
  return true;
end;
$$;

create or replace function public.record_billing_webhook_event(
  p_event_key text, p_event_type text, p_provider_transaction_id text,
  p_provider_reference text, p_outcome text
)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_event_key is null or length(p_event_key) > 240
     or p_event_type is null or length(p_event_type) > 100
     or p_outcome is null or length(p_outcome) > 100 then
    raise exception 'Invalid billing event' using errcode = '22023';
  end if;
  insert into public.billing_event_log(event_key, event_type, provider_transaction_id,
    provider_reference, outcome)
  values (p_event_key, p_event_type, p_provider_transaction_id, p_provider_reference, p_outcome)
  on conflict (event_key) do nothing;
  return found;
end;
$$;

revoke all on function public.finalize_verified_payment(text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.finalize_verified_payment(text,text,numeric,text,text) to service_role;
revoke all on function public.fail_pending_membership_payment(text,text,text) from public, anon, authenticated;
grant execute on function public.fail_pending_membership_payment(text,text,text) to service_role;
revoke all on function public.cancel_my_membership() from public, anon;
grant execute on function public.cancel_my_membership() to authenticated;
revoke all on function public.expire_user_membership(uuid) from public, anon, authenticated;
grant execute on function public.expire_user_membership(uuid) to service_role;
revoke all on function public.apply_verified_membership_reversal(text,text,text) from public, anon, authenticated;
grant execute on function public.apply_verified_membership_reversal(text,text,text) to service_role;
revoke all on function public.record_billing_webhook_event(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_billing_webhook_event(text,text,text,text,text) to service_role;

commit;
