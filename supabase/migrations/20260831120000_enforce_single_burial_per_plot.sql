-- GraveNav treats a plot as a single-occupancy gravesite.
-- This migration is intentionally not applied by this task.

begin;

do $$
begin
  if exists (
    select 1
      from public.burial_record
     group by lot_id
    having count(*) > 1
  ) then
    raise exception 'Cannot enforce single-occupancy plots while duplicate burial records exist';
  end if;
end;
$$;

create unique index if not exists burial_record_single_plot_key
  on public.burial_record (lot_id);

comment on index public.burial_record_single_plot_key is
  'GraveNav application policy: one burial record per plot.';

commit;
