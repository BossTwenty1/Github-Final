begin;

-- M01: release identities and private mutation authority only. No import,
-- geometry, approval, activation, public read or legacy-table changes.
create schema gis_private;
revoke all on schema gis_private from public, anon, authenticated, service_role;

create table public.mapping_release (
  release_id uuid primary key default pg_catalog.gen_random_uuid(),
  site_id bigint not null references public.site(site_id) on delete restrict,
  release_code text not null,
  title text not null,
  description text,
  scope_kind text not null,
  pilot_area_id bigint references public.area(area_id) on delete restrict,
  status text not null default 'draft',
  revision integer not null default 1,
  package_reference text,
  package_hash text,
  source_plan_reference text,
  source_plan_version text,
  source_plan_hash text,
  source_coordinate_space text,
  field_srid integer not null default 4326,
  working_srid integer not null default 32651,
  published_srid integer not null default 4326,
  qgis_version text,
  selected_run_id uuid,
  validation_report_hash text,
  validation_summary jsonb,
  notes text,
  rejection_reason text,
  created_at timestamptz not null default transaction_timestamp(),
  created_by uuid references public.account(account_id) on delete set null,
  staged_at timestamptz,
  staged_by uuid references public.account(account_id) on delete set null,
  validated_at timestamptz,
  validated_by uuid references public.account(account_id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.account(account_id) on delete set null,
  published_at timestamptz,
  published_by uuid references public.account(account_id) on delete set null,
  constraint mapping_release_site_code_key unique (site_id, release_code),
  constraint mapping_release_id_site_key unique (release_id, site_id),
  constraint mapping_release_status_check check (status in ('draft','staged','validated','approved','published','superseded','rejected')),
  constraint mapping_release_revision_check check (revision > 0),
  constraint mapping_release_scope_check check (scope_kind in ('pilot','full') and (scope_kind <> 'pilot' or pilot_area_id is not null)),
  constraint mapping_release_code_check check (length(release_code) between 1 and 100 and release_code ~ '^[A-Za-z0-9._:-]+$'),
  constraint mapping_release_title_check check (length(title) between 1 and 200 and btrim(title) <> ''),
  constraint mapping_release_description_check check (description is null or length(description) <= 2000),
  constraint mapping_release_notes_check check (notes is null or length(notes) <= 2000),
  constraint mapping_release_reason_check check (rejection_reason is null or (length(rejection_reason) between 1 and 2000 and btrim(rejection_reason) <> '')),
  constraint mapping_release_reference_check check (
    (package_reference is null or (length(package_reference) between 1 and 1024 and btrim(package_reference) <> '')) and
    (source_plan_reference is null or (length(source_plan_reference) between 1 and 1024 and btrim(source_plan_reference) <> ''))),
  constraint mapping_release_version_check check (
    (source_plan_version is null or (length(source_plan_version) between 1 and 100 and btrim(source_plan_version) <> '')) and
    (qgis_version is null or (length(qgis_version) between 1 and 100 and btrim(qgis_version) <> '')) and
    (source_coordinate_space is null or (length(source_coordinate_space) between 1 and 100 and btrim(source_coordinate_space) <> ''))),
  constraint mapping_release_hash_check check (
    (package_hash is null or package_hash ~ '^[0-9a-f]{64}$') and
    (source_plan_hash is null or source_plan_hash ~ '^[0-9a-f]{64}$') and
    (validation_report_hash is null or validation_report_hash ~ '^[0-9a-f]{64}$')),
  constraint mapping_release_pilot_crs_check check (scope_kind <> 'pilot' or (field_srid=4326 and working_srid=32651 and published_srid=4326)),
  constraint mapping_release_srid_check check (field_srid > 0 and working_srid > 0 and published_srid > 0),
  constraint mapping_release_summary_check check (validation_summary is null or (
    jsonb_typeof(validation_summary)='object' and octet_length(validation_summary::text) <= 4096 and
    validation_summary - array['schemaVersion','featureCount','errorCount','warningCount','reportDigest'] = '{}'::jsonb and
    (not (validation_summary ? 'schemaVersion') or validation_summary->'schemaVersion' = '1'::jsonb) and
    (not (validation_summary ? 'featureCount') or (jsonb_typeof(validation_summary->'featureCount')='number' and validation_summary->>'featureCount' ~ '^[0-9]{1,9}$')) and
    (not (validation_summary ? 'errorCount') or (jsonb_typeof(validation_summary->'errorCount')='number' and validation_summary->>'errorCount' ~ '^[0-9]{1,9}$')) and
    (not (validation_summary ? 'warningCount') or (jsonb_typeof(validation_summary->'warningCount')='number' and validation_summary->>'warningCount' ~ '^[0-9]{1,9}$')) and
    (not (validation_summary ? 'reportDigest') or (jsonb_typeof(validation_summary->'reportDigest')='string' and validation_summary->>'reportDigest' ~ '^[0-9a-f]{64}$'))))
);

create table public.mapping_release_area (
  release_id uuid not null,
  site_id bigint not null,
  area_id bigint not null references public.area(area_id) on delete restrict,
  primary key (release_id,area_id),
  constraint mapping_release_area_scope_key unique (release_id,site_id,area_id),
  constraint mapping_release_area_release_site_fkey foreign key (release_id,site_id)
    references public.mapping_release(release_id,site_id) on delete restrict
);

create table public.mapping_publication (
  site_id bigint not null references public.site(site_id) on delete restrict,
  area_id bigint not null references public.area(area_id) on delete restrict,
  release_id uuid not null,
  published_at timestamptz not null default transaction_timestamp(),
  published_by uuid references public.account(account_id) on delete set null,
  primary key (site_id,area_id),
  constraint mapping_publication_membership_fkey foreign key (release_id,site_id,area_id)
    references public.mapping_release_area(release_id,site_id,area_id) on delete restrict
);

create table public.mapping_publication_event (
  event_id uuid primary key default pg_catalog.gen_random_uuid(),
  site_id bigint not null references public.site(site_id) on delete restrict,
  area_id bigint not null references public.area(area_id) on delete restrict,
  previous_release_id uuid references public.mapping_release(release_id) on delete restrict,
  new_release_id uuid not null references public.mapping_release(release_id) on delete restrict,
  request_id uuid not null unique,
  kind text not null,
  actor_account_id uuid references public.account(account_id) on delete set null,
  created_at timestamptz not null default transaction_timestamp(),
  constraint mapping_publication_event_kind_check check (kind in ('publish','rollback')),
  constraint mapping_publication_event_distinct_check check (previous_release_id is null or previous_release_id <> new_release_id),
  constraint mapping_publication_event_membership_fkey foreign key (new_release_id,site_id,area_id)
    references public.mapping_release_area(release_id,site_id,area_id) on delete restrict
);

create table gis_private.gis_mutation_request (
  request_id uuid primary key,
  actor_account_id uuid not null references public.account(account_id) on delete restrict,
  operation text not null,
  input_hash text not null,
  response jsonb,
  created_at timestamptz not null default transaction_timestamp(),
  constraint gis_request_operation_check check (length(operation) between 1 and 100 and operation ~ '^[A-Za-z0-9._:-]+$'),
  constraint gis_request_hash_check check (input_hash ~ '^[0-9a-f]{64}$'),
  constraint gis_request_response_check check (response is null or (
    jsonb_typeof(response)='object' and octet_length(response::text) <= 8192 and
    response - array['schemaVersion','id','revision','state','requestId','count','digest'] = '{}'::jsonb and
    response ?& array['schemaVersion','id','revision','state','requestId'] and
    response->'schemaVersion' = '1'::jsonb and jsonb_typeof(response->'id')='string' and
    length(response->>'id') between 1 and 100 and
    jsonb_typeof(response->'revision')='number' and response->>'revision' ~ '^[1-9][0-9]{0,9}$' and
    (response->>'revision')::numeric<=2147483647 and jsonb_typeof(response->'state')='string' and
    response->>'state' in ('draft','staged','validated','approved','published','superseded','rejected') and
    jsonb_typeof(response->'requestId')='string' and response->>'requestId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and
    (not (response ? 'count') or (jsonb_typeof(response->'count')='number' and response->>'count' ~ '^[0-9]{1,9}$')) and
    (not (response ? 'digest') or (jsonb_typeof(response->'digest')='string' and response->>'digest' ~ '^[0-9a-f]{64}$'))))
);

create index mapping_release_scope_status_idx on public.mapping_release(site_id,pilot_area_id,status,release_id);
create index mapping_release_pilot_area_idx on public.mapping_release(pilot_area_id);
create index mapping_release_created_by_idx on public.mapping_release(created_by);
create index mapping_release_staged_by_idx on public.mapping_release(staged_by);
create index mapping_release_validated_by_idx on public.mapping_release(validated_by);
create index mapping_release_reviewed_by_idx on public.mapping_release(reviewed_by);
create index mapping_release_published_by_idx on public.mapping_release(published_by);
create index mapping_release_area_area_idx on public.mapping_release_area(area_id);
create index mapping_release_area_scope_idx on public.mapping_release_area(site_id,area_id,release_id);
create index mapping_publication_release_scope_idx on public.mapping_publication(release_id,site_id,area_id);
create index mapping_publication_area_idx on public.mapping_publication(area_id);
create index mapping_publication_actor_idx on public.mapping_publication(published_by);
create index mapping_publication_event_scope_time_idx on public.mapping_publication_event(site_id,area_id,created_at,event_id);
create index mapping_publication_event_area_idx on public.mapping_publication_event(area_id);
create index mapping_publication_event_previous_idx on public.mapping_publication_event(previous_release_id);
create index mapping_publication_event_new_scope_idx on public.mapping_publication_event(new_release_id,site_id,area_id);
create index mapping_publication_event_actor_idx on public.mapping_publication_event(actor_account_id);
create index gis_mutation_request_actor_idx on gis_private.gis_mutation_request(actor_account_id,operation,created_at);
create index gis_mutation_request_hash_idx on gis_private.gis_mutation_request(input_hash);

alter table public.mapping_release enable row level security;
alter table public.mapping_release_area enable row level security;
alter table public.mapping_publication enable row level security;
alter table public.mapping_publication_event enable row level security;
alter table gis_private.gis_mutation_request enable row level security;
revoke all on public.mapping_release, public.mapping_release_area, public.mapping_publication,
  public.mapping_publication_event, gis_private.gis_mutation_request from public, anon, authenticated, service_role;
grant select on public.mapping_release, public.mapping_release_area, public.mapping_publication,
  public.mapping_publication_event to authenticated;
create policy mapping_release_admin_read on public.mapping_release for select to authenticated using (public.is_active_admin());
create policy mapping_release_area_admin_read on public.mapping_release_area for select to authenticated using (public.is_active_admin());
create policy mapping_publication_admin_read on public.mapping_publication for select to authenticated using (public.is_active_admin());
create policy mapping_publication_event_admin_read on public.mapping_publication_event for select to authenticated using (public.is_active_admin());

create function gis_private.assert_admin() returns void language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
begin
  if auth.uid() is null or not public.is_active_admin() then
    raise exception 'An active administrator is required' using errcode='42501';
  end if;
end $$;

create function gis_private.assert_pilot_scope(p_release_id uuid) returns void language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare r public.mapping_release; a public.area; membership_count integer;
begin
  select * into r from public.mapping_release where release_id=p_release_id for share;
  if not found or r.scope_kind <> 'pilot' or r.pilot_area_id is null then
    raise exception 'The v1 pipeline requires a pilot scope';
  end if;
  select * into a from public.area where area_id=r.pilot_area_id for share;
  if not found or a.site_id <> r.site_id then raise exception 'Pilot area/site mismatch'; end if;
  perform 1 from public.mapping_release_area where release_id=p_release_id for share;
  select count(*) into membership_count from public.mapping_release_area where release_id=p_release_id;
  if membership_count <> 1 or not exists (
    select 1 from public.mapping_release_area where release_id=p_release_id and site_id=r.site_id and area_id=r.pilot_area_id
  ) then raise exception 'Pilot scope requires exactly one matching area membership'; end if;
end $$;

create function gis_private.claim_request(p_request_id uuid,p_operation text,p_input jsonb) returns jsonb language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare actor uuid := auth.uid(); input_digest text; receipt gis_private.gis_mutation_request;
begin
  perform gis_private.assert_admin();
  if p_request_id is null or p_input is null or jsonb_typeof(p_input) <> 'object' or
    octet_length(p_input::text) > 1048576 or p_operation is null then raise exception 'Invalid bounded mutation request'; end if;
  input_digest := encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
  insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash)
    values(p_request_id,actor,p_operation,input_digest) on conflict do nothing;
  select * into receipt from gis_private.gis_mutation_request where request_id=p_request_id for update;
  if receipt.actor_account_id <> actor or receipt.operation <> p_operation or receipt.input_hash <> input_digest then
    raise exception 'Mutation request UUID conflict: actor, operation or input differs' using errcode='22023';
  end if;
  return receipt.response;
