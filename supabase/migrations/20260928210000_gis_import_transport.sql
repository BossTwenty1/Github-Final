begin;

-- M06: bounded private transport storage and resumable import identity.
-- No GIS materialization, semantic finalization, readiness, publication, or UI behavior.

create table public.mapping_import (
  import_id uuid primary key default pg_catalog.gen_random_uuid(),
  request_id uuid not null unique,
  actor_account_id uuid not null references public.account(account_id) on delete restrict,
  release_id uuid not null,
  site_id bigint not null,
  area_id bigint not null,
  base_revision integer not null,
  target_revision integer not null,
  package_digest text not null,
  manifest_sha256 text not null,
  validator_version text not null default 'gis-pilot-v1',
  state text not null default 'receiving',
  revision integer not null default 1,
  failure_classification text,
  current_report_id uuid,
  abandon_reason text,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  sealed_at timestamptz,
  abandoned_at timestamptz,
  constraint mapping_import_release_scope_fkey foreign key (release_id,site_id,area_id)
    references public.mapping_release_area(release_id,site_id,area_id) on delete restrict,
  constraint mapping_import_revision_check check (
    base_revision > 0 and target_revision = base_revision + 1 and revision > 0),
  constraint mapping_import_digest_check check (
    package_digest ~ '^[0-9a-f]{64}$' and manifest_sha256 ~ '^[0-9a-f]{64}$'),
  constraint mapping_import_validator_check check (
    length(validator_version) between 1 and 100 and validator_version ~ '^[A-Za-z0-9._:-]+$'),
  constraint mapping_import_state_check check (
    state in ('receiving','sealed','invalid','validated','finalized','abandoned')),
  constraint mapping_import_failure_check check (
    failure_classification is null or failure_classification in ('package','live_dependency','execution')),
  constraint mapping_import_abandon_reason_check check (
    abandon_reason is null or (length(abandon_reason) between 1 and 2000 and btrim(abandon_reason) <> ''))
);

create table public.mapping_import_file (
  import_id uuid not null references public.mapping_import(import_id) on delete restrict,
  file_name text not null,
  declared_sha256 text not null,
  declared_bytes integer not null,
  declared_feature_count integer not null,
  declared_chunk_count integer not null,
  layer_version text,
  created_at timestamptz not null default transaction_timestamp(),
  primary key (import_id,file_name),
  constraint mapping_import_file_name_check check (file_name in (
    'manifest.json','cemetery_boundary.geojson','garden_sections.geojson','roads_walkways.geojson',
    'grave_plots.geojson','grave_access_points.geojson','route_nodes.geojson','route_edges.geojson',
    'landmarks.geojson','survey_points.json','survey_captures.json','survey_observations.json',
    'georeferencing_runs.json','georeferencing_run_points.json','georeferencing_validation.json')),
  constraint mapping_import_file_sha_check check (declared_sha256 ~ '^[0-9a-f]{64}$'),
  constraint mapping_import_file_bytes_check check (
    declared_bytes >= 0 and
    ((file_name='manifest.json' and declared_bytes <= 65536) or
     (file_name<>'manifest.json' and declared_bytes <= 4194304))),
  constraint mapping_import_file_count_check check (declared_feature_count between 0 and 20000),
  constraint mapping_import_file_chunk_count_check check (
    declared_chunk_count between 0 and 64 and
    (file_name<>'manifest.json' or declared_chunk_count=1) and
    declared_chunk_count = case when declared_bytes=0 then 0 else ((declared_bytes-1)/65536)+1 end),
  constraint mapping_import_file_layer_check check (
    (file_name='manifest.json' and layer_version is null) or
    (file_name<>'manifest.json' and length(layer_version) between 1 and 100 and layer_version ~ '^[A-Za-z0-9._:-]+$'))
);

create table public.mapping_import_chunk (
  import_id uuid not null,
  file_name text not null,
  chunk_index integer not null,
  chunk_bytes bytea not null,
  byte_count integer not null,
  chunk_sha256 text not null,
  received_at timestamptz not null default transaction_timestamp(),
  received_by uuid not null references public.account(account_id) on delete restrict,
  primary key (import_id,file_name,chunk_index),
  constraint mapping_import_chunk_file_fkey foreign key (import_id,file_name)
    references public.mapping_import_file(import_id,file_name) on delete restrict,
  constraint mapping_import_chunk_index_check check (chunk_index between 0 and 63),
  constraint mapping_import_chunk_bytes_check check (
    byte_count between 1 and 65536 and octet_length(chunk_bytes)=byte_count),
  constraint mapping_import_chunk_hash_check check (
    chunk_sha256 ~ '^[0-9a-f]{64}$' and chunk_sha256=encode(sha256(chunk_bytes),'hex'))
);

create table public.mapping_import_report (
  report_id uuid primary key default pg_catalog.gen_random_uuid(),
  import_id uuid not null references public.mapping_import(import_id) on delete restrict,
  release_revision integer not null,
  package_digest text not null,
  validator_version text not null,
  baseline_publication_revision integer not null default 0,
  live_dependency_digest text,
  failure_classification text,
  summary jsonb not null,
  entries jsonb not null,
  report_hash text not null,
  created_at timestamptz not null default transaction_timestamp(),
  created_by uuid not null references public.account(account_id) on delete restrict,
  constraint mapping_import_report_import_key unique (import_id,report_id),
  constraint mapping_import_report_revision_check check (
    release_revision > 0 and baseline_publication_revision >= 0),
  constraint mapping_import_report_hash_check check (
    package_digest ~ '^[0-9a-f]{64}$' and report_hash ~ '^[0-9a-f]{64}$' and
    (live_dependency_digest is null or live_dependency_digest ~ '^[0-9a-f]{64}$')),
  constraint mapping_import_report_validator_check check (
    length(validator_version) between 1 and 100 and validator_version ~ '^[A-Za-z0-9._:-]+$'),
  constraint mapping_import_report_failure_check check (
    failure_classification is null or failure_classification in ('package','live_dependency','execution')),
  constraint mapping_import_report_payload_check check (
    jsonb_typeof(summary)='object' and octet_length(summary::text) <= 8192 and
    jsonb_typeof(entries)='array' and jsonb_array_length(entries) <= 2000 and
    octet_length(entries::text) <= 262144)
);

alter table public.mapping_import add constraint mapping_import_current_report_fkey
  foreign key (import_id,current_report_id)
  references public.mapping_import_report(import_id,report_id) on delete restrict;

create unique index mapping_import_active_release_key on public.mapping_import(release_id)
  where state in ('receiving','sealed','validated');
