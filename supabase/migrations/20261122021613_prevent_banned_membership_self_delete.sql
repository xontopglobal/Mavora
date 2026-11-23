DROP POLICY IF EXISTS "Users leave own group" ON public.group_members;
CREATE POLICY "Users leave own group"
  ON public.group_members
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND status <> 'banned'
  );
