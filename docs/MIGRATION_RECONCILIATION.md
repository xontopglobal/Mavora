# Supabase migration reconciliation checkpoint

## Observed state (read-only)

Checkout: `phase-2b/full-functionality` at `b368795dc937517fc9d07ba92037d159d8b72a46`.

Before reconciliation, the branch had six SQL files under `supabase/migrations`:

- `001_initial_schema.sql`
- `002_row_level_security.sql`
- `20261121120000_profile_edit_permissions.sql`
- `20261121224819_profile_avatar_storage.sql`
- `20261122025921_ofsocio_circles_follow_lifecycle.sql`
- `20261122101500_business_publication.sql`

The active Supabase project reported twelve applied migration versions:

| Remote version | Remote name | Local source status |
| --- | --- | --- |
| `20261112133150` | `initial_schema` | Similar local baseline name; exact contents/version match not established |
| `20261112133226` | `row_level_security` | Similar local baseline name; exact contents/version match not established |
| `20261112133230` | `backend_security` | Historical source exists as `003_backend_security.sql` in Git commit `1f69035`; it is absent from this checkout, and equivalence to this remote version is not yet verified |
| `20261112133234` | `membership_billing_lifecycle` | Historical source exists as `004_membership_billing_lifecycle.sql` in Git commit `7bbb541`; it is absent from this checkout, and equivalence to this remote version is not yet verified |
| `20261112133257` | `restrict_public_security_definer_execution` | No local file |
| `20261112143820` | `grant_minimum_social_api_column_privileges` | No local file |
| `20261112144119` | `move_security_helpers_to_private_schema` | No local file |
| `20261121235318` | `profile_edit_permissions` | Local file has a different version; compare SQL before mapping |
| `20261121235324` | `profile_avatar_storage` | Local file has a different version; compare SQL before mapping |
| `20261121235332` | `business_publication` | Local file has a different version; compare SQL before mapping |
| `20261122021559` | `profile_groups_api_permissions` | No local file |
| `20261122021613` | `prevent_banned_membership_self_delete` | No local file |

The Circles migration has no matching applied version in the remote list. Its version `20261122025921` sorts after the latest applied version `20261122021613`, so it remains the next pending migration on this branch.

## Safe reconciliation decision

Do not reset the project, mark versions applied, delete/rename migrations, or add placeholder “already applied” files. The Supabase CLI is not installed in the checkout environment and `supabase/config.toml` is absent, so this pass did not pull a remote schema or migration source. The migration list alone is not enough to safely manufacture that history.

The exact SQL statement for each of the twelve applied versions was read from the remote `supabase_migrations.schema_migrations` ledger. Those statements are now restored under their exact timestamped names in `supabase/migrations`. Their SHA-256 digests match the remote statements after trimming only terminal CR/LF, which the migration runner does not treat as SQL content. The five branch-local files that conflicted with those applied versions were preserved in `supabase/migrations_archive/branch-local/`; they were not deleted or applied. This keeps a record of the older source while preventing it from being mistaken for pending migrations.

No database write occurred. The active project's migration ledger remains unchanged. The Circles migration remains pending. The Supabase CLI is unavailable and `supabase/config.toml` is absent, so a CLI migration-list check could not be run; the evidence for the current mapping is the read-only remote ledger plus matching SQL digests.

## Next safe checks

1. After installing/configuring the Supabase CLI, run its migration-list/status command against the active project and confirm the twelve versions are recognized as applied and Circles is the sole pending migration.
2. Review the archived branch-local files and recover any needed non-comment differences as a new additive migration only after schema comparison.
3. Validate proposed support and staff-action migrations on an isolated development database/branch and test ordinary/staff roles there.
4. Only after review, ask for approval before applying database changes to the active project.
