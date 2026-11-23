# Ofsocio Phase 2B — Full Functionality Roadmap

This roadmap is based on the current `phase-2b/full-functionality` branch, the checked-in migrations, and the existing React/Vite, Express, and Supabase architecture. It does not assume live database state. Migrations in this plan are review artifacts until deliberately applied to a development Supabase project.

## Shared implementation rules

- Preserve `apps/web/src/main.jsx` authentication/session handling and use the existing `apps/web/src/lib/supabase.js` client.
- Keep ordinary user operations in small feature services under `apps/web/src/lib/` using the signed-in client and narrowly scoped RLS. Do not ship service-role or provider secrets to a browser or mobile bundle.
- Use the Express API only where a trusted server boundary is required: privileged staff actions, provider callbacks, AI calls, and support escalation. Add bearer-token verification, authorization from trusted database role records, input validation, rate limiting, and audit records before those routes.
- Extend existing tables when their domain matches. Do not duplicate `groups`, `group_members`, `businesses`, `products`, `services`, `posts`, `user_roles`, `subscriptions`, or `content_reports`.
- Every new table or storage object needs explicit owner/participant policies, constraints, indexes where useful, and tests for allowed and denied users.
- Keep sample content visibly labeled until a complete read/write flow is connected. A feature is not complete until loading, success, empty, failure, and authorization states work.

## Sub-phases

### 2B.1 Profile photos — current vertical slice

- **Reuse:** `profiles.avatar_url`, Phase 2A's own-profile service and RLS update policy, the existing profile UI, and the current Supabase client.
- **Add:** private `avatars` Storage bucket, 5 MiB limit, JPEG/PNG/WebP allowlist, owner-folder `SELECT`/`INSERT`/`DELETE` policies, and a profile trigger that accepts only an existing object under that profile's own UUID folder. Keep object paths in `avatar_url`; the UI requests short-lived signed URLs.
- **UI/service:** select, validate, upload a new unique object without upsert, update the current profile pointer, clean up the previous owned object after success, and show busy/success/error/cleanup-warning states.
- **Tests:** unit tests for size/type/empty-file validation; build; later local Supabase tests for authenticated owner upload/read/delete, cross-user denial, anon denial, profile-path validation, and replacing a photo without losing the previous photo on failure.
- **Boundary:** the private bucket currently allows the owner to read their own photo. Cross-user avatar visibility should be added only with an explicit profile visibility/follow/block policy.

### 2B.2 Shared authorization and data-service foundation

- **Reuse:** Supabase client auth/session; `user_roles` and `is_staff()` as existing schema concepts; Express security middleware stack (`helmet`, CORS, rate limit).
- **Add:** service conventions for validation/error mapping/loading states; API middleware that verifies the bearer token against Supabase and resolves staff permissions from trusted server-side records; audit logging for privileged changes; local Supabase config and RLS test setup when environment permits.
- **Permissions:** never trust browser role flags or editable user metadata. User-facing DB calls remain under RLS; elevated API credentials stay in server environment only.
- **Tests:** two-user RLS cases, unauthenticated API rejection, staff/non-staff authorization, invalid token rejection, and secret-scan checks.

### 2B.3 Groups

- **Reuse:** `groups` and `group_members` (including visibility, member role, and pending/active/banned status).
- **Review/fix before enabling:** current policies let users create groups as owner and request membership as member, but the insert policy does not enforce group visibility/status semantics; membership reads are limited to self/staff. Do not add duplicate group tables.
- **Add if required:** narrow RPCs or policies for public join versus private pending request, owner/moderator approvals, group settings, member counts, and group content relationships. Add constraints against self-escalation and mismatched group/user ownership.
- **UI/service:** real group discovery, create/edit, join/request/cancel, approval, leave, empty/error states; remove hard-coded cards.
- **Tests:** public/private/hidden visibility, owner-only controls, pending approval, member role escalation denial, block/ban behavior.

### 2B.4 Business profiles and listings

