-- Business publication state and owner-aware discovery.
-- Existing business rows become published; new rows default to drafts.
alter table public.businesses
  add column if not exists status text not null default 'published';

-- Named, conditional constraint keeps a repeat run from duplicating it.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.businesses'::pg_catalog.regclass
      and conname = 'businesses_publication_status_check'
  ) then
    alter table public.businesses
      add constraint businesses_publication_status_check
      check (status in ('draft', 'published', 'archived'));
  end if;
end;
$$;

alter table public.businesses alter column status set not null;
alter table public.businesses alter column status set default 'draft';

create index if not exists businesses_status_created_idx
  on public.businesses (status, created_at desc);
create index if not exists businesses_owner_created_idx
  on public.businesses (owner_id, created_at desc);

drop policy if exists "Businesses visible" on public.businesses;
drop policy if exists "Published businesses or own businesses visible" on public.businesses;
create policy "Published businesses or own businesses visible" on public.businesses
for select to authenticated
using (status = 'published' or owner_id = (select auth.uid()));

-- The existing owner-only policies remain the write boundary. RLS controls
-- rows; these grants only make the required Data API operations available.
revoke all privileges on table public.businesses, public.products, public.services
  from public, anon;

-- Table-level REVOKE does not remove column-level grants. Clear those as well
-- so PUBLIC and anon remain ungranted even if prior column ACLs exist.
do $$
declare
  target_table text;
  target_column record;
begin
  for target_table in
    select unnest(array['businesses', 'products', 'services']::text[])
  loop
    for target_column in
      select attname
      from pg_catalog.pg_attribute
      where attrelid = pg_catalog.to_regclass(pg_catalog.format('public.%I', target_table))
        and attnum > 0
        and not attisdropped
    loop
      execute pg_catalog.format(
        'revoke select (%1$I), insert (%1$I), update (%1$I), references (%1$I) on table public.%2$I from public, anon',
        target_column.attname,
        target_table
      );
    end loop;
  end loop;
end;
$$;

grant select, insert, update, delete
  on table public.businesses, public.products, public.services
  to authenticated;

-- Product and service owner/published policies are reused without duplication.