end $$;

create function gis_private.finish_request(p_request_id uuid,p_response jsonb) returns void language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
begin
  perform gis_private.assert_admin();
  if p_response is null or p_response->>'requestId' is distinct from p_request_id::text then raise exception 'Invalid receipt response'; end if;
  update gis_private.gis_mutation_request set response=p_response
    where request_id=p_request_id and actor_account_id=auth.uid() and response is null and created_at=transaction_timestamp();
  if not found then raise exception 'No pending mutation request'; end if;
end $$;

create function gis_private.audit_event(p_entity text,p_id text,p_action text,p_old_meta jsonb,p_new_meta jsonb) returns void language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare safe_old jsonb; safe_new jsonb;
begin
  perform gis_private.assert_admin();
  if p_entity not in ('mapping_release','mapping_release_area','mapping_publication','mapping_publication_event') or
    p_action not in ('insert','update','approve','status_change') or length(p_id) not between 1 and 100 then
    raise exception 'Invalid GIS audit metadata';
  end if;
  -- Project an explicit allowlist; never attach legacy raw-row audit triggers.
  select jsonb_object_agg(key,value) into safe_old from jsonb_each(coalesce(p_old_meta,'{}'::jsonb))
    where key=any(array['schemaVersion','id','revision','state','requestId','siteId','areaId','scopeKind','packageDigest'])
      and jsonb_typeof(value) in ('string','number','null') and octet_length(value::text)<=200;
  select jsonb_object_agg(key,value) into safe_new from jsonb_each(coalesce(p_new_meta,'{}'::jsonb))
    where key=any(array['schemaVersion','id','revision','state','requestId','siteId','areaId','scopeKind','packageDigest'])
      and jsonb_typeof(value) in ('string','number','null') and octet_length(value::text)<=200;
  insert into public.audit_log(actor_account_id,action,table_name,record_id,old_values,new_values)
    values(auth.uid(),p_action,p_entity,p_id,safe_old,safe_new);
