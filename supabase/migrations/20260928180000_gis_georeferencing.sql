begin;

-- M03: protected georeferencing attempts and independent validation evidence.
-- No release geometry, import, readiness, publication or public read surface.
create table public.georeferencing_run (
  run_id uuid primary key default pg_catalog.gen_random_uuid(),
  release_id uuid not null,
  site_id bigint not null,
  run_code text not null,
  source_reference text not null,
  source_hash text not null,
  source_width integer,
  source_height integer,
  source_coordinate_space text not null,
  working_srid integer not null,
  output_srid integer not null,
  method text not null,
  processing_parameters jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null,
  qgis_version text not null,
  operator_reference text,
  reviewer_reference text,
  output_artifact_reference text not null,
  output_artifact_hash text not null,
  review_state text not null default 'draft',
  revision integer not null default 1,
  notes text,
  review_notes text,
  created_at timestamptz not null default transaction_timestamp(),
  created_by uuid references public.account(account_id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.account(account_id) on delete set null,
  constraint georeferencing_run_release_code_key unique (release_id,run_code),
  constraint georeferencing_run_id_release_site_key unique (run_id,release_id,site_id),
  constraint georeferencing_run_release_site_fkey foreign key (release_id,site_id)
    references public.mapping_release(release_id,site_id) on delete restrict,
  constraint georeferencing_run_code_check check (length(run_code) between 1 and 100 and run_code ~ '^[A-Za-z0-9._:-]+$'),
  constraint georeferencing_run_hash_check check (source_hash ~ '^[0-9a-f]{64}$' and output_artifact_hash ~ '^[0-9a-f]{64}$'),
  constraint georeferencing_run_dimensions_check check (
    (source_width is null and source_height is null) or
    (source_width between 1 and 1000000 and source_height between 1 and 1000000)),
  constraint georeferencing_run_srid_check check (working_srid>0 and output_srid=4326),
  constraint georeferencing_run_review_state_check check (review_state in ('draft','accepted','rejected')),
  constraint georeferencing_run_revision_check check (revision>0),
  constraint georeferencing_run_text_check check (
    length(source_reference) between 1 and 1024 and btrim(source_reference)<>'' and
    length(source_coordinate_space) between 1 and 500 and btrim(source_coordinate_space)<>'' and
    length(method) between 1 and 200 and btrim(method)<>'' and
    length(qgis_version) between 1 and 100 and btrim(qgis_version)<>'' and
    length(output_artifact_reference) between 1 and 1024 and btrim(output_artifact_reference)<>'' and
    (operator_reference is null or length(operator_reference)<=500) and
    (reviewer_reference is null or length(reviewer_reference)<=500) and
    (notes is null or length(notes)<=2000) and
    (review_notes is null or length(review_notes)<=2000)),
  constraint georeferencing_run_parameters_check check (
    jsonb_typeof(processing_parameters)='object' and octet_length(processing_parameters::text)<=8192 and
    (not (processing_parameters ? 'expected_validation_count') or
      (jsonb_typeof(processing_parameters->'expected_validation_count')='number' and
       processing_parameters->>'expected_validation_count' ~ '^[1-9][0-9]{0,2}$' and
       (processing_parameters->>'expected_validation_count')::integer<=200)))
);

create table public.georeferencing_run_point (
  run_point_id uuid primary key default pg_catalog.gen_random_uuid(),
  run_id uuid not null,
  release_id uuid not null,
  site_id bigint not null,
  point_id uuid not null,
  capture_id uuid not null,
  role text not null,
  source_x numeric not null,
  source_y numeric not null,
  fitting_residual_m numeric,
  created_at timestamptz not null default transaction_timestamp(),
  constraint georeferencing_run_point_once_key unique (run_id,point_id),
  constraint georeferencing_run_point_id_run_key unique (run_point_id,run_id),
  constraint georeferencing_run_point_run_scope_fkey foreign key (run_id,release_id,site_id)
    references public.georeferencing_run(run_id,release_id,site_id) on delete restrict,
  constraint georeferencing_run_point_point_site_fkey foreign key (point_id,site_id)
    references public.survey_point(point_id,site_id) on delete restrict,
  constraint georeferencing_run_point_capture_fkey foreign key (capture_id,point_id,site_id)
    references public.survey_capture(capture_id,point_id,site_id) on delete restrict,
  constraint georeferencing_run_point_role_check check (role in ('FITTING','VALIDATION')),
  constraint georeferencing_run_point_coordinate_check check (
    source_x::text not in ('NaN','Infinity','-Infinity') and source_y::text not in ('NaN','Infinity','-Infinity') and
    source_x>=0 and source_y>=0),
  constraint georeferencing_run_point_residual_check check (
    fitting_residual_m is null or
    (role='FITTING' and fitting_residual_m::text not in ('NaN','Infinity','-Infinity') and fitting_residual_m>=0))
);

create table public.georeferencing_validation (
  run_point_id uuid primary key references public.georeferencing_run_point(run_point_id) on delete restrict,
  transformed_plan_point extensions.geometry(Point,4326) not null,
  review_state text not null default 'draft',
  revision integer not null default 1,
  notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.account(account_id) on delete set null,
  created_at timestamptz not null default transaction_timestamp(),
  constraint georeferencing_validation_state_check check (review_state in ('draft','reviewed','rejected')),
  constraint georeferencing_validation_revision_check check (revision>0),
  constraint georeferencing_validation_notes_check check (notes is null or length(notes)<=2000),
  constraint georeferencing_validation_review_check check (
    (review_state='draft' and reviewed_at is null and reviewed_by is null) or
    (review_state in ('reviewed','rejected') and reviewed_at is not null and reviewed_by is not null)),
  constraint georeferencing_validation_geometry_check check (
    extensions.st_srid(transformed_plan_point)=4326 and
    extensions.st_x(transformed_plan_point) between -180 and 180 and
    extensions.st_y(transformed_plan_point) between -90 and 90)
);

create index georeferencing_run_release_site_idx on public.georeferencing_run(release_id,site_id,review_state,run_id);
create index georeferencing_run_created_by_idx on public.georeferencing_run(created_by);
create index georeferencing_run_reviewed_by_idx on public.georeferencing_run(reviewed_by);
create index georeferencing_run_point_run_role_idx on public.georeferencing_run_point(run_id,role,run_point_id);
create index georeferencing_run_point_release_site_idx on public.georeferencing_run_point(release_id,site_id,run_id);
create index georeferencing_run_point_point_idx on public.georeferencing_run_point(point_id);
create index georeferencing_run_point_capture_idx on public.georeferencing_run_point(capture_id);
create index georeferencing_validation_reviewed_by_idx on public.georeferencing_validation(reviewed_by);
create index mapping_release_selected_run_idx on public.mapping_release(selected_run_id) where selected_run_id is not null;

alter table public.mapping_release add constraint mapping_release_selected_run_fkey
  foreign key (selected_run_id,release_id,site_id)
  references public.georeferencing_run(run_id,release_id,site_id) on delete restrict;

alter table public.georeferencing_run enable row level security;
alter table public.georeferencing_run_point enable row level security;
alter table public.georeferencing_validation enable row level security;
revoke all on public.georeferencing_run,public.georeferencing_run_point,public.georeferencing_validation
  from public,anon,authenticated,service_role;
grant select on public.georeferencing_run,public.georeferencing_run_point,public.georeferencing_validation to authenticated;
create policy georeferencing_run_admin_read on public.georeferencing_run for select to authenticated using (public.is_active_admin());
create policy georeferencing_run_point_admin_read on public.georeferencing_run_point for select to authenticated using (public.is_active_admin());
create policy georeferencing_validation_admin_read on public.georeferencing_validation for select to authenticated using (public.is_active_admin());

create function gis_private.georeferencing_operation(p_expected text) returns void
language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare owner_name name; pending_count integer; operation text;
begin
  select pg_get_userbyid(c.relowner) into owner_name from pg_class c where c.oid='public.georeferencing_run'::regclass;
  if current_user<>owner_name then raise exception 'Protected georeferencing owner operation required' using errcode='42501'; end if;
  perform gis_private.assert_admin();
  select count(*),min(q.operation) into pending_count,operation from gis_private.gis_mutation_request q
    where q.actor_account_id=auth.uid() and q.response is null and q.created_at=transaction_timestamp();
  if pending_count<>1 or operation<>p_expected then
    raise exception 'Protected pending georeferencing operation required' using errcode='42501';
  end if;
end $$;

create function gis_private.assert_metric_working_srid(p_srid integer) returns void
language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare wkt text; proj text;
begin
  -- Foundation policy allowlist. Additional projected metric CRSs require a
  -- separately reviewed migration; canonical calculations still use the stored field.
  if p_srid<>32651 then
    raise exception 'Working SRID is not in the approved projected metric CRS allowlist';
  end if;
  select coalesce(srtext,''),coalesce(proj4text,'') into wkt,proj
  from extensions.spatial_ref_sys where srid=p_srid;
  if wkt is null or not (
    upper(ltrim(wkt)) like 'PROJCRS[%' or upper(ltrim(wkt)) like 'PROJCS[%'
  ) or lower(proj) !~ '(^|[[:space:]])\+units=m([[:space:]]|$)' or lower(proj) ~ '\+proj=geocent' then
    raise exception 'Working SRID must be an installed projected metric CRS';
  end if;
end $$;

create function gis_private.guard_georeferencing_run() returns trigger
language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare release public.mapping_release; expected text;
begin
  if tg_op='DELETE' then raise exception 'Georeferencing runs are retained'; end if;
  expected:=case when tg_op='INSERT' or (tg_op='UPDATE' and new.review_state='draft')
    then 'staff_save_georeferencing_run' else 'staff_review_georeferencing_run' end;
  perform gis_private.georeferencing_operation(expected);
  select * into release from public.mapping_release where release_id=new.release_id for share;
  if not found or release.site_id<>new.site_id then raise exception 'Run release/site mismatch'; end if;
  if release.scope_kind='pilot' and (new.working_srid<>32651 or new.output_srid<>4326) then
    raise exception 'Pilot working/output SRIDs must be 32651 and 4326';
  end if;
  perform gis_private.assert_metric_working_srid(new.working_srid);
  if tg_op='INSERT' then
    if new.review_state<>'draft' or new.revision<>1 or new.created_by is distinct from auth.uid() then
      raise exception 'Invalid georeferencing run creation'; end if;
    return new;
  end if;
  if old.review_state in ('accepted','rejected') then raise exception 'Accepted or rejected georeferencing run is frozen'; end if;
  if (new.run_id,new.release_id,new.site_id,new.run_code,new.created_at,new.created_by)
    is distinct from (old.run_id,old.release_id,old.site_id,old.run_code,old.created_at,old.created_by) then
    raise exception 'Georeferencing run identity is immutable'; end if;
  if new.revision<>old.revision+1 then raise exception 'Invalid georeferencing run revision'; end if;
  if expected='staff_save_georeferencing_run' then
    if new.review_state<>'draft' or new.reviewed_at is not null or new.reviewed_by is not null then
      raise exception 'Save may only retain an unreviewed draft run'; end if;
  else
    if new.review_state not in ('accepted','rejected') or new.reviewed_at is null or new.reviewed_by is distinct from auth.uid() then
      raise exception 'Invalid georeferencing review transition'; end if;
  end if;
  return new;
end $$;

create function gis_private.guard_georeferencing_run_point() returns trigger
language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare run public.georeferencing_run; point public.survey_point; capture public.survey_capture; summary gis_private.survey_capture_summary;
begin
  perform gis_private.georeferencing_operation('staff_save_georeferencing_run');
  select * into run from public.georeferencing_run where run_id=coalesce(new.run_id,old.run_id) for update;
  if not found or run.review_state<>'draft' then raise exception 'Run membership is frozen outside draft'; end if;
  if tg_op='DELETE' then return old; end if;
  select * into point from public.survey_point where point_id=new.point_id for share;
  select * into capture from public.survey_capture where capture_id=new.capture_id for share;
  select * into summary from gis_private.survey_capture_summary where capture_id=new.capture_id;
  if not found or point.site_id<>run.site_id or capture.point_id<>point.point_id or capture.site_id<>run.site_id then
    raise exception 'Run membership point/capture/site mismatch'; end if;
  if capture.review_state<>'accepted' or summary.representative_point is null then
    raise exception 'Run membership requires an accepted frozen capture with a representative position'; end if;
  if (point.role='GCP' and new.role<>'FITTING') or (point.role='VALIDATION' and new.role<>'VALIDATION') then
    raise exception 'Survey point role and run membership role mismatch'; end if;
  if new.release_id<>run.release_id or new.site_id<>run.site_id then raise exception 'Run membership release/site mismatch'; end if;
  if run.source_width is not null and (new.source_x>=run.source_width or new.source_y>=run.source_height) then
    raise exception 'Source coordinate is outside declared raster dimensions'; end if;
  if tg_op='UPDATE' and (new.run_point_id,new.run_id,new.release_id,new.site_id,new.point_id,new.capture_id,new.role)
    is distinct from (old.run_point_id,old.run_id,old.release_id,old.site_id,old.point_id,old.capture_id,old.role) then
    raise exception 'Run membership identity and role are immutable'; end if;
  return new;
end $$;

create function gis_private.guard_georeferencing_validation() returns trigger
language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare membership public.georeferencing_run_point; run public.georeferencing_run;
begin
  perform gis_private.georeferencing_operation('staff_save_georeferencing_run');
  select * into membership from public.georeferencing_run_point where run_point_id=coalesce(new.run_point_id,old.run_point_id) for share;
  if not found or membership.role<>'VALIDATION' then raise exception 'Independent validation result requires a VALIDATION membership'; end if;
  select * into run from public.georeferencing_run where run_id=membership.run_id for update;
  if run.review_state<>'draft' then raise exception 'Validation result is frozen outside draft'; end if;
  if tg_op='DELETE' then return old; end if;
  if tg_op='INSERT' and (new.revision<>1 or (new.review_state<>'draft' and new.reviewed_by is distinct from auth.uid())) then
    raise exception 'Invalid validation result creation'; end if;
  if tg_op='UPDATE' and new.run_point_id<>old.run_point_id then raise exception 'Validation result identity is immutable'; end if;
  return new;
end $$;

create trigger georeferencing_run_guard before insert or update or delete on public.georeferencing_run
  for each row execute function gis_private.guard_georeferencing_run();
create trigger georeferencing_run_point_guard before insert or update or delete on public.georeferencing_run_point
  for each row execute function gis_private.guard_georeferencing_run_point();
create trigger georeferencing_validation_guard before insert or update or delete on public.georeferencing_validation
  for each row execute function gis_private.guard_georeferencing_validation();

create view gis_private.georeferencing_validation_result with (security_invoker=true) as
select rp.run_point_id,rp.run_id,rp.point_id,rp.capture_id,r.working_srid,
  s.representative_point observed_point_4326,4326 observed_srid,
  v.transformed_plan_point transformed_plan_point_4326,4326 transformed_plan_srid,
  v.review_state,v.revision,
  extensions.st_distance(
    extensions.st_transform(s.representative_point,r.working_srid),
    extensions.st_transform(v.transformed_plan_point,r.working_srid)
  ) validation_error_m
from public.georeferencing_run_point rp
join public.georeferencing_run r on r.run_id=rp.run_id
join public.georeferencing_validation v on v.run_point_id=rp.run_point_id
join gis_private.survey_capture_summary s on s.capture_id=rp.capture_id
where rp.role='VALIDATION';

create view gis_private.georeferencing_validation_summary with (security_invoker=true) as
select r.run_id,r.release_id,r.site_id,
  count(*) filter (where rp.role='FITTING')::integer fitting_point_count,
  count(*) filter (where rp.role='VALIDATION')::integer validation_point_count,
  case when r.processing_parameters ? 'expected_validation_count'
    then (r.processing_parameters->>'expected_validation_count')::integer end expected_validation_count,
  count(vr.run_point_id)::integer measured_validation_count,
  (count(*) filter (where rp.role='VALIDATION')-count(vr.run_point_id))::integer missing_validation_result_count,
  avg(vr.validation_error_m) average_validation_error_m,
  percentile_cont(0.5) within group (order by vr.validation_error_m) median_validation_error_m,
  max(vr.validation_error_m) maximum_validation_error_m,
  to_jsonb(array_remove(array[
    case when count(*) filter (where rp.role='FITTING')<12 then 'fitting_count_below_target' end,
    case when count(*) filter (where rp.role='FITTING')>15 then 'fitting_count_above_target' end,
    case when count(*) filter (where rp.role='VALIDATION')<3 then 'validation_count_below_target' end,
    case when count(*) filter (where rp.role='VALIDATION')>5 then 'validation_count_above_target' end,
    case when r.processing_parameters ? 'expected_validation_count' and
      count(*) filter (where rp.role='VALIDATION')<>(r.processing_parameters->>'expected_validation_count')::integer
      then 'expected_validation_count_mismatch' end,
    case when count(*) filter (where rp.role='VALIDATION')-count(vr.run_point_id)>0 then 'missing_validation_result' end,
    case when count(*) filter (where rp.role='VALIDATION' and v.review_state<>'reviewed')>0 then 'unreviewed_validation_result' end,
    case when bool_or(jsonb_array_length(coalesce(s.protocol_flags,'[]'::jsonb))>0) then 'capture_protocol_deviation' end
  ]::text[],null)) protocol_flags
from public.georeferencing_run r
left join public.georeferencing_run_point rp on rp.run_id=r.run_id
left join public.georeferencing_validation v on v.run_point_id=rp.run_point_id and rp.role='VALIDATION'
left join gis_private.georeferencing_validation_result vr on vr.run_point_id=v.run_point_id and v.review_state='reviewed'
left join gis_private.survey_capture_summary s on s.capture_id=rp.capture_id
group by r.run_id,r.release_id,r.site_id,r.processing_parameters;

revoke all on gis_private.georeferencing_validation_result,gis_private.georeferencing_validation_summary
  from public,anon,authenticated,service_role;

create function gis_private.audit_georeferencing(p_id uuid,p_action text,p_old jsonb,p_new jsonb) returns void
language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare safe_old jsonb; safe_new jsonb;
begin
  perform gis_private.assert_admin();
  if p_action not in ('insert','update','status_change') then raise exception 'Invalid georeferencing audit action'; end if;
  select jsonb_object_agg(key,value) into safe_old from jsonb_each(coalesce(p_old,'{}'::jsonb))
    where key=any(array['schemaVersion','id','revision','state','requestId','siteId','releaseId','count'])
      and jsonb_typeof(value) in ('string','number','null') and octet_length(value::text)<=200;
  select jsonb_object_agg(key,value) into safe_new from jsonb_each(coalesce(p_new,'{}'::jsonb))
    where key=any(array['schemaVersion','id','revision','state','requestId','siteId','releaseId','count'])
      and jsonb_typeof(value) in ('string','number','null') and octet_length(value::text)<=200;
  insert into public.audit_log(actor_account_id,action,table_name,record_id,old_values,new_values)
    values(auth.uid(),p_action,'georeferencing_run',p_id::text,safe_old,safe_new);
end $$;

-- M01's release guard gains one narrow same-release selected-run operation.
-- It does not change release lifecycle state or revision and remains receipt-bound.
create or replace function gis_private.guard_release() returns trigger language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare operation text; owner_name name; pending_count integer; required_operation text; selected_state text;
begin
  if tg_op='DELETE' then raise exception 'Release snapshots are retained; protected deletion is unavailable'; end if;
  select pg_get_userbyid(relowner) into owner_name from pg_class where oid=tg_relid;
  if current_user<>owner_name then raise exception 'A protected owner operation is required' using errcode='42501'; end if;
  select count(*),min(q.operation) into pending_count,operation from gis_private.gis_mutation_request q
    where q.actor_account_id=auth.uid() and q.response is null and q.created_at=transaction_timestamp();
  if pending_count<>1 then raise exception 'A protected pending operation is required' using errcode='42501'; end if;
  perform gis_private.assert_admin();
  if tg_op='INSERT' then
    if operation<>'staff_create_mapping_release' or new.status<>'draft' or new.revision<>1 or new.created_by is distinct from auth.uid() then
      raise exception 'Invalid creation operation or initial lifecycle state'; end if;
    if new.scope_kind='pilot' then
      perform 1 from public.area where area_id=new.pilot_area_id and site_id=new.site_id for share;
      if not found then raise exception 'Pilot area must belong to release site'; end if;
    end if;
    return new;
  end if;
  if operation='staff_review_georeferencing_run' and old.status='draft' and new.status=old.status and new.revision=old.revision and
    (to_jsonb(new)-'selected_run_id')=(to_jsonb(old)-'selected_run_id') and new.selected_run_id is not null then
    select review_state into selected_state from public.georeferencing_run
      where run_id=new.selected_run_id and release_id=new.release_id and site_id=new.site_id for share;
    if selected_state<>'accepted' then raise exception 'Selected georeferencing run must be accepted for this release/site'; end if;
    return new;
  end if;
  if old.status='rejected' then raise exception 'Rejected releases are terminal'; end if;
  if new.revision<>old.revision+1 then raise exception 'Mutation must increment revision exactly once'; end if;
  if (new.release_id,new.site_id,new.scope_kind,new.pilot_area_id,new.release_code,new.created_at,new.created_by)
    is distinct from (old.release_id,old.site_id,old.scope_kind,old.pilot_area_id,old.release_code,old.created_at,old.created_by) then
    raise exception 'Release scope and identity are frozen';
  end if;
  required_operation:=case
    when old.status in ('draft','staged','validated') and new.status='staged' then 'staff_seal_mapping_import'
    when old.status='staged' and new.status='validated' then 'staff_finalize_mapping_import'
    when old.status='validated' and new.status='approved' then 'staff_review_mapping_release'
    when old.status='approved' and new.status='published' then 'staff_publish_mapping_release'
    when old.status='published' and new.status='superseded' then 'activate_release'
    when old.status in ('draft','staged','validated','approved') and new.status='rejected' then 'staff_reject_mapping_release'
    when old.status='superseded' and new.status='published' then 'staff_rollback_mapping_release'
    else null end;
  if required_operation is null or not (
    (required_operation<>'activate_release' and operation=required_operation) or
    (required_operation='activate_release' and operation in ('staff_publish_mapping_release','staff_rollback_mapping_release')) or
    (new.status='rejected' and old.status in ('draft','staged','validated','approved') and operation='staff_review_mapping_release')
  ) then raise exception 'Forbidden lifecycle transition or owning operation'; end if;
  if old.status in ('approved','published','superseded') and
    (to_jsonb(new)-array['status','revision','published_at','published_by','rejection_reason']) is distinct from
    (to_jsonb(old)-array['status','revision','published_at','published_by','rejection_reason']) then
    raise exception 'Approved snapshot content is frozen';
  end if;
  if old.status='superseded' and new.status='published' and old.published_at is null then
    raise exception 'Rollback requires a previously published snapshot'; end if;
  if new.status='rejected' then
    if new.rejection_reason is null or btrim(new.rejection_reason)='' then raise exception 'Rejection reason is required'; end if;
  else
    perform gis_private.assert_pilot_scope(old.release_id);
    if new.package_reference is null or new.package_hash is null or new.source_plan_reference is null or
      new.source_plan_version is null or new.source_plan_hash is null or new.source_coordinate_space is null or new.qgis_version is null then
      raise exception 'Complete package metadata is required after draft';
    end if;
  end if;
  if new.status='staged' then
    new.selected_run_id:=null; new.validation_report_hash:=null; new.validation_summary:=null;
    new.validated_at:=null; new.validated_by:=null; new.reviewed_at:=null; new.reviewed_by:=null;
  end if;
  return new;
end $$;

create function public.staff_save_georeferencing_run(
  p_run_id uuid,p_expected_revision integer,p_values jsonb,p_memberships jsonb,p_results jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,extensions,pg_temp as $$
declare input jsonb; prior jsonb; result jsonb; release public.mapping_release; run public.georeferencing_run;
  new_id uuid; membership jsonb; validation jsonb; member_id uuid; k text; item jsonb;
  release_uuid uuid; site_bigint bigint; state text; lon numeric; lat numeric;
begin
  perform gis_private.assert_admin();
  if p_values is null or jsonb_typeof(p_values)<>'object' or p_memberships is null or jsonb_typeof(p_memberships)<>'array' or
    p_results is null or jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_memberships)>4000 or
    jsonb_array_length(p_results)>4000 or octet_length(p_values::text)+octet_length(p_memberships::text)+
    octet_length(p_results::text)+256>1048576 then raise exception 'Invalid bounded georeferencing run request'; end if;
  for k,item in select key,value from jsonb_each(p_values) loop
    if k not in ('release_id','run_code','source_reference','source_hash','source_width','source_height',
      'source_coordinate_space','working_srid','output_srid','method','processing_parameters','processed_at',
      'qgis_version','operator_reference','output_artifact_reference','output_artifact_hash','notes') then
      raise exception 'Unsupported georeferencing metadata key: %',k; end if;
  end loop;
  if p_run_id is null then
    if p_expected_revision is not null or not (p_values ?& array['release_id','run_code','source_reference','source_hash',
      'source_coordinate_space','working_srid','output_srid','method','processing_parameters','processed_at','qgis_version',
      'output_artifact_reference','output_artifact_hash']) then raise exception 'Complete run metadata and null revision required'; end if;
  elsif p_expected_revision is null or p_expected_revision<1 or p_values ?| array['release_id','run_code'] then
    raise exception 'Run update requires revision and immutable identity';
  end if;
  if (p_values ? 'release_id' and jsonb_typeof(p_values->'release_id')<>'string') or
    (p_values ? 'run_code' and jsonb_typeof(p_values->'run_code')<>'string') or
    (p_values ? 'source_reference' and jsonb_typeof(p_values->'source_reference')<>'string') or
    (p_values ? 'source_hash' and jsonb_typeof(p_values->'source_hash')<>'string') or
    (p_values ? 'source_coordinate_space' and jsonb_typeof(p_values->'source_coordinate_space')<>'string') or
    (p_values ? 'working_srid' and jsonb_typeof(p_values->'working_srid')<>'number') or
    (p_values ? 'output_srid' and jsonb_typeof(p_values->'output_srid')<>'number') or
    (p_values ? 'source_width' and p_values->'source_width'<>'null'::jsonb and jsonb_typeof(p_values->'source_width')<>'number') or
    (p_values ? 'source_height' and p_values->'source_height'<>'null'::jsonb and jsonb_typeof(p_values->'source_height')<>'number') or
    (p_values ? 'method' and jsonb_typeof(p_values->'method')<>'string') or
    (p_values ? 'processing_parameters' and jsonb_typeof(p_values->'processing_parameters')<>'object') or
    (p_values ? 'processed_at' and jsonb_typeof(p_values->'processed_at')<>'string') or
    (p_values ? 'qgis_version' and jsonb_typeof(p_values->'qgis_version')<>'string') or
    (p_values ? 'output_artifact_reference' and jsonb_typeof(p_values->'output_artifact_reference')<>'string') or
    (p_values ? 'output_artifact_hash' and jsonb_typeof(p_values->'output_artifact_hash')<>'string') then
    raise exception 'Invalid georeferencing metadata types';
  end if;
  input:=jsonb_build_object('runId',p_run_id::text,'expectedRevision',p_expected_revision,'values',p_values,
    'memberships',p_memberships,'results',p_results);
  prior:=gis_private.claim_request(p_request_id,'staff_save_georeferencing_run',input);
  if prior is not null then return prior; end if;

  if p_run_id is null then
    release_uuid:=(p_values->>'release_id')::uuid;
    select * into release from public.mapping_release where release_id=release_uuid for share;
    if not found or release.status<>'draft' then raise exception 'Draft mapping release required'; end if;
    site_bigint:=release.site_id;
    insert into public.georeferencing_run(release_id,site_id,run_code,source_reference,source_hash,source_width,source_height,
      source_coordinate_space,working_srid,output_srid,method,processing_parameters,processed_at,qgis_version,
      operator_reference,reviewer_reference,output_artifact_reference,output_artifact_hash,notes,created_by)
    values(release_uuid,site_bigint,p_values->>'run_code',p_values->>'source_reference',p_values->>'source_hash',
      (p_values->>'source_width')::integer,(p_values->>'source_height')::integer,p_values->>'source_coordinate_space',
      (p_values->>'working_srid')::integer,(p_values->>'output_srid')::integer,p_values->>'method',p_values->'processing_parameters',
      (p_values->>'processed_at')::timestamptz,p_values->>'qgis_version',p_values->>'operator_reference',
      null,p_values->>'output_artifact_reference',p_values->>'output_artifact_hash',p_values->>'notes',auth.uid())
    returning run_id into new_id;
  else
    select * into run from public.georeferencing_run where run_id=p_run_id for update;
    if not found then raise exception 'Georeferencing run not found'; end if;
    if run.review_state<>'draft' then raise exception 'Accepted or rejected georeferencing run is frozen'; end if;
    if run.revision<>p_expected_revision then raise exception 'Stale georeferencing run revision' using errcode='40001'; end if;
    new_id:=run.run_id; release_uuid:=run.release_id; site_bigint:=run.site_id;
    update public.georeferencing_run set
      source_reference=coalesce(p_values->>'source_reference',source_reference),source_hash=coalesce(p_values->>'source_hash',source_hash),
      source_width=case when p_values ? 'source_width' then (p_values->>'source_width')::integer else source_width end,
      source_height=case when p_values ? 'source_height' then (p_values->>'source_height')::integer else source_height end,
      source_coordinate_space=coalesce(p_values->>'source_coordinate_space',source_coordinate_space),
      working_srid=coalesce((p_values->>'working_srid')::integer,working_srid),output_srid=coalesce((p_values->>'output_srid')::integer,output_srid),
      method=coalesce(p_values->>'method',method),processing_parameters=coalesce(p_values->'processing_parameters',processing_parameters),
      processed_at=coalesce((p_values->>'processed_at')::timestamptz,processed_at),qgis_version=coalesce(p_values->>'qgis_version',qgis_version),
      operator_reference=case when p_values ? 'operator_reference' then p_values->>'operator_reference' else operator_reference end,
      output_artifact_reference=coalesce(p_values->>'output_artifact_reference',output_artifact_reference),
      output_artifact_hash=coalesce(p_values->>'output_artifact_hash',output_artifact_hash),
      notes=case when p_values ? 'notes' then p_values->>'notes' else notes end,revision=revision+1
      where run_id=p_run_id;
    delete from public.georeferencing_validation where run_point_id in
      (select run_point_id from public.georeferencing_run_point where run_id=p_run_id);
    delete from public.georeferencing_run_point where run_id=p_run_id;
  end if;

  for membership in select value from jsonb_array_elements(p_memberships) loop
    if jsonb_typeof(membership)<>'object' or membership-
      array['point_id','capture_id','role','source_x','source_y','fitting_residual_m']<>'{}'::jsonb or
      not (membership ?& array['point_id','capture_id','role','source_x','source_y']) or
      jsonb_typeof(membership->'point_id')<>'string' or jsonb_typeof(membership->'capture_id')<>'string' or
      jsonb_typeof(membership->'role')<>'string' or jsonb_typeof(membership->'source_x')<>'number' or
      jsonb_typeof(membership->'source_y')<>'number' or
      (membership ? 'fitting_residual_m' and membership->'fitting_residual_m'<>'null'::jsonb and
        jsonb_typeof(membership->'fitting_residual_m')<>'number') then
      raise exception 'Invalid run membership or source coordinate shape'; end if;
    insert into public.georeferencing_run_point(run_id,release_id,site_id,point_id,capture_id,role,source_x,source_y,fitting_residual_m)
    values(new_id,release_uuid,site_bigint,(membership->>'point_id')::uuid,(membership->>'capture_id')::uuid,
      membership->>'role',(membership->>'source_x')::numeric,(membership->>'source_y')::numeric,
      (membership->>'fitting_residual_m')::numeric);
  end loop;
  for validation in select value from jsonb_array_elements(p_results) loop
    if jsonb_typeof(validation)<>'object' or validation-
      array['point_id','transformed_longitude','transformed_latitude','review_state','notes']<>'{}'::jsonb or
      not (validation ?& array['point_id','transformed_longitude','transformed_latitude','review_state']) or
      jsonb_typeof(validation->'point_id')<>'string' or jsonb_typeof(validation->'transformed_longitude')<>'number' or
      jsonb_typeof(validation->'transformed_latitude')<>'number' or jsonb_typeof(validation->'review_state')<>'string' or
      (validation ? 'notes' and validation->'notes'<>'null'::jsonb and jsonb_typeof(validation->'notes')<>'string') then
      raise exception 'Invalid independent validation result shape'; end if;
    lon:=(validation->>'transformed_longitude')::numeric; lat:=(validation->>'transformed_latitude')::numeric;
    if lon::text in ('NaN','Infinity','-Infinity') or lat::text in ('NaN','Infinity','-Infinity') or
      lon not between -180 and 180 or lat not between -90 and 90 then raise exception 'Invalid finite transformed plan position'; end if;
    select run_point_id into member_id from public.georeferencing_run_point
      where run_id=new_id and point_id=(validation->>'point_id')::uuid and role='VALIDATION';
    if member_id is null then raise exception 'Validation result requires a matching VALIDATION membership'; end if;
    state:=validation->>'review_state';
    if state not in ('draft','reviewed','rejected') then raise exception 'Invalid validation result review state'; end if;
    insert into public.georeferencing_validation(run_point_id,transformed_plan_point,review_state,notes,reviewed_at,reviewed_by)
    values(member_id,extensions.st_setsrid(extensions.st_makepoint(lon,lat),4326),state,validation->>'notes',
      case when state='draft' then null else transaction_timestamp() end,case when state='draft' then null else auth.uid() end);
  end loop;

  select * into run from public.georeferencing_run where run_id=new_id;
  result:=jsonb_build_object('schemaVersion',1,'id',new_id::text,'revision',run.revision,'state','draft','requestId',p_request_id::text);
  perform gis_private.audit_georeferencing(new_id,case when p_run_id is null then 'insert' else 'update' end,null,
    result||jsonb_build_object('siteId',site_bigint::text,'releaseId',release_uuid::text,'count',jsonb_array_length(p_memberships)));
  perform gis_private.finish_request(p_request_id,result);
  return result;
end $$;

create function public.staff_review_georeferencing_run(
  p_run_id uuid,p_expected_revision integer,p_decision text,p_acknowledgements jsonb,p_notes text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,extensions,pg_temp as $$
declare run public.georeferencing_run; summary gis_private.georeferencing_validation_summary;
  prior jsonb; result jsonb; required_flags jsonb;
begin
  perform gis_private.assert_admin();
  if p_run_id is null or p_expected_revision is null or p_expected_revision<1 or p_decision not in ('accepted','rejected') or
    p_acknowledgements is null or jsonb_typeof(p_acknowledgements)<>'array' or jsonb_array_length(p_acknowledgements)>20 or
    length(p_notes)>2000 or octet_length(p_acknowledgements::text)+octet_length(coalesce(p_notes,''))+256>1048576 then
    raise exception 'Invalid bounded georeferencing review'; end if;
  prior:=gis_private.claim_request(p_request_id,'staff_review_georeferencing_run',jsonb_build_object(
    'runId',p_run_id::text,'expectedRevision',p_expected_revision,'decision',p_decision,
    'acknowledgements',p_acknowledgements,'notes',p_notes));
  if prior is not null then return prior; end if;
  select * into run from public.georeferencing_run where run_id=p_run_id for update;
  if not found then raise exception 'Georeferencing run not found'; end if;
  if run.review_state<>'draft' then raise exception 'Accepted or rejected georeferencing run is frozen'; end if;
  if run.revision<>p_expected_revision then raise exception 'Stale georeferencing run revision' using errcode='40001'; end if;
  perform 1 from public.mapping_release where release_id=run.release_id and status='draft' for update;
  if not found then raise exception 'Georeferencing review requires a draft mapping release'; end if;
  select * into summary from gis_private.georeferencing_validation_summary where run_id=p_run_id;
  if p_decision='accepted' then
    if summary.validation_point_count<1 or summary.measured_validation_count<1 or summary.missing_validation_result_count>0 then
      raise exception 'Acceptance requires complete independent validation results'; end if;
    required_flags:=summary.protocol_flags-'missing_validation_result'-'unreviewed_validation_result';
    if exists (select 1 from jsonb_array_elements_text(required_flags) flag where not p_acknowledgements ? flag) then
      raise exception 'Protocol and target-count deviations require explicit acknowledgement'; end if;
  end if;
  update public.georeferencing_run set review_state=p_decision,revision=revision+1,review_notes=p_notes,
    reviewed_at=transaction_timestamp(),reviewed_by=auth.uid(),reviewer_reference=coalesce(reviewer_reference,auth.uid()::text)
    where run_id=p_run_id;
  if p_decision='accepted' then
    update public.mapping_release set selected_run_id=p_run_id where release_id=run.release_id;
  end if;
  result:=jsonb_build_object('schemaVersion',1,'id',p_run_id::text,'revision',run.revision+1,'state',p_decision,'requestId',p_request_id::text,
    'count',coalesce(summary.measured_validation_count,0));
  perform gis_private.audit_georeferencing(p_run_id,'status_change',
    jsonb_build_object('schemaVersion',1,'id',p_run_id::text,'revision',run.revision,'state',run.review_state),
    result||jsonb_build_object('siteId',run.site_id::text,'releaseId',run.release_id::text));
  perform gis_private.finish_request(p_request_id,result);
  return result;
end $$;

revoke all on all functions in schema gis_private from public,anon,authenticated,service_role;
revoke all on function public.staff_save_georeferencing_run(uuid,integer,jsonb,jsonb,jsonb,uuid),
  public.staff_review_georeferencing_run(uuid,integer,text,jsonb,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.staff_save_georeferencing_run(uuid,integer,jsonb,jsonb,jsonb,uuid),
  public.staff_review_georeferencing_run(uuid,integer,text,jsonb,text,uuid) to authenticated;

commit;
