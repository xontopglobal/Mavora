begin;

create extension if not exists pgtap with schema extensions;

insert into auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','security-user-1@mavora.test','',now(),'{}','{}'),
  ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','security-user-2@mavora.test','',now(),'{}','{}'),
  ('10000000-0000-4000-8000-000000000003','authenticated','authenticated','security-user-3@mavora.test','',now(),'{}','{}')
on conflict (id) do nothing;

update public.age_assurance set status = 'eligible', verified_at = now()
where user_id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003'
);
update public.profiles set is_private = true
where id = '10000000-0000-4000-8000-000000000002';
update public.user_roles set role = 'kyc_reviewer'
where user_id = '10000000-0000-4000-8000-000000000002';
update public.user_roles set role = 'kyc_reviewer'
where user_id = '10000000-0000-4000-8000-000000000003';

insert into public.kyc_applications(id, applicant_id, application_type)
values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','individual'),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','individual');
insert into public.friend_requests(id, sender_id, recipient_id)
values ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');
insert into public.posts(id, author_id, body, visibility)
values ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Private fixture','friends');
insert into public.comments(id, post_id, author_id, body)
values ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','Private comment fixture');
select extensions.plan(15);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
set local role authenticated;

select extensions.is_empty(
  $$select id from public.profiles where id = '10000000-0000-4000-8000-000000000002'$$,
  'private profile is hidden without an approved relationship'
);
select extensions.is(
  (select public.request_follow('10000000-0000-4000-8000-000000000002')),
  'requested', 'following a private account creates a pending request'
);

reset role;
insert into public.follows(follower_id, followed_id)
values ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');
set local role authenticated;
select extensions.ok(
  (select count(*) = 1 from public.profiles where id = '10000000-0000-4000-8000-000000000002'),
  'approved followers can view private profiles'
);

select extensions.throws_ok(
  $$update public.user_roles set role = 'super_admin' where user_id = auth.uid()$$,
  '42501', null, 'users cannot grant themselves an administrator role'
);
select extensions.throws_ok(
  $$update public.age_assurance set status = 'eligible' where user_id = auth.uid()$$,
  '42501', null, 'users cannot self-approve age eligibility'
);
select extensions.throws_ok(
  $$insert into public.subscriptions(user_id, plan, status) values (auth.uid(), 'premium', 'active')$$,
  '42501', null, 'users cannot grant themselves Premium'
);
select extensions.throws_ok(
  $$update public.kyc_applications set status = 'verified' where id = '20000000-0000-4000-8000-000000000002'$$,
  '42501', null, 'applicants cannot update their own KYC status'
);
select extensions.is_empty(
  $$select id from public.comments where id = '50000000-0000-4000-8000-000000000001'$$,
  'comments on inaccessible posts remain hidden'
);

reset role;
insert into public.user_blocks(blocker_id, blocked_id)
values ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001');
set local role authenticated;
select extensions.is_empty(
  $$select id from public.profiles where id = '10000000-0000-4000-8000-000000000002'$$,
  'blocking restricts visibility in both directions'
);
select extensions.ok(
  not has_function_privilege('authenticated','public.finalize_verified_payment(text,text,numeric,text,text)','execute'),
  'payment finalization is not executable by authenticated users'
);

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select extensions.throws_ok(
  $$select public.review_kyc('20000000-0000-4000-8000-000000000001','verified',null)$$,
  '42501', null, 'a reviewer cannot approve their own KYC application'
);
select extensions.throws_ok(
  $$select public.accept_friend_request('30000000-0000-4000-8000-000000000001')$$,
  'P0002', null, 'a friend-request sender cannot accept their own request'
);

select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
select extensions.lives_ok(
  $$select public.review_kyc('20000000-0000-4000-8000-000000000002','verified',null)$$,
  'a different authorized reviewer may decide KYC'
);
select extensions.is(
  (select status from public.kyc_applications where id = '20000000-0000-4000-8000-000000000002'),
  'verified', 'review result is persisted'
);
select extensions.throws_ok(
  $$insert into public.audit_logs(action, target_type, target_id) values ('forged','user','10000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'clients cannot forge audit records'
);

select * from extensions.finish();
rollback;