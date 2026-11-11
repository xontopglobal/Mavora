-- RLS foundation. Validate policies with dedicated test users before production.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.follows enable row level security;
alter table public.posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.comments enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.businesses enable row level security;
alter table public.products enable row level security;
alter table public.services enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_reviews enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;

-- Helper avoids trusting client-supplied role metadata. Role assignment must be
-- restricted to trusted server/admin operations; no user-facing insert policy exists.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('moderator','support','admin','super_admin')
  );
$$;

create policy "Profiles visible to authenticated users" on public.profiles
for select to authenticated using (true);
create policy "Users create own profile" on public.profiles
for insert to authenticated with check (id = auth.uid());
create policy "Users update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Users read own role only" on public.user_roles
for select to authenticated using (user_id = auth.uid() or public.is_staff());

create policy "Users read own subscriptions" on public.subscriptions
for select to authenticated using (user_id = auth.uid() or public.is_staff());

create policy "Authenticated users read public posts" on public.posts
for select to authenticated using (visibility = 'public' or author_id = auth.uid());
create policy "Users create own posts" on public.posts
for insert to authenticated with check (author_id = auth.uid());
create policy "Users update own posts" on public.posts
for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Users delete own posts" on public.posts
for delete to authenticated using (author_id = auth.uid());

create policy "Users manage own follows" on public.follows
for all to authenticated using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy "Reactions visible to authenticated users" on public.post_reactions
for select to authenticated using (true);
create policy "Users manage own reactions" on public.post_reactions
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Comments visible to authenticated users" on public.comments
for select to authenticated using (true);
create policy "Users create own comments" on public.comments
for insert to authenticated with check (author_id = auth.uid());
create policy "Users manage own comments" on public.comments
for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Users delete own comments" on public.comments
for delete to authenticated using (author_id = auth.uid());

create policy "Public groups visible" on public.groups
for select to authenticated using (visibility = 'public' or owner_id = auth.uid());
create policy "Owners create groups" on public.groups
for insert to authenticated with check (owner_id = auth.uid());
create policy "Owners update groups" on public.groups
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Owners delete groups" on public.groups
for delete to authenticated using (owner_id = auth.uid());

create policy "Group members see own memberships" on public.group_members
for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "Users request own membership" on public.group_members
for insert to authenticated with check (user_id = auth.uid() and role = 'member');
create policy "Users leave own group" on public.group_members
for delete to authenticated using (user_id = auth.uid());

create policy "Businesses visible" on public.businesses
for select to authenticated using (true);
create policy "Owners manage businesses" on public.businesses
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Published products visible" on public.products
for select to authenticated using (status = 'published' or owner_id = auth.uid());
create policy "Owners manage products" on public.products
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Published services visible" on public.services
for select to authenticated using (status = 'published' or owner_id = auth.uid());
create policy "Owners manage services" on public.services
for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "Conversation participants read conversations" on public.conversations
for select to authenticated using (exists (
  select 1 from public.conversation_members cm
  where cm.conversation_id = id and cm.user_id = auth.uid()
));
create policy "Users see own conversation memberships" on public.conversation_members
for select to authenticated using (user_id = auth.uid());
create policy "Participants read messages" on public.messages
for select to authenticated using (exists (
  select 1 from public.conversation_members cm
  where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
));
create policy "Participants send own messages" on public.messages
for insert to authenticated with check (
  sender_id = auth.uid() and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()
  )
);

create policy "Advertisers read own campaigns" on public.ad_campaigns
for select to authenticated using (advertiser_id = auth.uid() or public.is_staff());
create policy "Advertisers create own pending campaigns" on public.ad_campaigns
for insert to authenticated with check (advertiser_id = auth.uid() and status = 'pending_review');
create policy "Staff read ad reviews" on public.ad_reviews
for select to authenticated using (public.is_staff());
create policy "Staff create ad reviews" on public.ad_reviews
for insert to authenticated with check (public.is_staff() and reviewer_id = auth.uid());

create policy "Users read own payment transactions" on public.payment_transactions
for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "Users manage own blocks" on public.user_blocks
for all to authenticated using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "Users create reports" on public.content_reports
for insert to authenticated with check (reporter_id = auth.uid());
create policy "Users see own reports and staff see all" on public.content_reports
for select to authenticated using (reporter_id = auth.uid() or public.is_staff());

-- NOTE: these policies are a starting point. Group visibility, membership approval,
-- admin-only campaign state transitions, moderation updates, storage buckets,
-- rate limiting and private profile rules need further hardening before production.
