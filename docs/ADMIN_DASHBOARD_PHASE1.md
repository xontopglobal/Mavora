# Ofsocio Admin Dashboard — Phase 1

This phase extends the existing 0.4.2 staff area. It adds:

- Admin overview metrics for members, posts, reports, support queue, active Premium and pending ads.
- Searchable member directory (name, username, email).
- Role management for `user`, `moderator`, `support`, `admin`, and `super_admin`.
- Content report review from the Admin Dashboard.
- Staff audit log viewer.
- A customer-service queue with status filters, requester identity, ticket assignment, replies and audited status changes.
- Staff replies and ticket changes are recorded in the staff audit log.

## Security behavior

- Admin dashboard RPCs require an authenticated `admin` or `super_admin` role.
- Only `super_admin` can grant or change `admin` / `super_admin` roles.
- A staff member cannot change their own role from the dashboard.
- The last `super_admin` cannot be demoted.
- Role changes and audit entries are written by database functions, not by client-side inserts.
- This phase does not implement account suspension/deletion or payment overrides. Those must use server-side Auth/payment verification endpoints, never direct client-side updates.

## Apply the migration

1. Back up the Supabase project or apply this first in a staging project.
2. Open Supabase Dashboard → SQL Editor.
3. Open and copy `supabase/migrations/009_admin_dashboard_member_roles_audit.sql` from this project.
4. Run it after the existing migration set through `008_live_feature_permissions_and_privacy_rpc.sql`.
5. If the SQL editor reports an error, stop and resolve that exact error before continuing; do not disable RLS or grant broad table access as a workaround.

The migration creates or normalizes the support ticket tables used by the current UI, and expects the current Ofsocio tables `profiles`, `user_roles`, `posts`, `content_reports`, `subscriptions`, and `ad_campaigns`. It intentionally replaces existing RLS policies on `support_tickets` and `support_ticket_messages` with restrictive member/staff policies; it does not turn RLS off. Review this change in staging first.

## Give the first admin access

The dashboard is not opened by a hidden URL. A trusted project owner must assign the first `super_admin` role in Supabase SQL Editor using the exact email of their own registered account. Replace the placeholder before running:

```sql
insert into public.user_roles(user_id, role)
select id, 'super_admin'
from auth.users
where lower(email) = lower('REPLACE_WITH_YOUR_REGISTERED_EMAIL')
on conflict (user_id) do update set role = excluded.role;
```

Verify that exactly the intended account has the role:

```sql
select u.email, r.role
from public.user_roles r
join auth.users u on u.id = r.user_id
where r.role in ('admin','super_admin');
```

Do not share service-role keys or grant admin access to ordinary member accounts.

## Frontend configuration

For the deployed Ofsocio frontend, `VITE_API_URL` remains the deployed Render API URL. This admin dashboard talks to Supabase through the existing authenticated client and secured RPCs; it does not require switching the production frontend to `localhost`.

## Build and test checklist

- Sign in with the assigned super-admin account and confirm Admin Dashboard appears.
- Confirm a normal member cannot see or invoke admin RPCs.
- Search members by username and email.
- Assign a test account the `support` role; verify it appears in the Customer Service staff queue after a fresh sign-in.
- Try granting `admin` as an ordinary admin and confirm the database rejects it.
- Confirm role changes appear in the audit log.
- Review a test report and confirm the report status and audit log update.
- Verify the Customer Service staff account can assign a ticket to itself, reply, and update status.
