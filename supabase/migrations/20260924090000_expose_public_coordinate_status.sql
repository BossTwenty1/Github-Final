begin;

-- Visitors need the existing review state to distinguish pending and rejected
-- destinations. Rejection reasons remain private; only the bounded status is exposed.
create or replace view public.public_burial_records with (security_barrier = true) as
select br.burial_id,d.display_name,d.birth_date,d.death_date,br.record_status,l.lot_code,l.location_geom,
 l.px_loc_x,l.px_loc_y,l.coordinate_verified as location_verified,
 coalesce(a.area_name,la.area_name) as area_name,s.sector_name,b.block_number,br.interment_date,
 l.coordinate_status
from public.burial_record br join public.deceased d using(deceased_id) join public.lot l using(lot_id)
left join public.area a on a.area_id=l.area_id left join public.block b using(block_id)
left join public.sector s using(sector_id) left join public.area la on la.area_id=s.area_id
where br.record_status='active' and d.public_display and br.deleted_at is null and l.deleted_at is null;

revoke all on public.public_burial_records from public;
grant select on public.public_burial_records to anon, authenticated;

comment on view public.public_burial_records is
  'Safe public surface containing active approved burial fields and the bounded coordinate review status used to gate visitor navigation.';

commit;