end $$;

create function gis_private.guard_release() returns trigger language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare operation text; owner_name name; pending_count integer; required_operation text;
begin
  if tg_op='DELETE' then raise exception 'Release snapshots are retained; protected deletion is unavailable'; end if;
  select pg_get_userbyid(relowner) into owner_name from pg_class where oid=tg_relid;
  if current_user <> owner_name then raise exception 'A protected owner operation is required' using errcode='42501'; end if;
  -- Trust private SQL receipts under the table owner, never session settings.
  select count(*),min(q.operation) into pending_count,operation from gis_private.gis_mutation_request q
    where q.actor_account_id=auth.uid() and q.response is null and q.created_at=transaction_timestamp();
  if pending_count <> 1 then raise exception 'A protected pending operation is required' using errcode='42501'; end if;
  perform gis_private.assert_admin();
  if tg_op='INSERT' then
    if operation <> 'staff_create_mapping_release' or new.status <> 'draft' or new.revision <> 1 or new.created_by is distinct from auth.uid() then
      raise exception 'Invalid creation operation or initial lifecycle state';
    end if;
    if new.scope_kind='pilot' then
      perform 1 from public.area where area_id=new.pilot_area_id and site_id=new.site_id for share;
      if not found then raise exception 'Pilot area must belong to release site'; end if;
    end if;
    return new;
  end if;
  if old.status='rejected' then raise exception 'Rejected releases are terminal'; end if;
  if new.revision <> old.revision+1 then raise exception 'Mutation must increment revision exactly once'; end if;
  if (new.release_id,new.site_id,new.scope_kind,new.pilot_area_id,new.release_code,new.created_at,new.created_by)
    is distinct from (old.release_id,old.site_id,old.scope_kind,old.pilot_area_id,old.release_code,old.created_at,old.created_by) then
    raise exception 'Release scope and identity are frozen';
  end if;
  required_operation := case
    when old.status in ('draft','staged','validated') and new.status='staged' then 'staff_seal_mapping_import'
    when old.status='staged' and new.status='validated' then 'staff_finalize_mapping_import'
    when old.status='validated' and new.status='approved' then 'staff_review_mapping_release'
    when old.status='approved' and new.status='published' then 'staff_publish_mapping_release'
    when old.status='published' and new.status='superseded' then 'activate_release'
    when old.status in ('draft','staged','validated','approved') and new.status='rejected' then 'staff_reject_mapping_release'
    when old.status='superseded' and new.status='published' then 'staff_rollback_mapping_release'
    else null end;
  -- activate_release will be private to the publish/rollback transaction. Its
  -- authority remains the enclosing D receipt, never a standalone activation.
  if required_operation is null or not (
    (required_operation <> 'activate_release' and operation=required_operation) or
    (required_operation='activate_release' and operation in ('staff_publish_mapping_release','staff_rollback_mapping_release')) or
    (new.status='rejected' and old.status in ('draft','staged','validated','approved') and operation='staff_review_mapping_release')
  ) then raise exception 'Forbidden lifecycle transition or owning operation'; end if;
  if old.status in ('approved','published','superseded') and
    (to_jsonb(new)-array['status','revision','published_at','published_by','rejection_reason']) is distinct from
    (to_jsonb(old)-array['status','revision','published_at','published_by','rejection_reason']) then
    raise exception 'Approved snapshot content is frozen';
  end if;
  if old.status='superseded' and new.status='published' and old.published_at is null then
    raise exception 'Rollback requires a previously published snapshot';
  end if;
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
    -- Every intentional restage invalidates the selected validation/approval.
    new.selected_run_id := null; new.validation_report_hash := null; new.validation_summary := null;
    new.validated_at := null; new.validated_by := null; new.reviewed_at := null; new.reviewed_by := null;
  end if;
  return new;
