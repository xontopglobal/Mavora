-- Ofsocio profile bootstrap and group API privileges.
-- Keep all access authenticated and constrained by existing RLS policies.

-- Profile bootstrap: only id and display_name are inserted by the client.
REVOKE INSERT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT attname
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.profiles'::pg_catalog.regclass
      AND attnum > 0
      AND NOT attisdropped
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE INSERT (%I) ON TABLE public.profiles FROM PUBLIC, anon, authenticated',
      col.attname
    );
  END LOOP;
END;
$$;

GRANT INSERT (id, display_name) ON TABLE public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users create own profile" ON public.profiles;
CREATE POLICY "Users create own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);

-- Groups: reset any broad table/column grants, then grant only fields used by
-- list/create/detail flows. Existing RLS policies continue to restrict rows.
REVOKE ALL PRIVILEGES ON TABLE public.groups FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT attname
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.groups'::pg_catalog.regclass
      AND attnum > 0
      AND NOT attisdropped
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE SELECT (%1$I), INSERT (%1$I), UPDATE (%1$I), REFERENCES (%1$I) ON TABLE public.groups FROM PUBLIC, anon, authenticated',
      col.attname
    );
  END LOOP;
END;
$$;

GRANT SELECT (id, owner_id, name, description, visibility, created_at)
  ON TABLE public.groups TO authenticated;
GRANT INSERT (owner_id, name, description, visibility)
  ON TABLE public.groups TO authenticated;

-- Membership: read only membership fields and permit joining public groups.
-- Existing SELECT policy permits users to read their own membership rows.
REVOKE ALL PRIVILEGES ON TABLE public.group_members FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  col record;
BEGIN
  FOR col IN
    SELECT attname
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.group_members'::pg_catalog.regclass
      AND attnum > 0
      AND NOT attisdropped
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE SELECT (%1$I), INSERT (%1$I), UPDATE (%1$I), REFERENCES (%1$I) ON TABLE public.group_members FROM PUBLIC, anon, authenticated',
      col.attname
    );
  END LOOP;
END;
$$;

GRANT SELECT (group_id, user_id, role, status)
  ON TABLE public.group_members TO authenticated;
GRANT INSERT (group_id, user_id, role, status)
  ON TABLE public.group_members TO authenticated;

DROP POLICY IF EXISTS "Users request own membership" ON public.group_members;
CREATE POLICY "Users request own membership"
  ON public.group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'member'
    AND status = 'active'
    AND EXISTS (
      SELECT 1
      FROM public.groups AS target_group
      WHERE target_group.id = group_members.group_id
        AND target_group.visibility = 'public'
    )
  );

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
