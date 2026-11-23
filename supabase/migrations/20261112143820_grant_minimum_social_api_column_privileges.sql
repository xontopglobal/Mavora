
-- Grant only the columns used by the authenticated Express social API.
-- Existing RLS policies remain the row-level authorization boundary.

grant select (id, author_id, body, media_urls, visibility, created_at)
  on public.posts to authenticated;
grant insert (author_id, body, media_urls, visibility)
  on public.posts to authenticated;

grant insert (blocker_id, blocked_id)
  on public.user_blocks to authenticated;

grant insert (reporter_id, target_type, target_id, reason)
  on public.content_reports to authenticated;
grant select (id, status, created_at)
  on public.content_reports to authenticated;