end $$;

create function gis_private.guard_release_area() returns trigger language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare r public.mapping_release; operation text; owner_name name; pending_count integer;
begin
  select pg_get_userbyid(relowner) into owner_name from pg_class where oid=tg_relid;
  if current_user <> owner_name or tg_op <> 'INSERT' then raise exception 'Release scope is frozen; protected operation required'; end if;
  perform gis_private.assert_admin();
  select count(*),min(q.operation) into pending_count,operation from gis_private.gis_mutation_request q
    where q.actor_account_id=auth.uid() and q.response is null and q.created_at=transaction_timestamp();
  if pending_count<>1 or operation <> 'staff_create_mapping_release' then raise exception 'Protected scope creation operation required'; end if;
  select * into r from public.mapping_release where release_id=new.release_id for update;
  if not found or r.status<>'draft' or new.site_id<>r.site_id then raise exception 'Invalid release area/site scope'; end if;
  perform 1 from public.area where area_id=new.area_id and site_id=new.site_id for share;
  if not found then raise exception 'Area must belong to release site'; end if;
  if r.scope_kind='pilot' and (new.area_id<>r.pilot_area_id or exists (
    select 1 from public.mapping_release_area where release_id=new.release_id
  )) then raise exception 'Pilot scope requires exactly one matching area'; end if;
  return new;
