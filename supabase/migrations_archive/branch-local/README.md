# Preserved branch-local migration sources

These files were moved out of `supabase/migrations` during read-only history reconciliation. They are retained as historical source; they are not active migrations and must not be applied.

The active directory now contains the exact twelve SQL statements recorded as applied in the Supabase migration ledger, under their remote version/name pairs. Local `001_initial_schema.sql` and `002_row_level_security.sql` matched the remote statements. The profile, avatar, and business branch-local files had different source text from the applied versions; the applied versions are preserved under their exact remote names in the active migration directory.

The Circles migration remains in the active directory as the next pending version. It was not applied during reconciliation.
