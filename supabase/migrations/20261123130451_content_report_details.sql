alter table public.content_reports
  add column if not exists description text not null default '';

update public.content_reports set description = '' where description is null;

alter table public.content_reports alter column description set default '';
alter table public.content_reports alter column description set not null;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.content_reports'::pg_catalog.regclass
      and conname = 'content_reports_description_length_check'
  ) then
    alter table public.content_reports
      add constraint content_reports_description_length_check
      check (char_length(description) <= 2000);
  end if;
end;
$$;

create unique index if not exists content_reports_one_active_per_reporter_target_idx
  on public.content_reports (reporter_id, target_type, target_id)
  where status in ('open','reviewing');

revoke insert on table public.content_reports from public, anon, authenticated;
revoke insert (reporter_id, target_type, target_id, reason, description)
  on table public.content_reports from public, anon, authenticated;
grant insert (reporter_id, target_type, target_id, reason, description)
  on table public.content_reports to authenticated;