end $$;

create function gis_private.guard_publication_history() returns trigger language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
begin
  raise exception 'Publication history is append-only and immutable';
end $$;

create trigger mapping_release_guard before insert or update or delete on public.mapping_release
  for each row execute function gis_private.guard_release();
create trigger mapping_release_area_guard before insert or update or delete on public.mapping_release_area
  for each row execute function gis_private.guard_release_area();
create trigger mapping_publication_event_immutable before update or delete on public.mapping_publication_event
  for each row execute function gis_private.guard_publication_history();

create function public.staff_create_mapping_release(p_values jsonb,p_request_id uuid) returns jsonb language plpgsql security definer
set search_path = pg_catalog, extensions, pg_temp as $$
declare values_json jsonb; canonical jsonb; prior jsonb; result jsonb; actor uuid := auth.uid();
  release_uuid uuid; site_bigint bigint; area_bigint bigint; k text; v jsonb; text_limit integer;
begin
  perform gis_private.assert_admin();
  if p_values is null or jsonb_typeof(p_values)<>'object' then raise exception 'Invalid metadata object'; end if;
  if octet_length(p_values::text)+128 > 1048576 then raise exception 'Mutation envelope exceeds bounded size limit'; end if;
  values_json := p_values;
  for k,v in select key,value from jsonb_each(values_json) loop
    if k not in ('site_id','release_code','title','description','scope_kind','pilot_area_id','package_reference','package_hash',
      'source_plan_reference','source_plan_version','source_plan_hash','source_coordinate_space','field_srid','working_srid','published_srid','qgis_version','notes') then
      raise exception 'Unsupported metadata key: %',k;
    end if;
    if k in ('field_srid','working_srid','published_srid') then
      if jsonb_typeof(v)<>'number' or v::text !~ '^[1-9][0-9]{0,6}$' then raise exception 'Invalid SRID metadata'; end if;
    elsif v <> 'null'::jsonb then
      if jsonb_typeof(v)<>'string' then raise exception 'Invalid text metadata: %',k; end if;
      text_limit := case when k in ('description','notes') then 2000 when k='title' then 200
        when k in ('package_reference','source_plan_reference') then 1024 else 100 end;
      if length(values_json->>k)>text_limit then raise exception 'Invalid bounded metadata: %',k; end if;
      if k not in ('description','notes') and btrim(values_json->>k)='' then raise exception 'Invalid blank metadata: %',k; end if;
    end if;
  end loop;
  for k in select unnest(array['site_id','release_code','title','scope_kind']) loop
    if values_json->>k is null then raise exception 'Invalid required metadata: %',k; end if;
  end loop;
  if values_json->>'scope_kind' not in ('pilot','full') then raise exception 'Invalid scope metadata'; end if;
  if values_json->>'site_id' !~ '^[1-9][0-9]{0,18}$' or (values_json->>'site_id')::numeric>9223372036854775807 then
    raise exception 'Invalid site ID'; end if;
  site_bigint := (values_json->>'site_id')::bigint;
  if values_json->>'pilot_area_id' is not null then
    if values_json->>'pilot_area_id' !~ '^[1-9][0-9]{0,18}$' or (values_json->>'pilot_area_id')::numeric>9223372036854775807 then
      raise exception 'Invalid pilot area ID'; end if;
    area_bigint := (values_json->>'pilot_area_id')::bigint;
  end if;
  if values_json->>'scope_kind'='pilot' and area_bigint is null then raise exception 'Pilot area is required'; end if;
  if values_json->>'release_code' !~ '^[A-Za-z0-9._:-]+$' then raise exception 'Invalid release code'; end if;
  for k in select unnest(array['package_hash','source_plan_hash']) loop
    if values_json->>k is not null and values_json->>k !~ '^[0-9a-f]{64}$' then raise exception 'Invalid metadata hash'; end if;
  end loop;
  -- Normalize absent/null optional fields and default CRS before SQL hashing.
  canonical := jsonb_build_object('site_id',site_bigint::text,'pilot_area_id',area_bigint::text);
  for k in select unnest(array['release_code','title','description','scope_kind','package_reference','package_hash','source_plan_reference',
    'source_plan_version','source_plan_hash','source_coordinate_space','qgis_version','notes']) loop
    canonical := canonical || jsonb_build_object(k,values_json->>k);
  end loop;
  canonical := canonical || jsonb_build_object('field_srid',coalesce((values_json->>'field_srid')::integer,4326),
    'working_srid',coalesce((values_json->>'working_srid')::integer,32651),'published_srid',coalesce((values_json->>'published_srid')::integer,4326));
  if canonical->>'scope_kind'='pilot' and (canonical->>'field_srid'<>'4326' or canonical->>'working_srid'<>'32651' or canonical->>'published_srid'<>'4326') then
    raise exception 'Invalid pilot SRID metadata'; end if;
  prior := gis_private.claim_request(p_request_id,'staff_create_mapping_release',canonical);
  if prior is not null then return prior; end if;
  perform 1 from public.site where site_id=site_bigint for share;
  if not found then raise exception 'Release site does not exist'; end if;
  if area_bigint is not null then
    perform 1 from public.area where area_id=area_bigint and site_id=site_bigint for share;
    if not found then raise exception 'Pilot area must exist and belong to release site'; end if;
  end if;
  insert into public.mapping_release(site_id,release_code,title,description,scope_kind,pilot_area_id,package_reference,package_hash,
    source_plan_reference,source_plan_version,source_plan_hash,source_coordinate_space,field_srid,working_srid,published_srid,qgis_version,notes,created_by)
    values(site_bigint,canonical->>'release_code',canonical->>'title',canonical->>'description',canonical->>'scope_kind',area_bigint,
      canonical->>'package_reference',canonical->>'package_hash',canonical->>'source_plan_reference',canonical->>'source_plan_version',
      canonical->>'source_plan_hash',canonical->>'source_coordinate_space',(canonical->>'field_srid')::integer,
      (canonical->>'working_srid')::integer,(canonical->>'published_srid')::integer,canonical->>'qgis_version',canonical->>'notes',actor)
    returning release_id into release_uuid;
  if canonical->>'scope_kind'='pilot' then
    insert into public.mapping_release_area(release_id,site_id,area_id) values(release_uuid,site_bigint,area_bigint);
    perform gis_private.assert_pilot_scope(release_uuid);
  end if;
  result := jsonb_build_object('schemaVersion',1,'id',release_uuid::text,'revision',1,'state','draft','requestId',p_request_id::text);
  perform gis_private.audit_event('mapping_release',release_uuid::text,'insert',null,
    result||jsonb_build_object('siteId',site_bigint::text,'areaId',area_bigint::text,'scopeKind',canonical->>'scope_kind','packageDigest',canonical->>'package_hash'));
  perform gis_private.finish_request(p_request_id,result);
  return result;
