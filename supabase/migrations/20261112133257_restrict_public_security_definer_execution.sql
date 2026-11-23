
begin;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
revoke execute on function public.can_view_follower_list(uuid) from public, anon;
revoke execute on function public.can_view_post(uuid, text) from public, anon;
revoke execute on function public.can_view_profile(uuid) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_block_relationship(uuid, uuid) from public, anon;
revoke execute on function public.has_permission(text) from public, anon;
revoke execute on function public.is_account_restricted(uuid, text) from public, anon;
revoke execute on function public.is_age_eligible(uuid) from public, anon;
revoke execute on function public.is_approved_follower(uuid, uuid) from public, anon;
revoke execute on function public.is_staff() from public, anon;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
commit;
