-- Safe read surfaces needed by the local frontend.
-- This is an additive integration migration. It does not add seed records,
-- coordinates, credentials, or change existing RLS authorization.

create or replace function public.get_my_account()
returns table (
    account_id uuid,
    username text,
    role_name text,
    account_status text,
    is_active boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select a.account_id, a.username, upper(r.role_name), a.account_status, a.is_active
      from public.account as a
      join public.role as r on r.role_id = a.role_id
     where a.account_id = auth.uid();
$$;

revoke all on function public.get_my_account() from public;
grant execute on function public.get_my_account() to authenticated;

create or replace view public.public_burial_records
with (security_barrier = true)
as
select
    br.burial_id,
    d.display_name,
    d.birth_date,
    d.death_date,
    br.record_status,
    l.lot_code,
    l.location_geom,
    l.px_loc_x,
    l.px_loc_y,
    l.coordinate_verified as location_verified,
    ar.area_name,
    s.sector_name,
    b.block_number
from public.burial_record as br
join public.deceased as d on d.deceased_id = br.deceased_id
join public.lot as l on l.lot_id = br.lot_id
join public.block as b on b.block_id = l.block_id
join public.sector as s on s.sector_id = b.sector_id
join public.area as ar on ar.area_id = s.area_id
where br.record_status = 'active'
  and d.public_display;

revoke all on public.public_burial_records from public;
grant select on public.public_burial_records to anon, authenticated;
