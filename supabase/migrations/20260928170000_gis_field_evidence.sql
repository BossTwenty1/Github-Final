begin;

-- M02: immutable, private GNSS field evidence. No run, geometry release, or public read surface.
create table public.survey_point (
  point_id uuid primary key default pg_catalog.gen_random_uuid(),
  site_id bigint not null references public.site(site_id) on delete restrict,
  point_code text not null,
  role text not null check (role in ('GCP','VALIDATION')),
  description text,
  source_plan_reference text,
  notes text,
  active boolean not null default true,
  review_state text not null default 'draft' check (review_state in ('draft','accepted','rejected','retired')),
  revision integer not null default 1 check (revision > 0),
  predecessor_point_id uuid,
  created_at timestamptz not null default transaction_timestamp(),
  created_by uuid references public.account(account_id) on delete set null,
  updated_at timestamptz not null default transaction_timestamp(),
  updated_by uuid references public.account(account_id) on delete set null,
  constraint survey_point_site_code_key unique (site_id,point_code),
  constraint survey_point_id_site_key unique (point_id,site_id),
  constraint survey_point_predecessor_fkey foreign key (predecessor_point_id) references public.survey_point(point_id) on delete restrict,
  constraint survey_point_code_check check (length(point_code) between 1 and 100 and point_code ~ '^[A-Za-z0-9._:-]+$'),
  constraint survey_point_text_check check (
    (description is null or length(description)<=2000) and
    (notes is null or length(notes)<=2000) and
    (source_plan_reference is null or (length(source_plan_reference) between 1 and 1024 and btrim(source_plan_reference)<>''))),
  constraint survey_point_retired_check check (review_state<>'retired' or active=false),
  constraint survey_point_no_self_check check (predecessor_point_id is null or predecessor_point_id<>point_id)
);
create index survey_point_predecessor_idx on public.survey_point(predecessor_point_id);
create index survey_point_site_role_idx on public.survey_point(site_id,role,review_state,point_id);
create index survey_point_created_by_idx on public.survey_point(created_by);
create index survey_point_updated_by_idx on public.survey_point(updated_by);