create index mapping_import_release_state_idx on public.mapping_import(release_id,state,created_at,import_id);
create index mapping_import_actor_idx on public.mapping_import(actor_account_id,created_at,import_id);
create index mapping_import_scope_idx on public.mapping_import(site_id,area_id,state,import_id);
create index mapping_import_current_report_idx on public.mapping_import(current_report_id) where current_report_id is not null;
create index mapping_import_file_import_idx on public.mapping_import_file(import_id,file_name);
create index mapping_import_chunk_assembly_idx on public.mapping_import_chunk(import_id,file_name,chunk_index);
create index mapping_import_chunk_sum_idx on public.mapping_import_chunk(import_id,file_name,byte_count);
create index mapping_import_chunk_actor_idx on public.mapping_import_chunk(received_by,received_at);
create index mapping_import_report_import_time_idx on public.mapping_import_report(import_id,created_at,report_id);
create index mapping_import_report_actor_idx on public.mapping_import_report(created_by,created_at);

alter table public.mapping_import enable row level security;
alter table public.mapping_import_file enable row level security;
alter table public.mapping_import_chunk enable row level security;
alter table public.mapping_import_report enable row level security;

revoke all on public.mapping_import, public.mapping_import_file, public.mapping_import_chunk,
  public.mapping_import_report from public, anon, authenticated, service_role;
grant select on public.mapping_import, public.mapping_import_file, public.mapping_import_chunk,
  public.mapping_import_report to authenticated;
create policy mapping_import_admin_read on public.mapping_import for select to authenticated using (public.is_active_admin());
create policy mapping_import_file_admin_read on public.mapping_import_file for select to authenticated using (public.is_active_admin());
create policy mapping_import_chunk_admin_read on public.mapping_import_chunk for select to authenticated using (public.is_active_admin());
create policy mapping_import_report_admin_read on public.mapping_import_report for select to authenticated using (public.is_active_admin());

-- The common receipt remains strict while gaining bounded import response keys/states.
alter table gis_private.gis_mutation_request drop constraint gis_request_response_check;
alter table gis_private.gis_mutation_request add constraint gis_request_response_check check (response is null or (
  jsonb_typeof(response)='object' and octet_length(response::text) <= 8192 and
  response - array[
    'schemaVersion','id','revision','state','requestId','count','digest',
    'importId','releaseId','rootRequestId','operationId','packageDigest',
    'baseRevision','targetRevision','currentReleaseRevision','fileCount',
    'receivedChunkCount','receivedBytes','missingChunkCount'
  ] = '{}'::jsonb and
  response ?& array['schemaVersion','id','revision','state','requestId'] and
  response->'schemaVersion' = '1'::jsonb and
  jsonb_typeof(response->'id')='string' and length(response->>'id') between 1 and 100 and
  jsonb_typeof(response->'revision')='number' and response->>'revision' ~ '^[1-9][0-9]{0,9}$' and
  (response->>'revision')::numeric <= 2147483647 and
  jsonb_typeof(response->'state')='string' and response->>'state' in (
    'draft','staged','validated','approved','published','superseded','rejected','accepted','retired',
    'receiving','sealed','invalid','finalized','abandoned') and
  jsonb_typeof(response->'requestId')='string' and
  response->>'requestId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and
  (not (response ? 'count') or (jsonb_typeof(response->'count')='number' and response->>'count' ~ '^[0-9]{1,9}$')) and
  (not (response ? 'digest') or (jsonb_typeof(response->'digest')='string' and response->>'digest' ~ '^[0-9a-f]{64}$')) and
  (not (response ? 'packageDigest') or (jsonb_typeof(response->'packageDigest')='string' and response->>'packageDigest' ~ '^[0-9a-f]{64}$')) and
  (not (response ? 'importId') or (jsonb_typeof(response->'importId')='string' and response->>'importId' ~ '^[0-9a-f-]{36}$')) and
  (not (response ? 'releaseId') or (jsonb_typeof(response->'releaseId')='string' and response->>'releaseId' ~ '^[0-9a-f-]{36}$')) and
  (not (response ? 'rootRequestId') or (jsonb_typeof(response->'rootRequestId')='string' and response->>'rootRequestId' ~ '^[0-9a-f-]{36}$')) and
  (not (response ? 'operationId') or (jsonb_typeof(response->'operationId')='string' and response->>'operationId' ~ '^[0-9a-f-]{36}$')) and
  (not (response ? 'baseRevision') or (jsonb_typeof(response->'baseRevision')='number' and response->>'baseRevision' ~ '^[1-9][0-9]{0,9}$')) and
  (not (response ? 'targetRevision') or (jsonb_typeof(response->'targetRevision')='number' and response->>'targetRevision' ~ '^[1-9][0-9]{0,9}$')) and
  (not (response ? 'currentReleaseRevision') or (jsonb_typeof(response->'currentReleaseRevision')='number' and response->>'currentReleaseRevision' ~ '^[1-9][0-9]{0,9}$')) and
  (not (response ? 'fileCount') or (jsonb_typeof(response->'fileCount')='number' and response->>'fileCount' ~ '^[0-9]{1,9}$')) and
  (not (response ? 'receivedChunkCount') or (jsonb_typeof(response->'receivedChunkCount')='number' and response->>'receivedChunkCount' ~ '^[0-9]{1,9}$')) and
  (not (response ? 'receivedBytes') or (jsonb_typeof(response->'receivedBytes')='number' and response->>'receivedBytes' ~ '^[0-9]{1,9}$')) and
  (not (response ? 'missingChunkCount') or (jsonb_typeof(response->'missingChunkCount')='number' and response->>'missingChunkCount' ~ '^[0-9]{1,9}$'))
));

create function gis_private.decode_strict_base64(p_value text,p_max_bytes integer) returns bytea
language plpgsql immutable security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare decoded bytea;
begin
  if p_value is null or p_max_bytes is null or p_max_bytes < 1 or
     length(p_value) > 87384 or p_value !~ '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$' then
    raise exception 'Invalid canonical base64 payload';
  end if;
  begin decoded := decode(p_value,'base64');
  exception when others then raise exception 'Invalid canonical base64 payload'; end;
  if octet_length(decoded) < 1 or octet_length(decoded) > p_max_bytes or
     replace(encode(decoded,'base64'),E'\n','') <> p_value then
    raise exception 'Decoded payload exceeds its bounded limit or is not canonical';
  end if;
  return decoded;
end $$;

