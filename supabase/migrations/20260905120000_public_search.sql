begin;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.search_normalize(value text) returns text
language sql immutable parallel safe set search_path = pg_catalog
as $$ select trim(regexp_replace(lower(coalesce(value, '')), '[^[:alnum:]]+', ' ', 'g')) $$;

create or replace function public.search_name_key(value text) returns text
language sql immutable parallel safe set search_path = pg_catalog
as $$ select coalesce(string_agg(word, ' ' order by word), '')
from regexp_split_to_table(public.search_normalize(value), ' +') word $$;

create index deceased_name_trgm_idx on public.deceased using gin
  (public.search_normalize(display_name) extensions.gin_trgm_ops) where public_display;
create index deceased_name_key_idx on public.deceased (public.search_name_key(display_name)) where public_display;
create index lot_search_code_idx on public.lot (replace(public.search_normalize(lot_code), ' ', ''));
create index burial_public_search_idx on public.burial_record (deceased_id, burial_id) where record_status = 'active';

-- Append the actual interment date without changing existing view columns.
create or replace view public.public_burial_records with (security_barrier = true) as
select br.burial_id, d.display_name, d.birth_date, d.death_date, br.record_status,
 l.lot_code, l.location_geom, l.px_loc_x, l.px_loc_y, l.coordinate_verified as location_verified,
 coalesce(a.area_name, la.area_name) as area_name, s.sector_name, b.block_number,
 br.interment_date
from public.burial_record br join public.deceased d using (deceased_id)
join public.lot l using (lot_id) left join public.area a on a.area_id = l.area_id
left join public.block b using (block_id) left join public.sector s using (sector_id)
left join public.area la on la.area_id = s.area_id
where br.record_status = 'active' and d.public_display;
revoke all on public.public_burial_records from public;
grant select on public.public_burial_records to anon, authenticated;

create or replace function public.search_public_burials(
 p_query text default '', p_section text default 'all', p_year text default 'any',
 p_sort text default 'name', p_page integer default 1, p_page_size integer default 20
) returns jsonb language plpgsql stable security definer
set search_path = public, extensions, pg_temp set pg_trgm.similarity_threshold = '0.3'
as $$
declare q text := public.search_normalize(left(coalesce(p_query, ''), 160));
 size integer := greatest(1, least(coalesce(p_page_size, 20), 50));
 page integer := greatest(1, least(coalesce(p_page, 1), 10000));
 result jsonb;
begin
 with candidates as (
 select v.*, case
   when q = '' then 1
   when public.search_name_key(v.display_name) = public.search_name_key(q)
     or replace(public.search_normalize(v.lot_code), ' ', '') = replace(q, ' ', '') then 0
   when not exists (select 1 from regexp_split_to_table(q, ' +') token
     where position(token in public.search_normalize(v.display_name)) = 0)
     or position(replace(q, ' ', '') in replace(public.search_normalize(v.lot_code), ' ', '')) > 0 then 1
   else 2 end as rank,
 extensions.similarity(public.search_normalize(v.display_name), q) as score
 from public.public_burial_records v
 where (coalesce(p_section, 'all') = 'all' or v.area_name = p_section)
 and (coalesce(p_year, 'any') = 'any'
   or (p_year = '1800-1899' and v.death_date >= date '1800-01-01' and v.death_date < date '1900-01-01')
   or (p_year = '1900-1999' and v.death_date >= date '1900-01-01' and v.death_date < date '2000-01-01')
   or (p_year = '2000-present' and v.death_date >= date '2000-01-01'))
 and (q = '' or public.search_normalize(v.display_name) operator(extensions.%) q
   or not exists (select 1 from regexp_split_to_table(q, ' +') token
     where position(token in public.search_normalize(v.display_name)) = 0)
   or position(replace(q, ' ', '') in replace(public.search_normalize(v.lot_code), ' ', '')) > 0)
 ), paged as (
 select *, case rank when 0 then 'exact' when 1 then 'matched' else 'similar' end as match_type
 from candidates order by rank,
 case when rank = 2 then score end desc,
 case when p_sort = 'newest' then death_date end desc nulls last,
 display_name, burial_id limit size offset (page - 1) * size
 ) select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(paged) - 'rank' - 'score') from paged), '[]'::jsonb),
 'total', (select count(*) from candidates), 'page', page, 'pageSize', size) into result;
 return result;
end $$;
revoke all on function public.search_public_burials(text,text,text,text,integer,integer) from public;
grant execute on function public.search_public_burials(text,text,text,text,integer,integer) to anon, authenticated;
commit;
