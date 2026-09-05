begin;

-- A small, searchable picker includes private staff records without exposing
-- owner details or copying every burial into the browser.
create function public.search_staff_burials(p_query text default '', p_page integer default 1)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  q text := public.search_normalize(left(coalesce(p_query, ''), 160));
  page_number integer := greatest(1, least(coalesce(p_page, 1), 10000));
  result jsonb;
begin
  if not public.is_active_admin_or_manager() then
    raise exception 'An active staff account is required' using errcode = '42501';
  end if;
  with matches as (
    select br.burial_id, d.display_name, l.lot_code, a.area_name
    from public.burial_record br
    join public.deceased d using (deceased_id)
    join public.lot l using (lot_id)
    left join public.area a on a.area_id = l.area_id
    where br.deleted_at is null and l.deleted_at is null
      and (q = '' or not exists (
        select 1 from regexp_split_to_table(q, ' +') token
        where position(token in public.search_normalize(d.display_name)) = 0
      ) or position(replace(q, ' ', '') in replace(public.search_normalize(l.lot_code), ' ', '')) > 0)
  ), page as (
    select * from matches order by display_name, burial_id limit 20 offset (page_number - 1) * 20
  ) select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(page)) from page), '[]'::jsonb),
      'total', (select count(*) from matches)) into result;
  return result;
end $$;
revoke all on function public.search_staff_burials(text, integer) from public;
grant execute on function public.search_staff_burials(text, integer) to authenticated;

create function public.staff_dashboard_counts() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.is_active_admin_or_manager() then
    raise exception 'An active staff account is required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'active', (select count(*) from public.burial_record where deleted_at is null and record_status='active'),
    'pending', (select count(*) from public.burial_record where deleted_at is null and record_status='pending'),
    'archived', (select count(*) from public.burial_record where deleted_at is null and record_status='archived'),
    'plots', (select count(*) from public.lot where deleted_at is null),
    'unverified', (select count(*) from public.lot where deleted_at is null and not coordinate_verified),
    'missingCoordinates', (select count(*) from public.lot where deleted_at is null and location_geom is null),
    'pendingCoordinates', (select count(*) from public.lot where deleted_at is null and location_geom is not null and coordinate_status='pending')
  );
end $$;
revoke all on function public.staff_dashboard_counts() from public;
grant execute on function public.staff_dashboard_counts() to authenticated;

-- Stable ordering for paginated operational lists, including equal timestamps.
create index burial_current_updated_idx on public.burial_record(updated_at desc, burial_id desc) where deleted_at is null;
create index lot_current_updated_idx on public.lot(updated_at desc, lot_id desc) where deleted_at is null;
create index photo_review_page_idx on public.photo(approval_status, created_at desc, photo_id desc);
commit;