create function gis_private.json_walk(p_value json) returns table(value json,depth integer)
language sql immutable security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
  with recursive walk(value,depth) as (
    select p_value,0
    union all
    select child.value,walk.depth+1
    from walk
    cross join lateral (
      select object_value.value
      from pg_catalog.json_each(case when pg_catalog.json_typeof(walk.value)='object' then walk.value else '{}'::json end) object_value
      union all
      select array_value.value
      from pg_catalog.json_array_elements(case when pg_catalog.json_typeof(walk.value)='array' then walk.value else '[]'::json end) array_value
    ) child
  )
  select value,depth from walk
$$;

create function gis_private.strict_json(p_bytes bytea) returns jsonb
language plpgsql immutable security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare raw_text text; parsed json; node_count bigint; max_depth integer; number_text text;
begin
  if p_bytes is null then raise exception 'Strict JSON bytes are required'; end if;
  if substring(p_bytes from 1 for 3)=decode('efbbbf','hex') then raise exception 'JSON BOM is forbidden'; end if;
  begin raw_text := convert_from(p_bytes,'UTF8');
  exception when character_not_in_repertoire then raise exception 'Invalid UTF-8 JSON'; end;
  begin parsed := raw_text::json;
  exception when others then raise exception 'Malformed JSON'; end;

  select count(*),max(depth) into node_count,max_depth from gis_private.json_walk(parsed);
  if node_count > 500000 then raise exception 'JSON node limit exceeded'; end if;
  if max_depth > 32 then raise exception 'JSON depth limit exceeded'; end if;
  if exists (
    select 1 from gis_private.json_walk(parsed) walked
    where pg_catalog.json_typeof(walked.value)='object' and exists (
      select 1 from pg_catalog.json_each(walked.value) member
      group by member.key collate "C" having count(*)>1
    )
  ) then raise exception 'Duplicate decoded JSON key'; end if;
  if exists (
    select 1 from gis_private.json_walk(parsed) walked
    where pg_catalog.json_typeof(walked.value)='string' and length(walked.value#>>'{}')>8192
  ) then raise exception 'JSON string limit exceeded'; end if;
  for number_text in
    select walked.value#>>'{}' from gis_private.json_walk(parsed) walked
    where pg_catalog.json_typeof(walked.value)='number'
  loop
    begin perform number_text::double precision;
    exception when numeric_value_out_of_range then raise exception 'Nonfinite JSON number'; end;
  end loop;
  begin return parsed::jsonb;
  exception when others then raise exception 'JSON value cannot be represented safely'; end;
end $$;

create function gis_private.json_node_count(p_value jsonb) returns bigint
language sql immutable security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
  select count(*) from gis_private.json_walk(p_value::json)
$$;

create function gis_private.package_digest(p_manifest_bytes bytea,p_files jsonb) returns text
language plpgsql immutable security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare lines text;
begin
  if p_manifest_bytes is null or pg_catalog.jsonb_typeof(p_files)<>'array' then
    raise exception 'Invalid package digest inputs';
  end if;
  select pg_catalog.string_agg(((elements.value::jsonb)->>'name')||E'\t'||
    ((elements.value::jsonb)->>'sha256')||E'\n',''
    order by ((elements.value::jsonb)->>'name') collate "C")
    into lines from pg_catalog.jsonb_array_elements(p_files) as elements(value);
  return encode(sha256(convert_to(E'GraveNavGISPackage/v1\n','UTF8')||p_manifest_bytes||
    convert_to(E'\n','UTF8')||convert_to(coalesce(lines,''),'UTF8')),'hex');
end $$;

create function gis_private.assert_import_manifest(
  p_manifest jsonb,p_manifest_bytes bytea,p_package_digest text,
  p_site_id bigint,p_area_id bigint,p_release_code text
) returns void language plpgsql stable security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare entry jsonb; names text[] := array[]::text[]; declared_total bigint := octet_length(p_manifest_bytes);
  expected text[] := array[
    'cemetery_boundary.geojson','garden_sections.geojson','roads_walkways.geojson','grave_plots.geojson',
    'grave_access_points.geojson','route_nodes.geojson','route_edges.geojson','landmarks.geojson',
    'survey_points.json','survey_captures.json','survey_observations.json','georeferencing_runs.json',
    'georeferencing_run_points.json','georeferencing_validation.json'];
begin
  if octet_length(p_manifest_bytes)>65536 or p_package_digest !~ '^[0-9a-f]{64}$' or
     pg_catalog.jsonb_typeof(p_manifest)<>'object' or
     not (p_manifest ?& array['schema_version','package_id','site_id','pilot_area_id','release_code','title','description',
       'source_plan','crs','exported_at','qgis_version','selected_run_code','pilot_lot_ids','provenance_notes','limitations','files']) or
     p_manifest - array['schema_version','package_id','site_id','pilot_area_id','release_code','title','description',
       'source_plan','crs','exported_at','qgis_version','selected_run_code','pilot_lot_ids','provenance_notes','limitations','files'] <> '{}'::jsonb or
     p_manifest->'schema_version'<>'1'::jsonb or
     p_manifest->>'site_id'<>p_site_id::text or p_manifest->>'pilot_area_id'<>p_area_id::text or
     p_manifest->>'release_code'<>p_release_code or
     p_manifest->'crs'<>jsonb_build_object('field',4326,'working',32651,'export',4326) or
     pg_catalog.jsonb_typeof(p_manifest->'files')<>'array' or jsonb_array_length(p_manifest->'files')<>14 then
    raise exception 'Manifest violates the pilot package contract';
  end if;
  if pg_catalog.jsonb_typeof(p_manifest->'source_plan')<>'object' or
     not ((p_manifest->'source_plan') ?& array['reference','version','sha256','coordinate_space']) or
     (p_manifest->'source_plan') - array['reference','version','sha256','coordinate_space'] <> '{}'::jsonb or
     p_manifest->'source_plan'->>'sha256' !~ '^[0-9a-f]{64}$' then
    raise exception 'Manifest source plan is invalid';
  end if;
  for entry in select value from pg_catalog.jsonb_array_elements(p_manifest->'files') loop
    if pg_catalog.jsonb_typeof(entry)<>'object' or
       not (entry ?& array['name','sha256','bytes','feature_count','layer_version']) or
       entry - array['name','sha256','bytes','feature_count','layer_version'] <> '{}'::jsonb or
       not ((entry->>'name')=any(expected)) or entry->>'sha256' !~ '^[0-9a-f]{64}$' or
       entry->>'bytes' !~ '^(0|[1-9][0-9]{0,7})$' or (entry->>'bytes')::numeric>4194304 or
       entry->>'feature_count' !~ '^(0|[1-9][0-9]{0,5})$' or (entry->>'feature_count')::numeric>20000 or
       entry->>'layer_version' !~ '^[A-Za-z0-9._:-]{1,100}$' then
      raise exception 'Manifest file declaration is invalid';
    end if;
    if (entry->>'name')=any(names) then raise exception 'Manifest file names must be unique'; end if;
    names := array_append(names,entry->>'name');
    declared_total := declared_total+(entry->>'bytes')::integer;
  end loop;
  if not (expected <@ names and names <@ expected) or declared_total>8388608 then
    raise exception 'Manifest file set or package byte total is invalid';
  end if;
  if gis_private.package_digest(p_manifest_bytes,p_manifest->'files')<>p_package_digest then
    raise exception 'Package digest mismatch';
  end if;
end $$;

create function gis_private.assemble_import_file(p_import_id uuid,p_file_name text) returns bytea
language sql stable security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
  select decode(coalesce(pg_catalog.string_agg(encode(chunk_bytes,'hex'),'' order by chunk_index),''),'hex')
  from public.mapping_import_chunk where import_id=p_import_id and file_name=p_file_name
$$;

create function gis_private.guard_mapping_import() returns trigger
language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare owner_name name; operation text; pending_count integer; allowed boolean := false;
begin
  select pg_get_userbyid(relowner) into owner_name from pg_class where oid=tg_relid;
  if current_user<>owner_name then raise exception 'A protected owner import operation is required' using errcode='42501'; end if;
  perform gis_private.assert_admin();
  select count(*),min(request.operation) into pending_count,operation
  from gis_private.gis_mutation_request request
  where request.actor_account_id=auth.uid() and request.response is null and request.created_at=transaction_timestamp();
  if pending_count<>1 then raise exception 'A protected pending import operation is required' using errcode='42501'; end if;
  if tg_op='DELETE' then raise exception 'Import evidence is retained and cannot be deleted'; end if;
  if tg_op='INSERT' then
    if operation<>'staff_begin_mapping_import' or new.state<>'receiving' or new.revision<>1 or
       new.actor_account_id is distinct from auth.uid() then raise exception 'Invalid import creation'; end if;
    return new;
  end if;
  if (new.import_id,new.request_id,new.actor_account_id,new.release_id,new.site_id,new.area_id,
      new.base_revision,new.target_revision,new.package_digest,new.manifest_sha256,new.validator_version,new.created_at)
     is distinct from
     (old.import_id,old.request_id,old.actor_account_id,old.release_id,old.site_id,old.area_id,
      old.base_revision,old.target_revision,old.package_digest,old.manifest_sha256,old.validator_version,old.created_at) then
    raise exception 'Import identity and accepted bytes are immutable';
  end if;
  if new.revision<>old.revision+1 then raise exception 'Import mutation must increment revision exactly once'; end if;
  allowed :=
    (old.state='receiving' and new.state in ('sealed','invalid') and operation='staff_seal_mapping_import') or
    (old.state in ('receiving','sealed','invalid','validated') and new.state='abandoned' and operation='staff_abandon_mapping_import') or
    (old.state='sealed' and new.state in ('validated','invalid') and operation='staff_validate_mapping_import') or
    (old.state='invalid' and new.state in ('invalid','validated') and operation='staff_validate_mapping_import') or
    (old.state='validated' and new.state in ('validated','invalid') and operation in ('staff_validate_mapping_import','staff_finalize_mapping_import')) or
    (old.state='validated' and new.state='finalized' and operation='staff_finalize_mapping_import');
  if not allowed then raise exception 'Forbidden import state transition or owning operation'; end if;
  if new.state='abandoned' and (new.abandon_reason is null or btrim(new.abandon_reason)='') then
    raise exception 'Abandonment reason is required';
  end if;
  new.updated_at := transaction_timestamp();
  return new;
end $$;

create function gis_private.guard_import_evidence() returns trigger
language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare owner_name name; import_row public.mapping_import; operation text; pending_count integer;
begin
  select pg_get_userbyid(relowner) into owner_name from pg_class where oid=tg_relid;
  if current_user<>owner_name then raise exception 'A protected owner evidence operation is required' using errcode='42501'; end if;
  perform gis_private.assert_admin();
  if tg_op<>'INSERT' then raise exception 'Import file, chunk, and report evidence is append-only'; end if;
  select * into import_row from public.mapping_import where import_id=new.import_id for update;
  if not found or import_row.actor_account_id is distinct from auth.uid() then raise exception 'Import actor binding mismatch'; end if;
  if tg_table_name='mapping_import_file' then
    select count(*),min(request.operation) into pending_count,operation from gis_private.gis_mutation_request request
    where request.actor_account_id=auth.uid() and request.response is null and request.created_at=transaction_timestamp();
    if import_row.state<>'receiving' or pending_count<>1 or operation<>'staff_begin_mapping_import' then
      raise exception 'Files may be declared only by protected begin'; end if;
  elsif tg_table_name='mapping_import_chunk' then
    if import_row.state<>'receiving' or new.received_by is distinct from auth.uid() then
      raise exception 'Chunks may be appended only to the importing actor receiving state'; end if;
  elsif tg_table_name='mapping_import_report' then
    select count(*),min(request.operation) into pending_count,operation from gis_private.gis_mutation_request request
    where request.actor_account_id=auth.uid() and request.response is null and request.created_at=transaction_timestamp();
    if pending_count<>1 or operation not in ('staff_seal_mapping_import','staff_validate_mapping_import','staff_finalize_mapping_import') or
       new.created_by is distinct from auth.uid() or new.package_digest<>import_row.package_digest then
      raise exception 'Reports require a protected bound import operation'; end if;
  end if;
  return new;
end $$;

create trigger mapping_import_guard before insert or update or delete on public.mapping_import
  for each row execute function gis_private.guard_mapping_import();
create trigger mapping_import_file_guard before insert or update or delete on public.mapping_import_file
  for each row execute function gis_private.guard_import_evidence();
create trigger mapping_import_chunk_guard before insert or update or delete on public.mapping_import_chunk
  for each row execute function gis_private.guard_import_evidence();
create trigger mapping_import_report_guard before insert or update or delete on public.mapping_import_report
  for each row execute function gis_private.guard_import_evidence();

-- Extend the existing bounded audit helper with import transition metadata only.
create or replace function gis_private.audit_event(p_entity text,p_id text,p_action text,p_old_meta jsonb,p_new_meta jsonb) returns void
language plpgsql security invoker
set search_path = pg_catalog, extensions, pg_temp as $$
declare safe_old jsonb; safe_new jsonb;
begin
  perform gis_private.assert_admin();
  if p_entity not in ('mapping_release','mapping_release_area','mapping_publication','mapping_publication_event','mapping_import') or
     p_action not in ('insert','update','approve','status_change') or length(p_id) not between 1 and 100 then
    raise exception 'Invalid GIS audit metadata';
  end if;
  select jsonb_object_agg(key,value) into safe_old from jsonb_each(coalesce(p_old_meta,'{}'::jsonb))
  where key=any(array['schemaVersion','id','revision','state','requestId','siteId','areaId','scopeKind','packageDigest',
    'importId','releaseId','rootRequestId','operationId','baseRevision','targetRevision','currentReleaseRevision',
    'fileCount','receivedChunkCount','receivedBytes','missingChunkCount'])
    and jsonb_typeof(value) in ('string','number','null') and octet_length(value::text)<=200;
  select jsonb_object_agg(key,value) into safe_new from jsonb_each(coalesce(p_new_meta,'{}'::jsonb))
  where key=any(array['schemaVersion','id','revision','state','requestId','siteId','areaId','scopeKind','packageDigest',
    'importId','releaseId','rootRequestId','operationId','baseRevision','targetRevision','currentReleaseRevision',
    'fileCount','receivedChunkCount','receivedBytes','missingChunkCount'])
    and jsonb_typeof(value) in ('string','number','null') and octet_length(value::text)<=200;
  insert into public.audit_log(actor_account_id,action,table_name,record_id,old_values,new_values)
    values(auth.uid(),p_action,p_entity,p_id,safe_old,safe_new);
end $$;

create function public.staff_begin_mapping_import(
  p_release_id uuid,p_expected_revision integer,p_request_id uuid,
  p_package_digest text,p_manifest_bytes_base64 text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, extensions, pg_temp as $$
declare actor uuid := auth.uid(); manifest_bytes bytea; manifest jsonb; release_row public.mapping_release;
  prior jsonb; result jsonb; import_uuid uuid; entry jsonb; manifest_hash text;
begin
  perform gis_private.assert_admin();
  if p_release_id is null or p_expected_revision is null or p_expected_revision<1 or p_request_id is null or
     p_package_digest !~ '^[0-9a-f]{64}$' or
     octet_length(coalesce(p_manifest_bytes_base64,''))+octet_length(coalesce(p_package_digest,''))+512>131072 then
    raise exception 'Invalid bounded import begin envelope';
  end if;
  manifest_bytes := gis_private.decode_strict_base64(p_manifest_bytes_base64,65536);
  manifest_hash := encode(sha256(manifest_bytes),'hex');
  manifest := gis_private.strict_json(manifest_bytes);
  prior := gis_private.claim_request(p_request_id,'staff_begin_mapping_import',jsonb_build_object(
    'releaseId',p_release_id::text,'expectedRevision',p_expected_revision,'packageDigest',p_package_digest,
    'manifestSha256',manifest_hash,'manifestBytes',octet_length(manifest_bytes)));
  if prior is not null then return prior; end if;
  select * into release_row from public.mapping_release where release_id=p_release_id for update;
  if not found then raise exception 'Release not found'; end if;
  if release_row.revision<>p_expected_revision then raise exception 'Stale release revision' using errcode='40001'; end if;
  if release_row.status not in ('draft','staged','validated') then raise exception 'Release cannot begin an import in its current state'; end if;
  perform gis_private.assert_pilot_scope(p_release_id);
  perform gis_private.assert_import_manifest(manifest,manifest_bytes,p_package_digest,
    release_row.site_id,release_row.pilot_area_id,release_row.release_code);

  insert into public.mapping_import(request_id,actor_account_id,release_id,site_id,area_id,
    base_revision,target_revision,package_digest,manifest_sha256)
  values(p_request_id,actor,p_release_id,release_row.site_id,release_row.pilot_area_id,
    p_expected_revision,p_expected_revision+1,p_package_digest,manifest_hash)
  returning import_id into import_uuid;

  insert into public.mapping_import_file(import_id,file_name,declared_sha256,declared_bytes,
    declared_feature_count,declared_chunk_count,layer_version)
  values(import_uuid,'manifest.json',manifest_hash,octet_length(manifest_bytes),1,1,null);
  for entry in select value from jsonb_array_elements(manifest->'files') loop
    insert into public.mapping_import_file(import_id,file_name,declared_sha256,declared_bytes,
      declared_feature_count,declared_chunk_count,layer_version)
    values(import_uuid,entry->>'name',entry->>'sha256',(entry->>'bytes')::integer,
      (entry->>'feature_count')::integer,
      case when (entry->>'bytes')::integer=0 then 0 else (((entry->>'bytes')::integer-1)/65536)+1 end,
      entry->>'layer_version');
  end loop;
  insert into public.mapping_import_chunk(import_id,file_name,chunk_index,chunk_bytes,byte_count,chunk_sha256,received_by)
  values(import_uuid,'manifest.json',0,manifest_bytes,octet_length(manifest_bytes),manifest_hash,actor);

  result := jsonb_build_object(
    'schemaVersion',1,'id',import_uuid::text,'importId',import_uuid::text,'releaseId',p_release_id::text,
    'revision',1,'state','receiving','requestId',p_request_id::text,'rootRequestId',p_request_id::text,
    'packageDigest',p_package_digest,'baseRevision',p_expected_revision,'targetRevision',p_expected_revision+1,
    'currentReleaseRevision',release_row.revision,'fileCount',15,'receivedChunkCount',1,
    'receivedBytes',octet_length(manifest_bytes),'missingChunkCount',(
      select sum(declared_chunk_count)::integer from public.mapping_import_file where import_id=import_uuid)-1);
  perform gis_private.audit_event('mapping_import',import_uuid::text,'insert',null,result);
  perform gis_private.finish_request(p_request_id,result);
  return result;
end $$;

create function public.staff_stage_mapping_import_chunk(
  p_import_id uuid,p_request_id uuid,p_package_digest text,p_expected_revision integer,
  p_file_name text,p_chunk_index integer,p_bytes_base64 text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, extensions, pg_temp as $$
declare actor uuid := auth.uid(); import_row public.mapping_import; file_row public.mapping_import_file;
  decoded bytea; decoded_hash text; existing public.mapping_import_chunk; file_chunks integer; file_bytes bigint;
  package_bytes bigint;
begin
  perform gis_private.assert_admin();
  if p_import_id is null or p_request_id is null or p_package_digest !~ '^[0-9a-f]{64}$' or
     p_expected_revision is null or p_expected_revision<1 or p_file_name is null or p_chunk_index is null or
     octet_length(coalesce(p_bytes_base64,''))+octet_length(coalesce(p_file_name,''))+1024>131072 then
    raise exception 'Invalid bounded chunk envelope';
  end if;
  decoded := gis_private.decode_strict_base64(p_bytes_base64,65536);
  decoded_hash := encode(sha256(decoded),'hex');
  select * into import_row from public.mapping_import where import_id=p_import_id for update;
  if not found then raise exception 'Import not found'; end if;
  if import_row.actor_account_id is distinct from actor then raise exception 'Only the original importing administrator may stage chunks'; end if;
  if import_row.request_id is distinct from p_request_id or import_row.package_digest<>p_package_digest or
     import_row.base_revision<>p_expected_revision then raise exception 'Import root request, digest, or revision binding mismatch'; end if;
  if import_row.state<>'receiving' then raise exception 'Accepted package bytes are immutable outside receiving state'; end if;
  perform gis_private.assert_pilot_scope(import_row.release_id);
  perform 1 from public.mapping_release where release_id=import_row.release_id and revision=p_expected_revision for share;
  if not found then raise exception 'Stale release revision' using errcode='40001'; end if;
  select * into file_row from public.mapping_import_file
    where import_id=p_import_id and file_name=p_file_name for update;
  if not found or p_file_name='manifest.json' then raise exception 'Unknown or immutable package file'; end if;
  if p_chunk_index<0 or p_chunk_index>=file_row.declared_chunk_count then raise exception 'Chunk index exceeds declared count'; end if;
  select * into existing from public.mapping_import_chunk
    where import_id=p_import_id and file_name=p_file_name and chunk_index=p_chunk_index;
  if found then
    if existing.chunk_sha256<>decoded_hash or existing.byte_count<>octet_length(decoded) or existing.chunk_bytes<>decoded then
      raise exception 'Chunk identity conflict; accepted bytes are immutable';
    end if;
  else
    select coalesce(sum(byte_count),0),count(*) into file_bytes,file_chunks from public.mapping_import_chunk
      where import_id=p_import_id and file_name=p_file_name;
    if file_bytes+octet_length(decoded)>file_row.declared_bytes then raise exception 'Chunk bytes exceed declared file size'; end if;
    select coalesce(sum(byte_count),0) into package_bytes from public.mapping_import_chunk where import_id=p_import_id;
    if package_bytes+octet_length(decoded)>8388608 then raise exception 'Package bytes exceed 8 MiB limit'; end if;
    insert into public.mapping_import_chunk(import_id,file_name,chunk_index,chunk_bytes,byte_count,chunk_sha256,received_by)
      values(p_import_id,p_file_name,p_chunk_index,decoded,octet_length(decoded),decoded_hash,actor);
  end if;
  select count(*)::integer,coalesce(sum(byte_count),0) into file_chunks,file_bytes
    from public.mapping_import_chunk where import_id=p_import_id and file_name=p_file_name;
  return jsonb_build_object(
    'schemaVersion',1,'id',p_import_id::text,'importId',p_import_id::text,'releaseId',import_row.release_id::text,
    'revision',import_row.revision,'state','receiving','requestId',p_request_id::text,
    'rootRequestId',p_request_id::text,'packageDigest',p_package_digest,
    'baseRevision',import_row.base_revision,'targetRevision',import_row.target_revision,
    'currentReleaseRevision',p_expected_revision,'fileName',p_file_name,'chunkIndex',p_chunk_index,
    'receivedChunkCount',file_chunks,'receivedBytes',file_bytes);
end $$;

create function public.staff_seal_mapping_import(
  p_import_id uuid,p_expected_revision integer,p_request_id uuid,p_operation_id uuid
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, extensions, pg_temp as $$
declare actor uuid := auth.uid(); import_row public.mapping_import; release_row public.mapping_release;
  prior jsonb; result jsonb; canonical jsonb; missing_count integer; received_count integer; received_bytes bigint;
  file_row public.mapping_import_file; assembled bytea; document jsonb; actual_count integer;
  total_nodes bigint := 0; membership_result_count integer := 0; package_valid boolean := true;
  report_uuid uuid; report_entries jsonb; report_summary jsonb; report_digest text; manifest jsonb;
begin
  perform gis_private.assert_admin();
  if p_import_id is null or p_expected_revision is null or p_expected_revision<1 or
     p_request_id is null or p_operation_id is null then raise exception 'Invalid seal identity'; end if;
  canonical := jsonb_build_object('importId',p_import_id::text,'expectedRevision',p_expected_revision,
    'rootRequestId',p_request_id::text,'operationId',p_operation_id::text);
  select * into import_row from public.mapping_import where import_id=p_import_id for update;
  if not found then raise exception 'Import not found'; end if;
  if import_row.actor_account_id is distinct from actor or import_row.request_id is distinct from p_request_id then
    raise exception 'Import actor or root request binding mismatch'; end if;
  perform gis_private.assert_pilot_scope(import_row.release_id);
  if import_row.state<>'receiving' then
    prior := gis_private.claim_request(p_operation_id,'staff_seal_mapping_import',canonical);
    if prior is not null then return prior; end if;
    raise exception 'Import is not in receiving state';
  end if;
  select count(*)::integer into missing_count
  from public.mapping_import_file file
  cross join lateral generate_series(0,file.declared_chunk_count-1) expected(chunk_index)
  left join public.mapping_import_chunk chunk on chunk.import_id=file.import_id and chunk.file_name=file.file_name and chunk.chunk_index=expected.chunk_index
  where file.import_id=p_import_id and chunk.import_id is null;
  select count(*)::integer,coalesce(sum(byte_count),0) into received_count,received_bytes
    from public.mapping_import_chunk where import_id=p_import_id;
  if missing_count>0 then
    return jsonb_build_object(
      'schemaVersion',1,'id',p_import_id::text,'importId',p_import_id::text,'releaseId',import_row.release_id::text,
      'revision',import_row.revision,'state','receiving','requestId',p_operation_id::text,
      'rootRequestId',p_request_id::text,'operationId',p_operation_id::text,'packageDigest',import_row.package_digest,
      'baseRevision',import_row.base_revision,'targetRevision',import_row.target_revision,
      'currentReleaseRevision',p_expected_revision,'fileCount',15,'receivedChunkCount',received_count,
      'receivedBytes',received_bytes,'missingChunkCount',missing_count);
  end if;
  prior := gis_private.claim_request(p_operation_id,'staff_seal_mapping_import',canonical);
  if prior is not null then return prior; end if;
  select * into release_row from public.mapping_release where release_id=import_row.release_id for update;
  if not found or release_row.revision<>p_expected_revision or import_row.base_revision<>p_expected_revision then
    raise exception 'Stale release revision' using errcode='40001'; end if;
  if release_row.status not in ('draft','staged','validated') then raise exception 'Release cannot be sealed in its current state'; end if;

  for file_row in select * from public.mapping_import_file where import_id=p_import_id order by file_name collate "C" loop
    assembled := gis_private.assemble_import_file(p_import_id,file_row.file_name);
    if octet_length(assembled)<>file_row.declared_bytes or encode(sha256(assembled),'hex')<>file_row.declared_sha256 then
      package_valid := false;
    else
      begin
        document := gis_private.strict_json(assembled);
        total_nodes := total_nodes+gis_private.json_node_count(document);
        if file_row.file_name='manifest.json' then
          manifest := document;
          actual_count := 1;
        elsif right(file_row.file_name,8)='.geojson' then
          if jsonb_typeof(document)<>'object' or document->>'type'<>'FeatureCollection' or jsonb_typeof(document->'features')<>'array' then
            package_valid := false; actual_count := -1;
          else actual_count := jsonb_array_length(document->'features'); end if;
        else
          if jsonb_typeof(document)<>'array' then package_valid := false; actual_count := -1;
          else actual_count := jsonb_array_length(document); end if;
        end if;
        if actual_count<>file_row.declared_feature_count then package_valid := false; end if;
        if file_row.file_name='cemetery_boundary.geojson' and actual_count<>1 then package_valid := false; end if;
        if file_row.file_name='garden_sections.geojson' and actual_count not between 1 and 50 then package_valid := false; end if;
        if file_row.file_name='roads_walkways.geojson' and actual_count not between 1 and 200 then package_valid := false; end if;
        if file_row.file_name in ('grave_plots.geojson','grave_access_points.geojson') and actual_count not between 1 and 50 then package_valid := false; end if;
        if file_row.file_name='route_nodes.geojson' and actual_count not between 1 and 200 then package_valid := false; end if;
        if file_row.file_name='route_edges.geojson' and actual_count not between 1 and 400 then package_valid := false; end if;
        if file_row.file_name='landmarks.geojson' and actual_count not between 0 and 100 then package_valid := false; end if;
        if file_row.file_name='survey_points.json' and actual_count not between 0 and 200 then package_valid := false; end if;
        if file_row.file_name='survey_captures.json' and actual_count not between 0 and 1000 then package_valid := false; end if;
        if file_row.file_name='survey_observations.json' and actual_count not between 0 and 20000 then package_valid := false; end if;
        if file_row.file_name='georeferencing_runs.json' and actual_count not between 0 and 20 then package_valid := false; end if;
        if file_row.file_name in ('georeferencing_run_points.json','georeferencing_validation.json') then
          membership_result_count := membership_result_count+greatest(actual_count,0);
        end if;
      exception when others then package_valid := false;
      end;
    end if;
  end loop;
  if total_nodes>1000000 or membership_result_count>4000 or manifest is null or
     gis_private.package_digest(gis_private.assemble_import_file(p_import_id,'manifest.json'),manifest->'files')<>import_row.package_digest then
    package_valid := false;
  end if;

  if not package_valid then
    report_entries := jsonb_build_array(jsonb_build_object('severity','ERROR','code','package_contract_invalid'));
    report_summary := jsonb_build_object('errorCount',1,'warningCount',0,'fileCount',15);
    report_digest := encode(sha256(convert_to(jsonb_build_object(
      'validatorVersion','gis-pilot-v1','importId',p_import_id::text,'packageDigest',import_row.package_digest,
      'summary',report_summary,'entries',report_entries)::text,'UTF8')),'hex');
    insert into public.mapping_import_report(import_id,release_revision,package_digest,validator_version,
      baseline_publication_revision,failure_classification,summary,entries,report_hash,created_by)
    values(p_import_id,p_expected_revision,import_row.package_digest,'gis-pilot-v1',0,'package',
      report_summary,report_entries,report_digest,actor) returning report_id into report_uuid;
    update public.mapping_import set state='invalid',revision=revision+1,failure_classification='package',
      current_report_id=report_uuid where import_id=p_import_id;
    result := jsonb_build_object(
      'schemaVersion',1,'id',p_import_id::text,'importId',p_import_id::text,'releaseId',import_row.release_id::text,
      'revision',import_row.revision+1,'state','invalid','requestId',p_operation_id::text,
      'rootRequestId',p_request_id::text,'operationId',p_operation_id::text,'packageDigest',import_row.package_digest,
      'baseRevision',import_row.base_revision,'targetRevision',import_row.target_revision,
      'currentReleaseRevision',release_row.revision,'fileCount',15,'receivedChunkCount',received_count,
      'receivedBytes',received_bytes,'missingChunkCount',0);
  else
    perform gis_private.assert_import_manifest(manifest,gis_private.assemble_import_file(p_import_id,'manifest.json'),
      import_row.package_digest,release_row.site_id,release_row.pilot_area_id,release_row.release_code);
    update public.mapping_release set
      status='staged',revision=revision+1,package_reference='gis-package:'||import_row.package_digest,
      package_hash=import_row.package_digest,source_plan_reference=manifest->'source_plan'->>'reference',
      source_plan_version=manifest->'source_plan'->>'version',source_plan_hash=manifest->'source_plan'->>'sha256',
      source_coordinate_space=manifest->'source_plan'->>'coordinate_space',field_srid=(manifest->'crs'->>'field')::integer,
      working_srid=(manifest->'crs'->>'working')::integer,published_srid=(manifest->'crs'->>'export')::integer,
      qgis_version=manifest->>'qgis_version',staged_at=transaction_timestamp(),staged_by=actor
    where release_id=import_row.release_id;
    update public.mapping_import set state='sealed',revision=revision+1,sealed_at=transaction_timestamp(),
      failure_classification=null where import_id=p_import_id;
    result := jsonb_build_object(
      'schemaVersion',1,'id',p_import_id::text,'importId',p_import_id::text,'releaseId',import_row.release_id::text,
      'revision',import_row.revision+1,'state','sealed','requestId',p_operation_id::text,
      'rootRequestId',p_request_id::text,'operationId',p_operation_id::text,'packageDigest',import_row.package_digest,
      'baseRevision',import_row.base_revision,'targetRevision',import_row.target_revision,
      'currentReleaseRevision',import_row.target_revision,'fileCount',15,'receivedChunkCount',received_count,
      'receivedBytes',received_bytes,'missingChunkCount',0);
  end if;
  perform gis_private.audit_event('mapping_import',p_import_id::text,'status_change',
    jsonb_build_object('schemaVersion',1,'id',p_import_id::text,'revision',import_row.revision,'state',import_row.state),result);
  perform gis_private.finish_request(p_operation_id,result);
  return result;
end $$;

create function public.staff_abandon_mapping_import(
  p_import_id uuid,p_expected_revision integer,p_reason text,p_request_id uuid,p_operation_id uuid
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, extensions, pg_temp as $$
declare actor uuid := auth.uid(); import_row public.mapping_import; release_row public.mapping_release;
  prior jsonb; result jsonb; canonical jsonb; reason text := btrim(p_reason);
begin
  perform gis_private.assert_admin();
  if p_import_id is null or p_expected_revision is null or p_expected_revision<1 or p_request_id is null or
     p_operation_id is null or reason is null or length(reason) not between 1 and 2000 or
     octet_length(coalesce(p_reason,''))+512>131072 then raise exception 'Invalid bounded abandonment request'; end if;
  canonical := jsonb_build_object('importId',p_import_id::text,'expectedRevision',p_expected_revision,
    'rootRequestId',p_request_id::text,'operationId',p_operation_id::text,'reason',reason);
  prior := gis_private.claim_request(p_operation_id,'staff_abandon_mapping_import',canonical);
  if prior is not null then return prior; end if;
  select * into import_row from public.mapping_import where import_id=p_import_id for update;
  if not found then raise exception 'Import not found'; end if;
  if import_row.actor_account_id is distinct from actor or import_row.request_id is distinct from p_request_id then
    raise exception 'Import actor or root request binding mismatch'; end if;
  select * into release_row from public.mapping_release where release_id=import_row.release_id for update;
  if not found or release_row.revision<>p_expected_revision then raise exception 'Stale release revision' using errcode='40001'; end if;
  if import_row.state not in ('receiving','sealed','invalid','validated') then raise exception 'Import is terminal or cannot be abandoned'; end if;
  update public.mapping_import set state='abandoned',revision=revision+1,abandon_reason=reason,
    abandoned_at=transaction_timestamp() where import_id=p_import_id;
  result := jsonb_build_object(
    'schemaVersion',1,'id',p_import_id::text,'importId',p_import_id::text,'releaseId',import_row.release_id::text,
    'revision',import_row.revision+1,'state','abandoned','requestId',p_operation_id::text,
    'rootRequestId',p_request_id::text,'operationId',p_operation_id::text,'packageDigest',import_row.package_digest,
    'baseRevision',import_row.base_revision,'targetRevision',import_row.target_revision,
    'currentReleaseRevision',release_row.revision,'fileCount',15);
  perform gis_private.audit_event('mapping_import',p_import_id::text,'status_change',
    jsonb_build_object('schemaVersion',1,'id',p_import_id::text,'revision',import_row.revision,'state',import_row.state),result);
  perform gis_private.finish_request(p_operation_id,result);
  return result;
end $$;

create function public.staff_mapping_import_status(
  p_import_id uuid,p_report_page integer default 1,p_report_page_size integer default 100
) returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, extensions, pg_temp as $$
declare import_row public.mapping_import; missing jsonb; report_json jsonb; report_entries jsonb;
  received_count integer; received_bytes bigint;
begin
  perform gis_private.assert_admin();
  if p_import_id is null or p_report_page not between 1 and 100000 or p_report_page_size not between 1 and 200 then
    raise exception 'Invalid bounded import status page'; end if;
  select * into import_row from public.mapping_import where import_id=p_import_id;
  if not found then raise exception 'Import not found'; end if;
  select count(*)::integer,coalesce(sum(byte_count),0) into received_count,received_bytes
    from public.mapping_import_chunk where import_id=p_import_id;
  select coalesce(jsonb_agg(jsonb_build_object('fileName',missing_file.file_name,'indexes',missing_file.indexes)
    order by missing_file.file_name collate "C"),'[]'::jsonb) into missing
  from (
    select file.file_name,jsonb_agg(expected.chunk_index order by expected.chunk_index) indexes
    from public.mapping_import_file file
    cross join lateral generate_series(0,file.declared_chunk_count-1) expected(chunk_index)
    left join public.mapping_import_chunk chunk on chunk.import_id=file.import_id and chunk.file_name=file.file_name and chunk.chunk_index=expected.chunk_index
    where file.import_id=p_import_id and chunk.import_id is null group by file.file_name
  ) missing_file;
  if import_row.current_report_id is not null then
    select coalesce(jsonb_agg(entry.value order by entry.ordinality),'[]'::jsonb) into report_entries
    from public.mapping_import_report report
    cross join lateral jsonb_array_elements(report.entries) with ordinality entry(value,ordinality)
    where report.report_id=import_row.current_report_id and
      entry.ordinality>((p_report_page-1)*p_report_page_size) and
      entry.ordinality<=p_report_page*p_report_page_size;
    select jsonb_build_object('reportId',report_id::text,'validatorVersion',validator_version,
      'failureClassification',failure_classification,'summary',summary,'reportHash',report_hash,
      'page',p_report_page,'pageSize',p_report_page_size,'entries',coalesce(report_entries,'[]'::jsonb))
      into report_json from public.mapping_import_report where report_id=import_row.current_report_id;
  end if;
  return jsonb_build_object(
    'schemaVersion',1,'importId',import_row.import_id::text,'releaseId',import_row.release_id::text,
    'rootRequestId',import_row.request_id::text,'packageDigest',import_row.package_digest,
    'state',import_row.state,'revision',import_row.revision,'baseRevision',import_row.base_revision,
    'targetRevision',import_row.target_revision,'fileCount',15,'receivedChunkCount',received_count,
    'receivedBytes',received_bytes,'missingChunkCount',jsonb_array_length(missing),
    'missingChunks',missing,'report',report_json);
end $$;

revoke all on all functions in schema gis_private from public, anon, authenticated, service_role;
revoke all on function public.staff_begin_mapping_import(uuid,integer,uuid,text,text),
  public.staff_stage_mapping_import_chunk(uuid,uuid,text,integer,text,integer,text),
  public.staff_seal_mapping_import(uuid,integer,uuid,uuid),
  public.staff_abandon_mapping_import(uuid,integer,text,uuid,uuid),
  public.staff_mapping_import_status(uuid,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.staff_begin_mapping_import(uuid,integer,uuid,text,text),
  public.staff_stage_mapping_import_chunk(uuid,uuid,text,integer,text,integer,text),
  public.staff_seal_mapping_import(uuid,integer,uuid,uuid),
  public.staff_abandon_mapping_import(uuid,integer,text,uuid,uuid),
  public.staff_mapping_import_status(uuid,integer,integer)
  to authenticated;

comment on table public.mapping_import is 'Protected pilot GIS import identity and transport state; not publication authority.';
comment on table public.mapping_import_chunk is 'Append-only private raw package chunks; never projected by public RPCs or audit.';
comment on function public.staff_mapping_import_status(uuid,integer,integer) is 'ADMIN-only bounded status projection; excludes raw package bytes and private reasons.';

commit;