end $$;

create function public.staff_reject_mapping_release(p_release_id uuid,p_expected_revision integer,p_reason text,p_request_id uuid) returns jsonb language plpgsql security definer
set search_path = pg_catalog, extensions, pg_temp as $$
declare prior jsonb; r public.mapping_release; result jsonb; reason text := btrim(p_reason);
begin
  perform gis_private.assert_admin();
  if p_release_id is null or p_expected_revision is null or p_expected_revision<1 then raise exception 'Invalid release ID or expected revision'; end if;
  if reason is null or length(reason) not between 1 and 2000 then raise exception 'A bounded rejection reason is required'; end if;
  if octet_length(p_reason)+128>1048576 then raise exception 'Mutation exceeds bounded envelope limit'; end if;
  prior := gis_private.claim_request(p_request_id,'staff_reject_mapping_release',jsonb_build_object(
    'releaseId',p_release_id::text,'expectedRevision',p_expected_revision,'reason',reason));
  if prior is not null then return prior; end if;
  select * into r from public.mapping_release where release_id=p_release_id for update;
  if not found then raise exception 'Release not found'; end if;
  if r.revision<>p_expected_revision then raise exception 'Stale release revision' using errcode='40001'; end if;
  if r.status not in ('draft','staged','validated','approved') then raise exception 'Release cannot be rejected: terminal or immutable lifecycle state'; end if;
  update public.mapping_release set status='rejected',revision=revision+1,rejection_reason=reason where release_id=p_release_id;
  result := jsonb_build_object('schemaVersion',1,'id',p_release_id::text,'revision',r.revision+1,'state','rejected','requestId',p_request_id::text);
  perform gis_private.audit_event('mapping_release',p_release_id::text,'status_change',
    jsonb_build_object('schemaVersion',1,'id',p_release_id::text,'revision',r.revision,'state',r.status),result);
  perform gis_private.finish_request(p_request_id,result);
  return result;
end $$;

-- Explicitly defeat PUBLIC and any inherited Supabase default ACLs, in M01.
revoke all on all functions in schema gis_private from public, anon, authenticated, service_role;
revoke all on function public.staff_create_mapping_release(jsonb,uuid),
  public.staff_reject_mapping_release(uuid,integer,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.staff_create_mapping_release(jsonb,uuid),
  public.staff_reject_mapping_release(uuid,integer,text,uuid) to authenticated;

comment on schema gis_private is 'Owner-only GIS helpers and hashed mutation receipts; not an exposed client API.';
comment on column public.mapping_release.selected_run_id is 'Reserved reference; its FK is introduced with the run entity in a later migration.';
comment on column public.mapping_release.scope_kind is 'full is reserved draft metadata only; every v1 pipeline gate requires assert_pilot_scope.';

commit;
