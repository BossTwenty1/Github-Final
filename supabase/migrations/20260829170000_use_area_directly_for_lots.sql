-- GraveNav location hierarchy: site -> area/garden -> plot.
--
-- The original schema required every lot to pass through sector and block.
-- The supplied Phase 1 map contains gardens but no official sector/block data,
-- so plots now link directly to public.area. block_id remains nullable only as
-- a legacy compatibility field for any older imported rows.

begin;

alter table public.lot add column if not exists area_id bigint;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.lot'::regclass
       and conname = 'lot_area_id_fkey'
  ) then
    alter table public.lot
      add constraint lot_area_id_fkey foreign key (area_id)
      references public.area(area_id) on delete restrict;
  end if;
end
$$;

-- Preserve the old hierarchy for existing rows before making the direct
-- garden relationship mandatory.
update public.lot as l
   set area_id = s.area_id
  from public.block as b
  join public.sector as s on s.sector_id = b.sector_id
 where l.block_id = b.block_id
   and l.area_id is null;

do $$
declare
  unassigned_lots integer;
begin
  select count(*) into unassigned_lots from public.lot where area_id is null;
  if unassigned_lots > 0 then
    raise exception 'Cannot switch to site-area-plot hierarchy: % lot rows have no area', unassigned_lots;
  end if;
end
$$;

alter table public.lot alter column area_id set not null;
alter table public.lot alter column block_id drop not null;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.lot'::regclass
       and conname = 'lot_area_code_key'
  ) then
    alter table public.lot add constraint lot_area_code_key unique (area_id, lot_code);
  end if;
end
$$;

create index if not exists lot_area_id_idx on public.lot (area_id);

comment on column public.lot.area_id is
  'Direct garden/area parent for the site-area-plot hierarchy.';
comment on column public.lot.block_id is
  'Legacy compatibility link. New GraveNav plots use area_id directly because official blocks are not available.';

-- Keep the public view column shape stable while allowing direct area-linked
-- lots. The legacy joins remain as a fallback for older rows.
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
    coalesce(direct_area.area_name, legacy_area.area_name) as area_name,
    legacy_sector.sector_name,
    legacy_block.block_number
from public.burial_record as br
join public.deceased as d on d.deceased_id = br.deceased_id
join public.lot as l on l.lot_id = br.lot_id
left join public.area as direct_area on direct_area.area_id = l.area_id
left join public.block as legacy_block on legacy_block.block_id = l.block_id
left join public.sector as legacy_sector on legacy_sector.sector_id = legacy_block.sector_id
left join public.area as legacy_area on legacy_area.area_id = legacy_sector.area_id
where br.record_status = 'active'
  and d.public_display;

revoke all on public.public_burial_records from public;
grant select on public.public_burial_records to anon, authenticated;

commit;
