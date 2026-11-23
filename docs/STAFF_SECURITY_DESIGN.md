# Staff dashboard and support security design

## Security boundary

- The web and mobile clients never decide that a user is staff. A browser-visible capability list is navigation/UI state only; every staff API route independently checks the bearer token, role, and permission.
- The API validates each access token against Supabase Auth `/auth/v1/user`. It does not authorize from a decoded JWT, profile field, user metadata, or a client-supplied user ID.
- After identity validation, the API reads `user_roles` and `role_permissions` using a server-only service-role credential. Missing rows mean the `user` role with no permissions. Missing configuration, unknown errors, and schema mismatch fail closed.
- Role grants are read-only in this API. No self-service role assignment, role-management endpoint, or client-writable staff metadata exists.
- Service-role credentials remain in the API process. Staff data is returned only after a route-level permission check and responses use `Cache-Control: no-store`.

## Current permission areas

The active database has a `role_permissions` table. The observed grants include `reports.read` and `moderation.review` for moderation; `kyc.read` and `kyc.review` for verification; `accounts.restrict` for account restrictions; `audit.read` for audit review; and `support.read` for support. The API uses these stored grants, not role-name shortcuts. `admin` and `super_admin` receive only the permissions present in that table.

## Data and action boundaries

| Capability | Read path | Write path |
| --- | --- | --- |
| Reports/moderation | Paginated `content_reports`, gated by `reports.read` | Disabled until a narrow transactional operation updates the report/content, records an immutable audit event, and applies any account restriction together |
| Verification | Paginated `kyc_applications`, gated by `kyc.read`; only outcome metadata is returned | Disabled until a transactional review operation checks `kyc.review`, prevents self-review, updates reviewer/status, and records the audit event atomically |
| Accounts | No bulk auth-user directory or profile search is exposed yet | Disabled until a scoped account service covers reason, duration, appeal, revoke, session invalidation, least privilege, and audit requirements |
| Audit | Paginated audit metadata, gated by `audit.read` | Audit rows must be append-only to application roles; no dashboard edit/delete route |
| Customer service | Not available: no support-ticket schema exists in the checked-in migrations | Requires a separate requester/assignee ticket model, row access rules, status transitions, safe message/attachment storage, retention, and audit design |
| AI escalation | Not available | Must create an owned support ticket through the same ticket service; AI cannot authorize account, payment, KYC, or moderation actions |

The customer-facing `content_reports` table must not be repurposed as customer support. A support ticket requires its own data model and policies. The current checkout's migrations and the active database's migration history differ, so no new migration is prepared or applied in this stage.

## Support-ticket model proposal

This is a review proposal, not an applied schema. A minimal version should use two related records:

- `support_tickets`: UUID, requester ID, optional assigned staff ID, subject, category, status (`open`, `awaiting_customer`, `awaiting_support`, `resolved`, `closed`), priority (`low`, `normal`, `high`, `urgent`), source (`human`, `ai_escalation`), created/updated/resolved timestamps, and a minimal close/reopen reason category.
- `support_messages`: UUID, ticket ID, author ID, author kind (`requester`, `staff`, `assistant`, `system`), body, created timestamp, and an explicit internal-note flag. Customer endpoints must never return staff-only notes. The database must ensure the message author is the caller for customer writes and the ticket is assigned or in the staff's permitted queue for staff writes.

Indexes should support requester history, staff queue by status/priority/creation time, and ticket message order. Tickets and messages need row-level access for the requester and authorized support staff. Assignment and escalation need distinct permissions; the current live grant `support.read` does not establish reply/assignment authority, so grants must be reviewed instead of assuming the role can mutate. Attachments should be a later, private-storage feature with per-ticket ownership policies and retention; do not put raw identity/payment documents in ticket bodies. AI escalation creates a normal requester-owned ticket through a constrained server path and must not expose staff notes or internal audit data to the model.

Define a retention period and deletion/anonymization behavior before launch. Audit assignment, status changes, priority changes, staff replies, internal notes, escalations, and closure with actor, ticket, reason category, and timestamp. Audit records must not copy message bodies or sensitive attachments.

## Required write-operation contract

Every privileged mutation must have a narrow server route and an atomic database operation (transactional RPC or equivalent) that rechecks the actor's current permission, validates target/state transitions, prevents self-review where applicable, writes the domain change and immutable audit event together, and returns the resulting record. The service must not use multi-request “update then audit” sequences. An RPC must derive the actor from the verified Supabase session (`auth.uid()`), run with a fixed/empty `search_path`, use fully qualified table names, and have execute grants restricted to the intended role; never trust an actor ID or permission supplied in JSON. Role changes require a separate high-trust process, two-person approval, prevention of self-change/last-super-admin lockout, and an audit record; no regular staff dashboard route grants roles.

## Current implementation scope

The API verifies identity and role grants and exposes read-only capabilities, report, verification, and audit endpoints. The staff UI reads those queues. It does not present working approve/reject, restriction, account, ticket, or AI escalation actions until the corresponding safe service exists. Pagination is bounded, responses are uncached, and staff routes are rate-limited by the existing API limiter.

## Verification required before enabling write actions

- Reconcile local migration files with the active database history before authoring schema/RPC changes.
- Add authorization tests for ordinary users, each least-privilege staff role, forged metadata, expired tokens, self-review, and revoked permissions.
- Add database tests that prove rollback when audit insertion fails and that ordinary authenticated users cannot read staff data or mutate staff roles.
- Run Supabase security advisors and review RLS, function grants, service-role handling, retention, session revocation, and appeal paths before production rollout.