- **Reuse:** `businesses`, `products`, `services`, and existing owner/published RLS policies.
- **Add only after product rules are specified:** business verification linkage, listing media storage, safe publish/moderation transitions, and indexes/constraints missing from the current broad schema. Avoid duplicating business records as pages.
- **UI/service:** business discovery, owner create/edit, products/services create/edit/publish/archive, verified state from backend, server-validated media and links.
- **Tests:** owner isolation, public published-only visibility, draft visibility, invalid price/currency/URL handling, verification/approval restrictions.

### 2B.5 Pages

- **Current state:** no `pages` table or distinct Pages screen exists. Business is a separate screen and schema.
- **Decision before schema:** define whether a Page is a creator/community identity, an organization/business page, or both. If a Page is only a business storefront, extend `businesses` instead of creating `pages`. If it is a distinct followable identity, add a dedicated `pages` table with owner/member roles and its own visibility/follow/content model.
- **UI/service/tests:** create/manage page, roles, discovery, follow, content, and owner transfer only after the data model is approved; test owner/member authorization and visibility.

### 2B.6 Reels

- **Reuse:** `posts` for social interactions only if the post model is intentionally extended; currently it has `body`, `media_urls`, and visibility, but no media type or video lifecycle.
- **Add:** decide between extending posts with a constrained media record or a dedicated `reels` table; add private video storage, upload constraints, processing/moderation state, signed playback access, reactions/comments, and cleanup. Do not treat the current static reel mock as persisted content.
- **UI/service:** upload, processing/error states, feed query, playback, pause/mute, reactions/comments, report; handle mobile bandwidth and accessible controls.
- **Tests:** uploader ownership, file/type/size/duration limits, denied private playback, state transitions, and feed visibility.

### 2B.7 Admin dashboard and moderation

- **Reuse:** `user_roles`, `is_staff()`, `ad_reviews`, `content_reports`, `ad_campaigns`, and `group_members` moderation roles.
- **Current gap:** the UI approval desk and capability/API calls are preview scaffolding; Express has no authenticated admin routes. Existing `is_staff()` is a database helper, not a complete API authorization layer.
- **Add:** server-side token verification and permission checks, narrowly scoped actions, reviewer/audit fields, immutable decision history as required, and safe pagination. Never let clients set their own roles or approve themselves.
- **Tests:** regular user cannot read queues or act; staff can only perform granted actions; self-approval and forged role claims fail; changes are audited.

### 2B.8 Customer service and FAQ

- **Reuse:** `content_reports` for safety reports only; do not overload it into customer support tickets.
- **Add:** support ticket/conversation/message tables with requester and assigned staff policies, status/severity, attachment storage restrictions, retention rules, and audit events. Add FAQ article storage with published/archived state and staff-controlled editing; no duplicate FAQs in client constants.
- **UI/service:** create ticket, reply, attachment flow, status, customer history, staff queue, searchable FAQ with loading/empty/error states.
- **Tests:** customer sees own tickets only, assigned staff scope, attachment ownership, published FAQ visibility, and unauthorized staff writes denied.

### 2B.9 AI support

- **Reuse:** FAQ retrieval and customer-service escalation from 2B.8.
- **Add:** authenticated, rate-limited Express endpoint; provider key held only by server; input/output size limits, abuse controls, privacy notice/retention choice, safe refusal/escalation behavior, and no authority to change accounts, payments, KYC, or moderation decisions.
- **Data:** store only the conversation data needed by the user-visible feature, with user ownership and retention controls. Do not expose internal admin or private profile records to the model.
- **Tests:** unauthenticated/rate-limited requests, prompt injection boundary checks, no secret leakage, refusal/escalation behavior, and correct ticket handoff.

## Current repository gaps and validation constraints

- The checked-in schema has `profiles`, follows/posts, groups/members, businesses, products/services, roles, reports, and payment records. It has no Pages, Reels, support-ticket, FAQ, or AI-conversation schema.
- No Storage bucket or Storage policy appears in the checked-in migrations.
- `apps/api` currently exposes health/status and a webhook scaffold; the SocialShell's API helper is a disconnected placeholder.
- Web scripts currently provide Vite build/preview/dev; no Supabase local config or RLS test harness is checked in. The avatar validation tests added for 2B.1 run with Node's built-in test runner and do not require a database.
- Do not claim database-backed flows verified until the migration is applied and exercised in a disposable development Supabase environment with at least two test users.