create table public.survey_capture (
  capture_id uuid primary key default pg_catalog.gen_random_uuid(),
  point_id uuid not null,
  site_id bigint not null,
  capture_code text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  device_reference text,
  operator_reference text,
  notes text,
  remeasures_capture_id uuid,
  remeasure_required boolean not null default false,
  review_state text not null default 'draft' check (review_state in ('draft','accepted','rejected')),
  review_reason text,
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references public.account(account_id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.account(account_id) on delete set null,
  constraint survey_capture_point_code_key unique (point_id,capture_code),
  constraint survey_capture_id_point_site_key unique (capture_id,point_id,site_id),
  constraint survey_capture_point_site_fkey foreign key (point_id,site_id) references public.survey_point(point_id,site_id) on delete restrict,
  constraint survey_capture_parent_fkey foreign key (remeasures_capture_id,point_id,site_id)
    references public.survey_capture(capture_id,point_id,site_id) on delete restrict,
  constraint survey_capture_code_check check (length(capture_code) between 1 and 100 and capture_code ~ '^[A-Za-z0-9._:-]+$'),
  constraint survey_capture_time_check check (ended_at is null or ended_at>=started_at),
  constraint survey_capture_text_check check (
    (device_reference is null or length(device_reference)<=500) and
    (operator_reference is null or length(operator_reference)<=500) and
    (notes is null or length(notes)<=2000) and
    (review_reason is null or length(review_reason)<=2000)),
  constraint survey_capture_no_self_check check (remeasures_capture_id is null or remeasures_capture_id<>capture_id)
);
create index survey_capture_site_point_idx on public.survey_capture(site_id,point_id,created_at,capture_id);
create index survey_capture_parent_idx on public.survey_capture(remeasures_capture_id);
create index survey_capture_created_by_idx on public.survey_capture(created_by);
create index survey_capture_reviewed_by_idx on public.survey_capture(reviewed_by);

create table public.survey_observation (
  observation_id uuid primary key default pg_catalog.gen_random_uuid(),
  capture_id uuid not null references public.survey_capture(capture_id) on delete restrict,
  observation_order integer not null check (observation_order > 0),
  latitude numeric not null,
  longitude numeric not null,
  reported_accuracy_m numeric not null,
  captured_at timestamptz not null,
  notes text,
  created_at timestamptz not null default transaction_timestamp(),
  constraint survey_observation_capture_order_key unique (capture_id,observation_order),
  constraint survey_observation_latitude_check check (latitude::text not in ('NaN','Infinity','-Infinity') and latitude between -90 and 90),
  constraint survey_observation_longitude_check check (longitude::text not in ('NaN','Infinity','-Infinity') and longitude between -180 and 180),
  constraint survey_observation_accuracy_check check (reported_accuracy_m::text not in ('NaN','Infinity','-Infinity') and reported_accuracy_m>=0),
  constraint survey_observation_notes_check check (notes is null or length(notes)<=2000)
);

alter table public.survey_point enable row level security;
alter table public.survey_capture enable row level security;
alter table public.survey_observation enable row level security;
revoke all on public.survey_point, public.survey_capture, public.survey_observation from public,anon,authenticated,service_role;
grant select on public.survey_point, public.survey_capture, public.survey_observation to authenticated;
create policy survey_point_admin_read on public.survey_point for select to authenticated using (public.is_active_admin());
create policy survey_capture_admin_read on public.survey_capture for select to authenticated using (public.is_active_admin());
create policy survey_observation_admin_read on public.survey_observation for select to authenticated using (public.is_active_admin());

-- M01 receipts already constrain response shape; extend the state enum without removing its bounds.
alter table gis_private.gis_mutation_request drop constraint gis_request_response_check;
alter table gis_private.gis_mutation_request add constraint gis_request_response_check check (response is null or (
  jsonb_typeof(response)='object' and octet_length(response::text)<=8192 and
  response - array['schemaVersion','id','revision','state','requestId','count','digest']='{}'::jsonb and
  response ?& array['schemaVersion','id','revision','state','requestId'] and
  response->'schemaVersion'='1'::jsonb and jsonb_typeof(response->'id')='string' and
  length(response->>'id') between 1 and 100 and
  jsonb_typeof(response->'revision')='number' and response->>'revision' ~ '^[1-9][0-9]{0,9}$' and
  (response->>'revision')::numeric<=2147483647 and jsonb_typeof(response->'state')='string' and
  response->>'state' in ('draft','staged','validated','approved','published','superseded','rejected','accepted','retired') and
  jsonb_typeof(response->'requestId')='string' and response->>'requestId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and
  (not (response ? 'count') or (jsonb_typeof(response->'count')='number' and response->>'count' ~ '^[0-9]{1,9}$')) and
  (not (response ? 'digest') or (jsonb_typeof(response->'digest')='string' and response->>'digest' ~ '^[0-9a-f]{64}$'))));

create function gis_private.evidence_operation(p_expected text) returns void language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare owner_name name; pending_count integer; operation text;
begin
  select pg_get_userbyid(c.relowner) into owner_name from pg_class c where c.oid='public.survey_point'::regclass;
  if current_user<>owner_name then raise exception 'Protected evidence owner operation required' using errcode='42501'; end if;
  perform gis_private.assert_admin();
  select count(*),min(q.operation) into pending_count,operation from gis_private.gis_mutation_request q
    where q.actor_account_id=auth.uid() and q.response is null and q.created_at=transaction_timestamp();
  if pending_count<>1 or operation<>p_expected then raise exception 'Protected pending evidence operation required' using errcode='42501'; end if;
end $$;

create function gis_private.guard_survey_point() returns trigger language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare predecessor public.survey_point;
begin
  if tg_op='DELETE' then raise exception 'Survey points are retained; retire instead'; end if;
  perform gis_private.evidence_operation('staff_save_survey_point');
  if tg_op='INSERT' then
    if new.review_state<>'draft' or new.revision<>1 or new.created_by is distinct from auth.uid() or
      new.updated_by is distinct from auth.uid() then raise exception 'Invalid survey point creation'; end if;
    if new.predecessor_point_id is not null then
      select * into predecessor from public.survey_point where point_id=new.predecessor_point_id for share;
      if not found or predecessor.site_id<>new.site_id or predecessor.role<>new.role or predecessor.review_state<>'retired' then
        raise exception 'Predecessor must be a retired point of the same site and role'; end if;
    end if;
    return new;
  end if;
  if old.review_state='retired' then raise exception 'Retired survey points are terminal'; end if;
  if (new.point_id,new.site_id,new.point_code,new.role,new.predecessor_point_id,new.created_at,new.created_by)
    is distinct from (old.point_id,old.site_id,old.point_code,old.role,old.predecessor_point_id,old.created_at,old.created_by) then
    raise exception 'Survey point identity, role and lineage are immutable'; end if;
  if new.revision<>old.revision+1 or new.updated_by is distinct from auth.uid() then raise exception 'Invalid survey point revision or actor'; end if;
  if old.review_state='accepted' and new.review_state not in ('accepted','retired') then raise exception 'Accepted point cannot be reopened'; end if;
  if new.review_state='retired' then new.active:=false; end if;
  return new;
end $$;

create function gis_private.guard_survey_capture() returns trigger language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare parent public.survey_capture;
begin
  if tg_op='DELETE' then raise exception 'Survey captures are retained'; end if;
  if tg_op='INSERT' then
    perform gis_private.evidence_operation('staff_record_survey_capture');
    if new.review_state<>'draft' or new.revision<>1 or new.created_by is distinct from auth.uid() then
      raise exception 'Invalid survey capture creation'; end if;
    if new.remeasures_capture_id is not null then
      if new.remeasures_capture_id=new.capture_id then raise exception 'Remeasure parent cannot reference itself'; end if;
      select * into parent from public.survey_capture where capture_id=new.remeasures_capture_id for share;
      if not found or parent.point_id<>new.point_id or parent.site_id<>new.site_id or parent.created_at>=new.created_at then
        raise exception 'Remeasure parent must exist, be older, and share point/site'; end if;
      -- Parent links are immutable and only existing rows can be parents: no cycle can form.
    end if;
    return new;
  end if;
  perform gis_private.evidence_operation('staff_review_survey_capture');
  if new.remeasures_capture_id is distinct from old.remeasures_capture_id then
    raise exception 'Remeasure parent lineage is immutable; cyclic changes are rejected'; end if;
  if old.review_state<>'draft' or new.review_state not in ('accepted','rejected') or new.revision<>old.revision+1 then
    raise exception 'Accepted or rejected capture is frozen'; end if;
  if (new.capture_id,new.point_id,new.site_id,new.capture_code,new.started_at,new.ended_at,new.device_reference,
      new.operator_reference,new.notes,new.remeasures_capture_id,new.remeasure_required,new.created_at,new.created_by)
     is distinct from (old.capture_id,old.point_id,old.site_id,old.capture_code,old.started_at,old.ended_at,old.device_reference,
      old.operator_reference,old.notes,old.remeasures_capture_id,old.remeasure_required,old.created_at,old.created_by) then
    raise exception 'Survey capture measurement metadata is immutable'; end if;
  if new.reviewed_by is distinct from auth.uid() or new.reviewed_at is null then raise exception 'Review actor/time required'; end if;
  return new;
end $$;

create function gis_private.guard_survey_observation() returns trigger language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare capture_state text;
begin
  if tg_op<>'INSERT' then raise exception 'Survey observations are append-only and immutable'; end if;
  perform gis_private.evidence_operation('staff_record_survey_capture');
  select review_state into capture_state from public.survey_capture where capture_id=new.capture_id for update;
  if capture_state is null or capture_state<>'draft' then raise exception 'Accepted or rejected capture evidence is frozen'; end if;
  return new;
end $$;

create trigger survey_point_guard before insert or update or delete on public.survey_point
  for each row execute function gis_private.guard_survey_point();
create trigger survey_capture_guard before insert or update or delete on public.survey_capture
  for each row execute function gis_private.guard_survey_capture();
create trigger survey_observation_guard before insert or update or delete on public.survey_observation
  for each row execute function gis_private.guard_survey_observation();

-- Each coordinate has its own median. Accuracy is accumulated in numeric, so finite poor readings remain valid.
create view gis_private.survey_capture_summary with (security_invoker=true) as
select c.capture_id,c.point_id,c.site_id,c.capture_code,c.started_at,c.ended_at,c.remeasures_capture_id,
  c.remeasure_required,c.review_state,c.review_reason,c.revision,c.created_at,c.created_by,c.reviewed_at,c.reviewed_by,
  coalesce(a.observation_count,0)::integer observation_count,a.median_latitude,a.median_longitude,
  a.average_reported_accuracy_m,a.best_reported_accuracy_m,
  case when a.observation_count>0 then extensions.st_setsrid(extensions.st_makepoint(a.median_longitude,a.median_latitude),4326) end representative_point,
  to_jsonb(array_remove(array[
    case when coalesce(a.observation_count,0)<5 then 'fewer_than_five' end,
    case when coalesce(a.observation_count,0)>5 then 'more_than_five' end,
    case when coalesce(a.repeated_timestamp,false) then 'repeated_timestamp' end,
    case when coalesce(a.non_increasing_timestamp,false) then 'non_increasing_timestamp' end,
    case when coalesce(a.outside_session,false) then 'outside_session' end,
    case when c.ended_at is null then 'incomplete_capture' end,
    case when c.remeasures_capture_id is not null then 'remeasurement' end,
    case when c.remeasure_required then 'remeasure_required' end,
    case when c.review_state='draft' then 'review_pending' end
  ]::text[],null)) protocol_flags
from public.survey_capture c
left join lateral (
  select count(*)::integer observation_count,
    percentile_cont(0.5) within group (order by latitude)::numeric median_latitude,
    percentile_cont(0.5) within group (order by longitude)::numeric median_longitude,
    avg(reported_accuracy_m) average_reported_accuracy_m,min(reported_accuracy_m) best_reported_accuracy_m,
    count(distinct captured_at)<count(*) repeated_timestamp,
    bool_or(captured_at<=previous_at) non_increasing_timestamp,
    bool_or(captured_at<c.started_at or (c.ended_at is not null and captured_at>c.ended_at)) outside_session
  from (
    select o.*,lag(captured_at) over (order by observation_order) previous_at
    from public.survey_observation o where o.capture_id=c.capture_id
  ) readings
) a on true;
revoke all on gis_private.survey_capture_summary from public,anon,authenticated,service_role;

-- All public RPC responses reuse M01's bounded receipt shape. The audit payload is locally projected.
create function gis_private.audit_evidence(p_entity text,p_id uuid,p_action text,p_old jsonb,p_new jsonb) returns void
language plpgsql security invoker set search_path = pg_catalog, extensions, pg_temp as $$
declare safe_old jsonb; safe_new jsonb;
begin
  perform gis_private.assert_admin();
  if p_entity not in ('survey_point','survey_capture') or p_action not in ('insert','update','status_change') then
    raise exception 'Invalid field evidence audit metadata'; end if;
  select jsonb_object_agg(key,value) into safe_old from jsonb_each(coalesce(p_old,'{}'::jsonb))
    where key=any(array['schemaVersion','id','revision','state','requestId','siteId','pointId','count'])
      and jsonb_typeof(value) in ('string','number','null') and octet_length(value::text)<=200;
  select jsonb_object_agg(key,value) into safe_new from jsonb_each(coalesce(p_new,'{}'::jsonb))
    where key=any(array['schemaVersion','id','revision','state','requestId','siteId','pointId','count'])
      and jsonb_typeof(value) in ('string','number','null') and octet_length(value::text)<=200;
  insert into public.audit_log(actor_account_id,action,table_name,record_id,old_values,new_values)
    values(auth.uid(),p_action,p_entity,p_id::text,safe_old,safe_new);
end $$;

create function public.staff_save_survey_point(p_point_id uuid,p_expected_revision integer,p_values jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, extensions, pg_temp as $$
declare v jsonb; k text; item jsonb; prior jsonb; result jsonb; p public.survey_point; predecessor public.survey_point;
  site_bigint bigint; new_id uuid; state text;
begin
  perform gis_private.assert_admin();
  if p_values is null or jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)+128>1048576 then
    raise exception 'Invalid bounded point metadata'; end if;
  for k,item in select key,value from jsonb_each(p_values) loop
    if k not in ('site_id','point_code','role','description','source_plan_reference','notes','active','review_state','predecessor_point_id') then
      raise exception 'Unsupported point metadata key: %',k; end if;
    if k='active' then
      if jsonb_typeof(item)<>'boolean' then raise exception 'Invalid active flag'; end if;
    elsif item<>'null'::jsonb and jsonb_typeof(item)<>'string' then raise exception 'Invalid point metadata: %',k; end if;
    if k in ('description','notes') and length(p_values->>k)>2000 then raise exception 'Bounded point metadata exceeded'; end if;
    if k='source_plan_reference' and length(p_values->>k)>1024 then raise exception 'Bounded source reference exceeded'; end if;
  end loop;
  if p_point_id is null then
    if p_expected_revision is not null or p_values->>'site_id' is null or p_values->>'point_code' is null or p_values->>'role' is null then
      raise exception 'Point creation requires site, code, role and null revision'; end if;
    if p_values->>'site_id' !~ '^[1-9][0-9]{0,18}$' or (p_values->>'site_id')::numeric>9223372036854775807 then raise exception 'Invalid site ID'; end if;
    site_bigint:=(p_values->>'site_id')::bigint;
    if p_values->>'role' not in ('GCP','VALIDATION') or p_values->>'point_code' !~ '^[A-Za-z0-9._:-]{1,100}$' then raise exception 'Invalid point role or code'; end if;
    if coalesce(p_values->>'review_state','draft')<>'draft' or coalesce((p_values->>'active')::boolean,true)=false then raise exception 'New point must be active draft'; end if;
    if p_values->>'predecessor_point_id' is not null then
      if p_values->>'predecessor_point_id' !~ '^[0-9a-f-]{36}$' then raise exception 'Invalid predecessor ID'; end if;
    end if;
  else
    if p_expected_revision is null or p_expected_revision<1 or p_values ?| array['site_id','point_code','role','predecessor_point_id'] then
      raise exception 'Point identity and role are immutable'; end if;
    if p_values->>'review_state' is not null and p_values->>'review_state' not in ('draft','accepted','rejected','retired') then raise exception 'Invalid point review state'; end if;
  end if;
  v:=jsonb_build_object('pointId',p_point_id::text,'expectedRevision',p_expected_revision,'values',p_values);
  prior:=gis_private.claim_request(p_request_id,'staff_save_survey_point',v);
  if prior is not null then return prior; end if;
  if p_point_id is null then
    if p_values->>'predecessor_point_id' is not null then
      select * into predecessor from public.survey_point where point_id=(p_values->>'predecessor_point_id')::uuid for share;
      if not found or predecessor.site_id<>site_bigint or predecessor.role<>p_values->>'role' or predecessor.review_state<>'retired' then
        raise exception 'Predecessor must be retired with the same point role and site'; end if;
    end if;
    insert into public.survey_point(site_id,point_code,role,description,source_plan_reference,notes,predecessor_point_id,created_by,updated_by)
      values(site_bigint,p_values->>'point_code',p_values->>'role',p_values->>'description',p_values->>'source_plan_reference',
        p_values->>'notes',(p_values->>'predecessor_point_id')::uuid,auth.uid(),auth.uid()) returning point_id into new_id;
    result:=jsonb_build_object('schemaVersion',1,'id',new_id::text,'revision',1,'state','draft','requestId',p_request_id::text);
    perform gis_private.audit_evidence('survey_point',new_id,'insert',null,result||jsonb_build_object('siteId',site_bigint::text));
  else
    select * into p from public.survey_point where point_id=p_point_id for update;
    if not found then raise exception 'Survey point not found'; end if;
    if p.revision<>p_expected_revision then raise exception 'Stale survey point revision' using errcode='40001'; end if;
    if p.review_state='retired' then raise exception 'Retired survey point is terminal'; end if;
    state:=coalesce(p_values->>'review_state',p.review_state);
    update public.survey_point set description=case when p_values ? 'description' then p_values->>'description' else description end,
      source_plan_reference=case when p_values ? 'source_plan_reference' then p_values->>'source_plan_reference' else source_plan_reference end,
      notes=case when p_values ? 'notes' then p_values->>'notes' else notes end,
      active=case when state='retired' then false when p_values ? 'active' then (p_values->>'active')::boolean else active end,
      review_state=state,revision=revision+1,updated_at=transaction_timestamp(),updated_by=auth.uid()
      where point_id=p_point_id;
    result:=jsonb_build_object('schemaVersion',1,'id',p_point_id::text,'revision',p.revision+1,'state',state,'requestId',p_request_id::text);
    perform gis_private.audit_evidence('survey_point',p_point_id,'update',
      jsonb_build_object('schemaVersion',1,'id',p_point_id::text,'revision',p.revision,'state',p.review_state),result);
  end if;
  perform gis_private.finish_request(p_request_id,result);
  return result;
end $$;

create function public.staff_record_survey_capture(p_point_id uuid,p_capture_code text,p_meta jsonb,p_observations jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, extensions, pg_temp as $$
declare p public.survey_point; parent public.survey_capture; v jsonb; prior jsonb; result jsonb; capture_uuid uuid;
  item jsonb; k text; reading jsonb; n integer; ord integer; lat numeric; lon numeric; accuracy numeric; captured timestamptz;
begin
  perform gis_private.assert_admin();
  if p_point_id is null or p_capture_code is null or p_capture_code !~ '^[A-Za-z0-9._:-]{1,100}$' or
    p_meta is null or jsonb_typeof(p_meta)<>'object' or p_observations is null or jsonb_typeof(p_observations)<>'array' or
    octet_length(p_meta::text)+octet_length(p_observations::text)+256>1048576 then raise exception 'Invalid bounded survey capture input'; end if;
  n:=jsonb_array_length(p_observations);
  if n>100 then raise exception 'Observation bound is 0..100'; end if;
  for k,item in select key,value from jsonb_each(p_meta) loop
    if k not in ('started_at','ended_at','device_reference','operator_reference','notes','remeasures_capture_id','remeasure_required') then
      raise exception 'Unsupported capture metadata key: %',k; end if;
    if k='remeasure_required' then
      if jsonb_typeof(item)<>'boolean' then raise exception 'Invalid remeasure flag'; end if;
    elsif item<>'null'::jsonb and jsonb_typeof(item)<>'string' then raise exception 'Invalid capture metadata: %',k; end if;
    if k in ('device_reference','operator_reference') and length(p_meta->>k)>500 or
      k='notes' and length(p_meta->>k)>2000 then raise exception 'Bounded capture metadata exceeded'; end if;
  end loop;
  if p_meta->>'started_at' is null then raise exception 'Capture start time required'; end if;
  -- Validate every JSON observation before claiming a receipt or inserting any row.
  for reading in select value from jsonb_array_elements(p_observations) loop
    if jsonb_typeof(reading)<>'object' or reading - array['observation_order','latitude','longitude','reported_accuracy_m','captured_at','notes']<>'{}'::jsonb then
      raise exception 'Invalid observation shape'; end if;
    if jsonb_typeof(reading->'observation_order')<>'number' or reading->>'observation_order' !~ '^[1-9][0-9]{0,8}$' or
      jsonb_typeof(reading->'latitude')<>'number' or jsonb_typeof(reading->'longitude')<>'number' or
      jsonb_typeof(reading->'reported_accuracy_m')<>'number' or jsonb_typeof(reading->'captured_at')<>'string' or
      (reading ? 'notes' and reading->'notes'<>'null'::jsonb and jsonb_typeof(reading->'notes')<>'string') then
      raise exception 'Invalid finite observation values'; end if;
    lat:=(reading->>'latitude')::numeric; lon:=(reading->>'longitude')::numeric;
    accuracy:=(reading->>'reported_accuracy_m')::numeric;
    if lat::text in ('NaN','Infinity','-Infinity') or lon::text in ('NaN','Infinity','-Infinity') or
      accuracy::text in ('NaN','Infinity','-Infinity') or lat not between -90 and 90 or lon not between -180 and 180 or accuracy<0 or
      length(reading->>'notes')>2000 then raise exception 'Invalid finite latitude, longitude or reported accuracy'; end if;
  end loop;
  v:=jsonb_build_object('pointId',p_point_id::text,'captureCode',p_capture_code,'meta',p_meta,'observations',p_observations);
  prior:=gis_private.claim_request(p_request_id,'staff_record_survey_capture',v);
  if prior is not null then return prior; end if;
  select * into p from public.survey_point where point_id=p_point_id for share;
  if not found or not p.active or p.review_state='retired' then raise exception 'Active survey point required'; end if;
  if p_meta->>'remeasures_capture_id' is not null then
    select * into parent from public.survey_capture where capture_id=(p_meta->>'remeasures_capture_id')::uuid for share;
    if not found or parent.point_id<>p_point_id or parent.site_id<>p.site_id then raise exception 'Remeasure parent must belong to same point/site'; end if;
  end if;
  insert into public.survey_capture(point_id,site_id,capture_code,started_at,ended_at,device_reference,operator_reference,notes,
    remeasures_capture_id,remeasure_required,created_at,created_by)
    values(p_point_id,p.site_id,p_capture_code,(p_meta->>'started_at')::timestamptz,(p_meta->>'ended_at')::timestamptz,
      p_meta->>'device_reference',p_meta->>'operator_reference',p_meta->>'notes',(p_meta->>'remeasures_capture_id')::uuid,
      coalesce((p_meta->>'remeasure_required')::boolean,false),
      case when parent.capture_id is not null then greatest(clock_timestamp(),parent.created_at + interval '1 microsecond')
        else clock_timestamp() end,auth.uid()) returning capture_id into capture_uuid;
  for reading in select value from jsonb_array_elements(p_observations) loop
    insert into public.survey_observation(capture_id,observation_order,latitude,longitude,reported_accuracy_m,captured_at,notes)
      values(capture_uuid,(reading->>'observation_order')::integer,(reading->>'latitude')::numeric,(reading->>'longitude')::numeric,
        (reading->>'reported_accuracy_m')::numeric,(reading->>'captured_at')::timestamptz,reading->>'notes');
  end loop;
  result:=jsonb_build_object('schemaVersion',1,'id',capture_uuid::text,'revision',1,'state','draft','requestId',p_request_id::text);
  perform gis_private.audit_evidence('survey_capture',capture_uuid,'insert',null,
    result||jsonb_build_object('siteId',p.site_id::text,'pointId',p_point_id::text,'count',n));
  perform gis_private.finish_request(p_request_id,result);
  return result;
end $$;

create function public.staff_review_survey_capture(p_capture_id uuid,p_expected_revision integer,p_decision text,
  p_acknowledgements jsonb,p_notes text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, extensions, pg_temp as $$
declare c public.survey_capture; s gis_private.survey_capture_summary; prior jsonb; result jsonb; required_flags jsonb;
begin
  perform gis_private.assert_admin();
  if p_capture_id is null or p_expected_revision is null or p_expected_revision<1 or p_decision not in ('accepted','rejected') or
    p_acknowledgements is null or jsonb_typeof(p_acknowledgements)<>'array' or jsonb_array_length(p_acknowledgements)>20 or
    length(p_notes)>2000 or octet_length(coalesce(p_notes,''))+octet_length(p_acknowledgements::text)+256>1048576 then
    raise exception 'Invalid bounded survey review'; end if;
  prior:=gis_private.claim_request(p_request_id,'staff_review_survey_capture',jsonb_build_object(
    'captureId',p_capture_id::text,'expectedRevision',p_expected_revision,'decision',p_decision,
    'acknowledgements',p_acknowledgements,'notes',p_notes));
  if prior is not null then return prior; end if;
  select * into c from public.survey_capture where capture_id=p_capture_id for update;
  if not found then raise exception 'Survey capture not found'; end if;
  if c.revision<>p_expected_revision then raise exception 'Stale survey capture revision' using errcode='40001'; end if;
  if c.review_state<>'draft' then raise exception 'Accepted or rejected capture is frozen'; end if;
  select * into s from gis_private.survey_capture_summary where capture_id=p_capture_id;
  if p_decision='accepted' then
    if s.representative_point is null then raise exception 'Usable representative point required for acceptance'; end if;
    required_flags:=s.protocol_flags - 'review_pending';
    if exists (select 1 from jsonb_array_elements_text(required_flags) flag where not p_acknowledgements ? flag) then
      raise exception 'Protocol deviations require explicit acknowledgement'; end if;
  end if;
  update public.survey_capture set review_state=p_decision,review_reason=p_notes,revision=revision+1,
    reviewed_at=transaction_timestamp(),reviewed_by=auth.uid() where capture_id=p_capture_id;
  result:=jsonb_build_object('schemaVersion',1,'id',p_capture_id::text,'revision',c.revision+1,'state',p_decision,'requestId',p_request_id::text);
  perform gis_private.audit_evidence('survey_capture',p_capture_id,'status_change',
    jsonb_build_object('schemaVersion',1,'id',p_capture_id::text,'revision',c.revision,'state',c.review_state),
    result||jsonb_build_object('siteId',c.site_id::text,'pointId',c.point_id::text,'count',s.observation_count));
  perform gis_private.finish_request(p_request_id,result);
  return result;
end $$;

revoke all on all functions in schema gis_private from public,anon,authenticated,service_role;
revoke all on function public.staff_save_survey_point(uuid,integer,jsonb,uuid),
  public.staff_record_survey_capture(uuid,text,jsonb,jsonb,uuid),
  public.staff_review_survey_capture(uuid,integer,text,jsonb,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.staff_save_survey_point(uuid,integer,jsonb,uuid),
  public.staff_record_survey_capture(uuid,text,jsonb,jsonb,uuid),
  public.staff_review_survey_capture(uuid,integer,text,jsonb,text,uuid) to authenticated;

commit;
