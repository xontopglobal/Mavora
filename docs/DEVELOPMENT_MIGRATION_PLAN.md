# Ofsocio development database migration plan

Status: read-only reconciliation and review. No database changes have been applied.

## Protected repository state

- Checkout: `phase-2b/full-functionality` at `abea7682cfb95749bab6ae2d4d298da2267a276b`.
- The two remote commits were fast-forwarded after confirming their only change is a 100% identical rename of the Circles migration from `20261122025921_ofsocio_circles_follow_lifecycle.sql` to `20261123113205_ofsocio_circles_follow_lifecycle.sql`.
- The existing dirty changes were backed up in `stash@{0}` and restored. Keep that stash until the changes are committed and independently backed up.
- Nothing was pushed, deployed, or applied to Supabase.

## Development database evidence

The confirmed development target is Supabase project `kpgkamroekhhqpzmsfsf` (Mavora), status `ACTIVE_HEALTHY`, PostgreSQL 17.11. The read-only Supabase migration list contains 13 versions, ending at `20261123113205` (`ofsocio_circles_follow_lifecycle`). That matches the renamed local Circles migration. The remote database also exposes `get_my_follow_requests()` from that migration.

This project is confirmed through the Supabase connection, but this checkout is not linked for CLI use: `supabase/.temp/project-ref` is absent and `SUPABASE_ACCESS_TOKEN` is not set. The config's `project_id = "Ofsocio-github-checkout"` is only a local Supabase project name, not the remote project reference.

Read-only schema inspection found:

- `businesses` has `id`, `owner_id`, `name`, `description`, `website_url`, `country_code` (two-character ISO region code), `created_at`, and `status`. It has no phone column.
- Owner write and published/owner read policies exist for businesses. Products and services have owner write and published/owner read policies.
- The development database currently has zero business, product, and service rows; empty catalog screens are accurate for this database.
- `content_reports` has no description column yet and currently has zero rows. The checked-in report migration's active-report index therefore has no existing duplicate rows to reconcile.
- Messaging tables and RLS already exist. The read policies enforce account eligibility, messaging restrictions, participant membership, and block relationships.
- `stories`, `reels`, `story_views`, support ticket tables, and the `social-media` bucket do not exist yet. The private `avatars` bucket does exist.
- `audit_logs` has the fields used by the support workflow, and `role_permissions` uses `(role, permission)` as its primary key.

## Pending local migrations

These are newer than the confirmed remote history and must be reviewed and applied in timestamp order on development only:

1. `20261123124020_secure_direct_messaging.sql` — minimum message column grants, authenticated conversation RPCs, and Realtime publication membership. Existing message RLS remains in force.
2. `20261123124743_stories_reels_media_storage.sql` — private media bucket, Stories/Reels tables, ownership and visibility RLS, storage policies, and upload constraints. Expired Story rows become hidden, but object deletion still needs scheduled cleanup.
3. `20261123124749_support_ticket_workflow.sql` — customer-owned ticket tables, permission-gated staff RPCs, and audit writes. Confirm the `support.reply` grants and audit events with ordinary-user and staff accounts.
4. `20261123130451_content_report_details.sql` — bounded report explanation, restricted insert columns, and a unique index preventing duplicate active reports by the same reporter for the same target.
5. `20261123141500_story_view_tracking.sql` — unique Story views with owner-only aggregate counts; viewer-level records are not directly selectable.
6. `20261123143000_member_suggestions.sql` — bounded suggestions RPC for eligible public profiles and an avatar read policy tied to profile visibility and block checks.

The first six migrations depend on the already-applied foundation through `20261123113205`. The media and Story-view migrations are ordered so the referenced Stories table exists first.

## Business phone migration proposal

The existing `businesses.country_code` must remain an ISO alpha-2 region code (such as `NG`); it is not a telephone prefix. Before the Business form can save contact numbers, prepare a separate migration that adds nullable `phone_e164 text` with an E.164 constraint, then grant authenticated select/insert/update on that column while preserving the current owner-write and published/owner-read RLS policies. Store a normalized number such as `+234…`; keep the UI country selector separate from the national-number input and use a maintained numbering-plan library for parsing/validation. The database currently has no phone values to backfill.

That migration and its frontend/dependency changes are not included in the six pending files above. Add them only after the intended contact visibility (public when published versus owner-only) is confirmed in product behavior and the library/package-lock change is reviewed.

## Pre-apply and verification gates

1. Preserve the safety stash and confirm the branch remains `phase-2b/full-functionality` before any migration operation.
2. Run SQL lint/dry-run against a disposable local PostgreSQL/Supabase stack using the exact migration order. Resolve any function, grant, policy, or publication errors before touching the shared development project.
3. Recheck that the development migration history still ends at `20261123113205`; do not replay or re-register that already-applied Circles migration.
4. Apply only the reviewed pending versions to the confirmed development project after explicit go-ahead. Never target production.
5. Run post-apply read-only schema, function-signature, RLS, storage-bucket, and migration-history checks.
6. Test with separate ordinary-user and staff accounts: Circles requests, public/private profile visibility, suggestions and blocks, Messages and Realtime, Story/Reel upload/playback/delete/expiry/view counts, ticket ownership/staff audit events, and report submission/duplicate rejection.
7. Verify responsive behavior at 320, 375, 390, 430, tablet, and desktop widths, including keyboard focus, contrast, text scaling, and horizontal overflow. Do not push or deploy until those checks pass.

## Current blockers

- The CLI executable is an extracted `supabase_2.122.1_windows_amd64.zip` release in the Windows temp directory, not a package-manager installation and not on `PATH`. Its EXE metadata reports Bun 1.4.2. Without telemetry opt-out it exits 1 trying to write `C:\Users\USER\.supabase\telemetry.json.tmp.<uuid>`; setting `SUPABASE_TELEMETRY_DISABLED=1` for the process makes `--version` return `2.122.1` without changing project dependencies.
- `supabase db push --dry-run --linked` was attempted with the telemetry opt-out. It exited before remote access with `ProjectRefNotLinkedError: Cannot find project ref. Have you run supabase link?` because the checkout has no link metadata. No CLI access token is available, so the confirmed development target could not be linked safely in this session.
- Docker Desktop is installed, but `com.docker.service` is stopped (`Manual`). Docker CLI cannot read `C:\Users\USER\.docker\config.json` or context metadata and cannot open `npipe:////./pipe/docker_engine`. An elevated attempt to start the service was denied (`Cannot open 'com.docker.service' service on computer '.'`). Docker-backed local Supabase is unavailable to this account.
- The six pending migrations have not been linted against local PostgreSQL or applied to development. The remote MCP history/schema inspection is read-only; it is not a SQL execution dry-run. The supported CLI command is `supabase db push --dry-run --linked`, which prints planned migrations without applying them, but it still requires a project link and CLI auth. A local Supabase stack requires a working container runtime.
- Real authenticated ordinary-user/staff accounts and media files are needed for the post-apply integration checks.
- Business phone storage/UI work remains to be designed and implemented.
- AI support still requires a configured provider and server-side integration.
- Live browser viewport and contrast testing remains outstanding.
