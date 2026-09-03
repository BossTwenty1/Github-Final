-- Safety guard for the site -> garden/area -> plot hierarchy.
-- This migration must be applied through the project's approved migration
-- process in each environment.

begin;

set search_path = public, extensions, pg_temp;

create or replace function public.validate_lot_coordinate_in_area()
returns trigger
language plpgsql
security invoker
set search_path = public, extensions, pg_temp
as $$
declare
    selected_area_boundary extensions.geography;
begin
    if new.location_geom is null then
        return new;
    end if;

    select a.boundary_geom
      into selected_area_boundary
      from public.area as a
     where a.area_id = new.area_id;

    if selected_area_boundary is null then
        raise exception using
            errcode = 'check_violation',
            message = 'The selected garden has no boundary, so this plot coordinate cannot be validated.';
    end if;

    if not st_covers(selected_area_boundary, new.location_geom) then
        raise exception using
            errcode = 'check_violation',
            message = 'The plot coordinate is outside the selected garden boundary.';
    end if;

    return new;
end;
$$;

drop trigger if exists lot_coordinate_area_validation on public.lot;
create trigger lot_coordinate_area_validation
before insert or update of area_id, location_geom, coordinate_status, coordinate_verified
on public.lot
for each row
execute function public.validate_lot_coordinate_in_area();

comment on function public.validate_lot_coordinate_in_area() is
    'Rejects plot GPS coordinates outside the selected garden boundary.';

commit;
