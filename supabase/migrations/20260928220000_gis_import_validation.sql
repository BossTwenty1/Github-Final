begin;

-- M07: deterministic server-side dry-run and atomic installation of one
-- reviewed pilot snapshot. This migration does not approve or publish a release.

alter table gis_private.gis_mutation_request drop constraint gis_request_response_check;
alter table gis_private.gis_mutation_request add constraint gis_request_response_check check (response is null or (
  jsonb_typeof(response)='object' and octet_length(response::text)<=8192 and
  response - array[
    'schemaVersion','id','revision','state','requestId','count','digest','reportId','reportDigest',
    'importId','releaseId','rootRequestId','operationId','packageDigest','baseRevision','targetRevision',
    'currentReleaseRevision','fileCount','receivedChunkCount','receivedBytes','missingChunkCount'
  ]='{}'::jsonb and
  response ?& array['schemaVersion','id','revision','state','requestId'] and
  response->'schemaVersion'='1'::jsonb and jsonb_typeof(response->'id')='string' and
  length(response->>'id') between 1 and 100 and jsonb_typeof(response->'revision')='number' and
  response->>'revision' ~ '^[1-9][0-9]{0,9}$' and (response->>'revision')::numeric<=2147483647 and
  jsonb_typeof(response->'state')='string' and response->>'state' in (
    'draft','staged','validated','approved','published','superseded','rejected','accepted','retired',
    'receiving','sealed','invalid','finalized','abandoned') and
  jsonb_typeof(response->'requestId')='string' and
  response->>'requestId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and
  (not(response?'count') or (jsonb_typeof(response->'count')='number' and response->>'count' ~ '^[0-9]{1,9}$')) and
  (not(response?'digest') or (jsonb_typeof(response->'digest')='string' and response->>'digest' ~ '^[0-9a-f]{64}$')) and
  (not(response?'reportDigest') or (jsonb_typeof(response->'reportDigest')='string' and response->>'reportDigest' ~ '^[0-9a-f]{64}$')) and
  (not(response?'reportId') or (jsonb_typeof(response->'reportId')='string' and response->>'reportId' ~ '^[0-9a-f-]{36}$')) and
  (not(response?'packageDigest') or (jsonb_typeof(response->'packageDigest')='string' and response->>'packageDigest' ~ '^[0-9a-f]{64}$')) and
  (not(response?'importId') or (jsonb_typeof(response->'importId')='string' and response->>'importId' ~ '^[0-9a-f-]{36}$')) and
  (not(response?'releaseId') or (jsonb_typeof(response->'releaseId')='string' and response->>'releaseId' ~ '^[0-9a-f-]{36}$')) and
  (not(response?'rootRequestId') or (jsonb_typeof(response->'rootRequestId')='string' and response->>'rootRequestId' ~ '^[0-9a-f-]{36}$')) and
  (not(response?'operationId') or (jsonb_typeof(response->'operationId')='string' and response->>'operationId' ~ '^[0-9a-f-]{36}$')) and
  (not(response?'baseRevision') or (jsonb_typeof(response->'baseRevision')='number' and response->>'baseRevision' ~ '^[1-9][0-9]{0,9}$')) and
  (not(response?'targetRevision') or (jsonb_typeof(response->'targetRevision')='number' and response->>'targetRevision' ~ '^[1-9][0-9]{0,9}$')) and
  (not(response?'currentReleaseRevision') or (jsonb_typeof(response->'currentReleaseRevision')='number' and response->>'currentReleaseRevision' ~ '^[1-9][0-9]{0,9}$')) and
  (not(response?'fileCount') or (jsonb_typeof(response->'fileCount')='number' and response->>'fileCount' ~ '^[0-9]{1,9}$')) and
  (not(response?'receivedChunkCount') or (jsonb_typeof(response->'receivedChunkCount')='number' and response->>'receivedChunkCount' ~ '^[0-9]{1,9}$')) and
  (not(response?'receivedBytes') or (jsonb_typeof(response->'receivedBytes')='number' and response->>'receivedBytes' ~ '^[0-9]{1,9}$')) and
  (not(response?'missingChunkCount') or (jsonb_typeof(response->'missingChunkCount')='number' and response->>'missingChunkCount' ~ '^[0-9]{1,9}$'))
));

-- Extend the bounded audit surface for the import lifecycle introduced by M06/M07.
-- The projection remains metadata-only and never includes raw package bytes or evidence.
create or replace function gis_private.audit_event(
  p_entity text,p_id text,p_action text,p_old_meta jsonb,p_new_meta jsonb
) returns void language plpgsql security invoker
set search_path=pg_catalog,extensions,pg_temp as $$
declare safe_old jsonb; safe_new jsonb;
begin
  perform gis_private.assert_admin();
  if p_entity not in ('mapping_release','mapping_release_area','mapping_publication','mapping_publication_event','mapping_import') or
     p_action not in ('insert','update','approve','status_change') or length(p_id) not between 1 and 100 then
    raise exception 'Invalid GIS audit metadata';
  end if;
  select jsonb_object_agg(key,value) into safe_old from jsonb_each(coalesce(p_old_meta,'{}'::jsonb))
    where key=any(array['schemaVersion','id','revision','state','requestId','siteId','areaId','scopeKind','packageDigest'])
      and jsonb_typeof(value) in ('string','number','null') and octet_length(value::text)<=200;
  select jsonb_object_agg(key,value) into safe_new from jsonb_each(coalesce(p_new_meta,'{}'::jsonb))
    where key=any(array['schemaVersion','id','revision','state','requestId','siteId','areaId','scopeKind','packageDigest'])
      and jsonb_typeof(value) in ('string','number','null') and octet_length(value::text)<=200;
  insert into public.audit_log(actor_account_id,action,table_name,record_id,old_values,new_values)
    values(auth.uid(),p_action,p_entity,p_id,safe_old,safe_new);
end $$;

create function gis_private.import_layer(p_import_id uuid,p_file_name text) returns jsonb
language sql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$
  select gis_private.strict_json(gis_private.assemble_import_file(p_import_id,p_file_name))
$$;

create function gis_private.import_live_dependency_digest(p_import_id uuid) returns text
language sql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'site',jsonb_build_array(i.site_id,s.site_name),
    'area',jsonb_build_array(i.area_id,a.site_id,a.area_code),
    'lots',coalesce((select jsonb_agg(jsonb_build_array(l.lot_id,l.area_id,l.lot_code,l.deleted_at is not null) order by l.lot_id)
      from public.lot l where l.area_id=i.area_id),'[]'::jsonb),
    'priorCoverage',coalesce((select jsonb_agg(jsonb_build_array(pg.lot_id,pg.source_feature_id) order by pg.lot_id)
      from public.mapping_publication mp join public.plot_geometry pg on pg.mapping_release_id=mp.release_id
      where mp.site_id=i.site_id and mp.area_id=i.area_id),'[]'::jsonb)
  )::text,'UTF8')),'hex')
  from public.mapping_import i join public.site s on s.site_id=i.site_id
  join public.area a on a.area_id=i.area_id where i.import_id=p_import_id
$$;

create function gis_private.validate_import(p_import_id uuid) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare i public.mapping_import; r public.mapping_release; manifest jsonb; data jsonb; feature jsonb; row_value jsonb;
  entries jsonb:='[]'::jsonb; ordered_entries jsonb; summary jsonb; report_core jsonb; report_digest text;
  live_digest text; file_name text; source_id text; lot_text text; severity text; expected_type text;
  error_count integer; warning_count integer; info_count integer; invalid_geometries integer:=0;
  duplicate_ids integer:=0; unresolved_lots integer:=0; privacy_count integer:=0; protocol_warnings integer:=0;
  selected_run public.georeferencing_run; observed_count integer; point_count integer; result_count integer;
  disconnected_count integer:=0; orphan_access_count integer:=0; unreachable_count integer:=0;
  geom extensions.geometry; endpoint_geom extensions.geometry; prior_lot record; database_row record;
begin
  select * into i from public.mapping_import where import_id=p_import_id;
  if not found then raise exception 'Import not found'; end if;
  select * into r from public.mapping_release where release_id=i.release_id;
  if not found then raise exception 'Release not found'; end if;
  perform gis_private.assert_pilot_scope(i.release_id);
  manifest:=gis_private.import_layer(p_import_id,'manifest.json');
  live_digest:=gis_private.import_live_dependency_digest(p_import_id);

  if manifest->>'site_id'<>i.site_id::text or manifest->>'pilot_area_id'<>i.area_id::text or
     manifest->>'release_code'<>r.release_code or manifest->'crs'->>'field'<>'4326' or
     manifest->'crs'->>'working'<>r.working_srid::text or manifest->'crs'->>'export'<>'4326' then
    entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','manifest_binding_mismatch','layer','manifest.json','message','Manifest scope, release, or CRS does not match the staged release.'));
  end if;

  foreach file_name in array array['cemetery_boundary.geojson','garden_sections.geojson','roads_walkways.geojson',
    'grave_plots.geojson','grave_access_points.geojson','route_nodes.geojson','route_edges.geojson','landmarks.geojson'] loop
    data:=gis_private.import_layer(p_import_id,file_name);
    if jsonb_typeof(data)<>'object' or data->>'type'<>'FeatureCollection' or jsonb_typeof(data->'features')<>'array' then
      entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','invalid_layer_document','layer',file_name,'message','Layer is not a FeatureCollection.'));
      continue;
    end if;
    for feature in select value from jsonb_array_elements(data->'features') loop
      source_id:=feature->'properties'->>'source_feature_id'; lot_text:=feature->'properties'->>'lot_id';
      if source_id is null or source_id!~'^[A-Za-z0-9._:-]{1,100}$' then
        entries:=entries||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('severity','ERROR','code','unsafe_source_identifier','layer',file_name,'sourceFeatureId',source_id,'message','A safe source feature identifier is required.')));
      end if;
      if feature->'properties'->>'site_id' is distinct from i.site_id::text then
        entries:=entries||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('severity','ERROR','code','wrong_site_identity','layer',file_name,'sourceFeatureId',source_id,'message','Feature site does not match the release.')));
      end if;
      if (feature->'properties') ?| array['deceased_name','owner_name','operator_name','device_reference','operator_reference','private_notes','review_notes','review_reason'] then
        privacy_count:=privacy_count+1;
        entries:=entries||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('severity','ERROR','code','private_property_exposed','layer',file_name,'sourceFeatureId',source_id,'message','A private property name is not allowed in a GIS layer.')));
      end if;
      begin
        geom:=extensions.st_geomfromgeojson((feature->'geometry')::text);
        expected_type:=case file_name when 'cemetery_boundary.geojson' then 'ST_Polygon' when 'garden_sections.geojson' then 'ST_Polygon'
          when 'grave_plots.geojson' then 'ST_Polygon' when 'grave_access_points.geojson' then 'ST_Point'
          when 'route_nodes.geojson' then 'ST_Point' when 'route_edges.geojson' then 'ST_LineString'
          when 'roads_walkways.geojson' then 'ST_LineString' else null end;
        if geom is null or extensions.st_srid(geom)<>4326 or extensions.st_coorddim(geom)<>2 or extensions.st_isempty(geom) or
           not extensions.st_isvalid(geom) or (expected_type is not null and extensions.st_geometrytype(geom)<>expected_type) then
          raise exception 'invalid geometry';
        end if;
      exception when others then
        invalid_geometries:=invalid_geometries+1;
        entries:=entries||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('severity','ERROR','code','invalid_geometry','layer',file_name,'sourceFeatureId',source_id,'message','Geometry is invalid, empty, wrong type, or wrong CRS.')));
      end;
      if file_name in ('grave_plots.geojson','grave_access_points.geojson') then
        if lot_text is null or lot_text!~'^[1-9][0-9]{0,18}$' or not exists(
          select 1 from public.lot l where l.lot_id=lot_text::bigint and l.area_id=i.area_id and l.deleted_at is null) then
          unresolved_lots:=unresolved_lots+1;
          entries:=entries||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('severity','ERROR','code','unknown_or_wrong_scope_lot','layer',file_name,'sourceFeatureId',source_id,'lotId',lot_text,'message','Lot is missing, removed, or outside the pilot area.')));
        end if;
      end if;
    end loop;
    if exists(select 1 from (
      select value->'properties'->>'source_feature_id' id,count(*) n from jsonb_array_elements(data->'features') group by 1 having count(*)>1
    ) duplicate) then
      duplicate_ids:=duplicate_ids+1;
      entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','duplicate_source_feature_id','layer',file_name,'message','Layer has duplicate source feature identifiers.'));
    end if;
  end loop;

  data:=gis_private.import_layer(p_import_id,'grave_plots.geojson');
  for feature in select value from jsonb_array_elements(data->'features') loop
    begin
      geom:=extensions.st_geomfromgeojson((feature->'geometry')::text);
      if not exists(select 1 from jsonb_array_elements(gis_private.import_layer(p_import_id,'garden_sections.geojson')->'features') a
        where (a->'properties'->>'area_id')=i.area_id::text and extensions.st_covers(extensions.st_geomfromgeojson((a->'geometry')::text),geom)) then
        entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','plot_outside_area_boundary','layer','grave_plots.geojson','sourceFeatureId',feature->'properties'->>'source_feature_id','lotId',feature->'properties'->>'lot_id','message','Plot is not covered by the versioned pilot area boundary.'));
      end if;
    exception when others then null; end;
  end loop;

  if exists(select 1 from jsonb_array_elements(data->'features') a cross join jsonb_array_elements(data->'features') b
    where a->'properties'->>'source_feature_id'<b->'properties'->>'source_feature_id' and
      extensions.st_relate(extensions.st_geomfromgeojson((a->'geometry')::text),extensions.st_geomfromgeojson((b->'geometry')::text),'2********')) then
    entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','plot_interior_overlap','layer','grave_plots.geojson','message','Plot interiors overlap.'));
  end if;

  data:=gis_private.import_layer(p_import_id,'route_nodes.geojson');
  for feature in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'route_edges.geojson')->'features') loop
    if not exists(select 1 from jsonb_array_elements(data->'features') n where n->'properties'->>'source_feature_id'=feature->'properties'->>'from_source_feature_id') or
       not exists(select 1 from jsonb_array_elements(data->'features') n where n->'properties'->>'source_feature_id'=feature->'properties'->>'to_source_feature_id') or
       not exists(select 1 from jsonb_array_elements(gis_private.import_layer(p_import_id,'roads_walkways.geojson')->'features') w
         where w->'properties'->>'source_feature_id'=feature->'properties'->>'walkway_source_feature_id') then
      entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','unresolved_graph_reference','layer','route_edges.geojson','sourceFeatureId',feature->'properties'->>'source_feature_id','message','Graph endpoint or walkway lineage reference is unresolved.'));
      disconnected_count:=disconnected_count+1;
      continue;
    end if;
    begin
      geom:=extensions.st_geomfromgeojson((feature->'geometry')::text);
      select extensions.st_geomfromgeojson((n->'geometry')::text) into endpoint_geom
        from jsonb_array_elements(data->'features') n
        where n->'properties'->>'source_feature_id'=feature->'properties'->>'from_source_feature_id';
      if not extensions.st_equals(extensions.st_startpoint(geom),endpoint_geom) then
        entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','edge_endpoint_mismatch','layer','route_edges.geojson','sourceFeatureId',feature->'properties'->>'source_feature_id','message','Edge start must exactly equal its referenced from-node.'));
      end if;
      select extensions.st_geomfromgeojson((n->'geometry')::text) into endpoint_geom
        from jsonb_array_elements(data->'features') n
        where n->'properties'->>'source_feature_id'=feature->'properties'->>'to_source_feature_id';
      if not extensions.st_equals(extensions.st_endpoint(geom),endpoint_geom) then
        entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','edge_endpoint_mismatch','layer','route_edges.geojson','sourceFeatureId',feature->'properties'->>'source_feature_id','message','Edge end must exactly equal its referenced to-node.'));
      end if;
      select extensions.st_geomfromgeojson((w->'geometry')::text) into endpoint_geom
        from jsonb_array_elements(gis_private.import_layer(p_import_id,'roads_walkways.geojson')->'features') w
        where w->'properties'->>'source_feature_id'=feature->'properties'->>'walkway_source_feature_id';
      if not extensions.st_coveredby(geom,endpoint_geom) then
        entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','edge_walkway_lineage_mismatch','layer','route_edges.geojson','sourceFeatureId',feature->'properties'->>'source_feature_id','message','Edge must be covered by its declared walkway lineage.'));
      end if;
    exception when others then null; end;
  end loop;

  if exists(select 1 from jsonb_array_elements(gis_private.import_layer(p_import_id,'route_edges.geojson')->'features') a
    cross join jsonb_array_elements(gis_private.import_layer(p_import_id,'route_edges.geojson')->'features') b
    where a->'properties'->>'source_feature_id'<b->'properties'->>'source_feature_id'
      and extensions.st_crosses(extensions.st_geomfromgeojson((a->'geometry')::text),extensions.st_geomfromgeojson((b->'geometry')::text))) then
    disconnected_count:=disconnected_count+1;
    entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','unnoded_edge_crossing','layer','route_edges.geojson','message','Route edges may not cross without an exact shared node.'));
  end if;

  for feature in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'grave_access_points.geojson')->'features') loop
    if not exists(select 1 from jsonb_array_elements(data->'features') n
      where n->'properties'->>'source_feature_id'=feature->'properties'->>'node_source_feature_id') then
      orphan_access_count:=orphan_access_count+1;
      entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','orphan_access_point','layer','grave_access_points.geojson','sourceFeatureId',feature->'properties'->>'source_feature_id','message','Grave access point must reference a route node in the package.'));
    end if;
  end loop;

  with recursive directed(src,dst) as (
    select e->'properties'->>'from_source_feature_id',e->'properties'->>'to_source_feature_id'
      from jsonb_array_elements(gis_private.import_layer(p_import_id,'route_edges.geojson')->'features') e
      where coalesce((e->'properties'->>'walking_allowed')::boolean,false) and not coalesce((e->'properties'->>'is_restricted')::boolean,false)
    union all
    select e->'properties'->>'to_source_feature_id',e->'properties'->>'from_source_feature_id'
      from jsonb_array_elements(gis_private.import_layer(p_import_id,'route_edges.geojson')->'features') e
      where coalesce((e->'properties'->>'walking_allowed')::boolean,false) and not coalesce((e->'properties'->>'is_restricted')::boolean,false)
        and coalesce(e->'properties'->>'direction','both')='both'
  ), reachable(node_code) as (
    select n->'properties'->>'source_feature_id' from jsonb_array_elements(data->'features') n
      where n->'properties'->>'node_type'='entrance'
    union
    select d.dst from reachable r0 join directed d on d.src=r0.node_code
  )
  select count(*)::integer into unreachable_count
    from jsonb_array_elements(gis_private.import_layer(p_import_id,'grave_access_points.geojson')->'features') a
    where not exists(select 1 from reachable r0 where r0.node_code=a->'properties'->>'node_source_feature_id');
  if unreachable_count>0 then
    entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','unreachable_access_point','layer','grave_access_points.geojson','relatedIds',jsonb_build_array(unreachable_count),'message','Every grave access point must be reachable from an entrance through walkable package edges.'));
  end if;

  data:=gis_private.import_layer(p_import_id,'survey_observations.json');
  for row_value in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'survey_captures.json')) loop
    select count(*) into observed_count from jsonb_array_elements(data) o where o->>'capture_code'=row_value->>'capture_code';
    if observed_count<>5 then
      protocol_warnings:=protocol_warnings+1;
      entries:=entries||jsonb_build_array(jsonb_build_object('severity','WARNING','code','field_reading_count_deviation','layer','survey_observations.json','sourceFeatureId',row_value->>'capture_code','relatedIds',jsonb_build_array(observed_count),'message','Capture has a non-target field reading count; readings are preserved.'));
    end if;
  end loop;

  for row_value in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'survey_points.json')) loop
    if not exists(select 1 from public.survey_point sp where sp.site_id=i.site_id and sp.point_code=row_value->>'point_code'
      and sp.role=row_value->>'role' and sp.active) then
      entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','survey_point_identity_mismatch','layer','survey_points.json','sourceFeatureId',row_value->>'point_code','message','Survey point code, role, active state, and site must match preserved evidence.'));
    end if;
  end loop;
  for row_value in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'survey_captures.json')) loop
    if not exists(select 1 from public.survey_capture sc join public.survey_point sp on sp.point_id=sc.point_id and sp.site_id=sc.site_id
      where sc.site_id=i.site_id and sp.point_code=row_value->>'point_code' and sc.capture_code=row_value->>'capture_code'
        and sc.review_state='accepted' and sc.reviewed_at is not null and sc.reviewed_by is not null) then
      entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','capture_not_frozen','layer','survey_captures.json','sourceFeatureId',row_value->>'capture_code','message','Survey capture must match accepted, reviewed, frozen evidence for the same point and site.'));
    end if;
  end loop;

  select count(*) into point_count from jsonb_array_elements(gis_private.import_layer(p_import_id,'georeferencing_run_points.json')) p where p->>'role'='VALIDATION';
  select count(*) into result_count from jsonb_array_elements(gis_private.import_layer(p_import_id,'georeferencing_validation.json'));
  if point_count=0 or result_count<point_count then
    entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','missing_independent_validation','layer','georeferencing_validation.json','message','Every independent validation membership requires a measured result.'));
  end if;

  select gr.* into selected_run from public.georeferencing_run gr where gr.release_id=i.release_id and
    gr.run_code=manifest->>'selected_run_code' and gr.review_state='accepted';
  if not found or (r.selected_run_id is not null and r.selected_run_id is distinct from selected_run.run_id) then
    entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','accepted_run_reference_mismatch','layer','georeferencing_runs.json','sourceFeatureId',manifest->>'selected_run_code','message','Selected run must be the unchanged accepted run bound to the release.'));
  end if;
  for row_value in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'georeferencing_runs.json')) loop
    if not exists(select 1 from public.georeferencing_run gr where gr.release_id=i.release_id and gr.site_id=i.site_id
      and gr.run_code=row_value->>'run_code' and gr.review_state='accepted' and gr.reviewed_at is not null and gr.reviewed_by is not null
      and gr.source_hash=row_value->>'source_sha256' and gr.output_artifact_hash=row_value->>'output_artifact_sha256'
      and gr.working_srid=(row_value->>'working_srid')::integer and gr.output_srid=(row_value->>'output_srid')::integer) then
      entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','accepted_run_evidence_mismatch','layer','georeferencing_runs.json','sourceFeatureId',row_value->>'run_code','message','Accepted run hashes, CRS, review/freeze state, release, and site must match preserved evidence.'));
    end if;
  end loop;
  for row_value in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'georeferencing_run_points.json')) loop
    if not exists(select 1 from public.georeferencing_run gr
      join public.georeferencing_run_point grp on grp.run_id=gr.run_id and grp.release_id=gr.release_id and grp.site_id=gr.site_id
      join public.survey_point sp on sp.point_id=grp.point_id and sp.site_id=grp.site_id
      join public.survey_capture sc on sc.capture_id=grp.capture_id and sc.point_id=grp.point_id and sc.site_id=grp.site_id
      where gr.release_id=i.release_id and gr.site_id=i.site_id and gr.run_code=row_value->>'run_code' and gr.review_state='accepted'
        and sp.point_code=row_value->>'point_code' and sc.capture_code=row_value->>'capture_code' and sc.review_state='accepted'
        and grp.role=row_value->>'role' and ((sp.role='GCP' and grp.role='FITTING') or (sp.role='VALIDATION' and grp.role='VALIDATION'))) then
      entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','run_membership_evidence_mismatch','layer','georeferencing_run_points.json','sourceFeatureId',row_value->>'point_code','message','Run membership must match frozen point/capture evidence and preserve fitting versus independent-validation roles.'));
    end if;
  end loop;
  for row_value in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'georeferencing_validation.json')) loop
    if not exists(select 1 from public.georeferencing_run gr
      join public.georeferencing_run_point grp on grp.run_id=gr.run_id and grp.role='VALIDATION'
      join public.survey_point sp on sp.point_id=grp.point_id and sp.role='VALIDATION'
      join public.georeferencing_validation gv on gv.run_point_id=grp.run_point_id and gv.review_state='reviewed'
      where gr.release_id=i.release_id and gr.site_id=i.site_id and gr.run_code=row_value->>'run_code'
        and gr.review_state='accepted' and sp.point_code=row_value->>'point_code') then
      entries:=entries||jsonb_build_array(jsonb_build_object('severity','ERROR','code','validation_evidence_not_reviewed','layer','georeferencing_validation.json','sourceFeatureId',row_value->>'point_code','message','Independent validation result must match a reviewed validation membership in the accepted run.'));
    end if;
  end loop;

  for prior_lot in select pg.lot_id from public.mapping_publication mp join public.plot_geometry pg
    on pg.mapping_release_id=mp.release_id where mp.site_id=i.site_id and mp.area_id=i.area_id loop
    if not exists(select 1 from jsonb_array_elements(gis_private.import_layer(p_import_id,'grave_plots.geojson')->'features') f
      where f->'properties'->>'lot_id'=prior_lot.lot_id::text) then
      entries:=entries||jsonb_build_array(jsonb_build_object('severity','WARNING','code','prior_coverage_omission','layer','grave_plots.geojson','lotId',prior_lot.lot_id::text,'message','Previously mapped lot is omitted and requires an explicit reason.'));
    end if;
  end loop;

  select coalesce(jsonb_agg(value order by case value->>'severity' when 'ERROR' then 1 when 'WARNING' then 2 else 3 end,
    value->>'layer' collate "C",coalesce(value->>'sourceFeatureId','') collate "C",coalesce(value->>'lotId','') collate "C",
    value->>'code' collate "C",coalesce(value->'relatedIds','[]'::jsonb)::text collate "C"),'[]'::jsonb)
    into ordered_entries from jsonb_array_elements(entries);
  select count(*) filter(where value->>'severity'='ERROR'),count(*) filter(where value->>'severity'='WARNING'),
    count(*) filter(where value->>'severity'='INFO') into error_count,warning_count,info_count from jsonb_array_elements(ordered_entries);
  summary:=jsonb_build_object('additions',0,'updates',0,'unchanged',0,'omissions',
    (select count(*) from jsonb_array_elements(ordered_entries) where value->>'code'='prior_coverage_omission'),
    'unresolvedLotIds',unresolved_lots,'invalidGeometries',invalid_geometries,'duplicateIds',duplicate_ids,
    'overlaps',(select count(*) from jsonb_array_elements(ordered_entries) where value->>'code' like '%overlap%'),
    'disconnectedGraphElements',disconnected_count,'orphanAccessPoints',orphan_access_count,'unreachableDestinations',unreachable_count,
    'privacyViolations',privacy_count,'protocolWarnings',protocol_warnings,
    'errorCount',error_count,'warningCount',warning_count,'infoCount',info_count,'truncated',false);
  report_core:=jsonb_build_object('schemaVersion',1,'validatorVersion','gis-pilot-v1','importId',i.import_id::text,
    'releaseId',i.release_id::text,'revision',i.target_revision,'packageDigest',i.package_digest,
    'baselineScopeRevision',coalesce((select count(*)::integer from public.mapping_publication_event where site_id=i.site_id and area_id=i.area_id),0),
    'baselineDependencyDigest',live_digest,'summary',summary,'entries',ordered_entries);
  report_digest:=encode(sha256(convert_to(report_core::text,'UTF8')),'hex');
  return report_core||jsonb_build_object('reportDigest',report_digest,
    'failureClassification',case when error_count=0 then null
      when not exists(select 1 from jsonb_array_elements(ordered_entries) where value->>'severity'='ERROR'
        and value->>'code' not in ('unknown_or_wrong_scope_lot','accepted_run_reference_mismatch','accepted_run_evidence_mismatch',
          'survey_point_identity_mismatch','capture_not_frozen','run_membership_evidence_mismatch','validation_evidence_not_reviewed'))
        then 'live_dependency' else 'package' end);
end $$;

create function gis_private.validate_release(p_release_id uuid) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare geometry_result jsonb; graph_result jsonb;
begin
  perform gis_private.assert_pilot_scope(p_release_id);
  geometry_result:=gis_private.validate_geometry_core(p_release_id);
  graph_result:=gis_private.validate_graph(p_release_id);
  return jsonb_build_object('schemaVersion',1,'geometry',geometry_result,'graph',graph_result);
end $$;

create function gis_private.assert_import_acknowledgements(p_import_id uuid,p_report jsonb,p_acknowledgements jsonb) returns void
language plpgsql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare manifest jsonb; declaration jsonb; warning jsonb; key text; value jsonb; expected_token text;
begin
  if p_acknowledgements is null or jsonb_typeof(p_acknowledgements)<>'object' or
     p_acknowledgements-array['warnings','reviewed_layer_hashes']<>'{}'::jsonb or
     jsonb_typeof(p_acknowledgements->'warnings')<>'array' or jsonb_typeof(p_acknowledgements->'reviewed_layer_hashes')<>'object' then
    raise exception 'Unknown or invalid finalization acknowledgement input';
  end if;
  manifest:=gis_private.import_layer(p_import_id,'manifest.json');
  for declaration in select item.value from jsonb_array_elements(manifest->'files') item(value) where item.value->>'name' like '%.geojson' loop
    if p_acknowledgements->'reviewed_layer_hashes'->>(declaration->>'name') is distinct from declaration->>'sha256' then
      raise exception 'Every reviewed layer acknowledgement must bind its exact hash';
    end if;
  end loop;
  if exists(select 1 from jsonb_object_keys(p_acknowledgements->'reviewed_layer_hashes') supplied
    where not exists(select 1 from jsonb_array_elements(manifest->'files') d where d->>'name'=supplied and supplied like '%.geojson')) then
    raise exception 'Unknown reviewed layer acknowledgement';
  end if;
  for warning in select item.value from jsonb_array_elements(p_report->'entries') item(value) where item.value->>'severity'='WARNING' loop
    expected_token:=warning->>'code'||':'||coalesce(warning->>'sourceFeatureId',warning->>'lotId','*');
    if not (p_acknowledgements->'warnings' @> jsonb_build_array(expected_token)) then
      raise exception 'Every exact validation warning requires acknowledgement';
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements_text(p_acknowledgements->'warnings') supplied
    where not exists(select 1 from jsonb_array_elements(p_report->'entries') warning_item
      where warning_item->>'severity'='WARNING' and supplied=warning_item->>'code'||':'||coalesce(warning_item->>'sourceFeatureId',warning_item->>'lotId','*'))) then
    raise exception 'Unknown warning acknowledgement';
  end if;
end $$;

create function gis_private.materialize_import(p_import_id uuid,p_acknowledgements jsonb) returns void
language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare i public.mapping_import; r public.mapping_release; manifest jsonb; feature jsonb; props jsonb;
  run_id uuid; actor uuid:=auth.uid(); node_id_value bigint; walkway_id uuid; layer_hash text; layer_version_value text;
begin
  perform gis_private.assert_admin();
  select * into i from public.mapping_import where import_id=p_import_id for update;
  select * into r from public.mapping_release where release_id=i.release_id for update;
  perform gis_private.assert_pilot_scope(i.release_id);
  if i.state<>'validated' or r.status<>'staged' or r.revision<>i.target_revision then
    raise exception 'Validated import and staged current release are required';
  end if;
  manifest:=gis_private.import_layer(p_import_id,'manifest.json');
  select gr.run_id into run_id from public.georeferencing_run gr where gr.release_id=i.release_id and
    gr.site_id=i.site_id and gr.run_code=manifest->>'selected_run_code' and gr.review_state='accepted' for share;
  if run_id is null then raise exception 'An accepted frozen selected run is required'; end if;

  delete from public.grave_access_point where mapping_release_id=i.release_id;
  delete from public.mapping_display_feature where mapping_release_id=i.release_id;
  delete from public.map_edge where mapping_release_id=i.release_id;
  delete from public.map_node where mapping_release_id=i.release_id;
  delete from public.plot_geometry where mapping_release_id=i.release_id;
  delete from public.mapping_walkway_source where mapping_release_id=i.release_id;
  delete from public.mapping_boundary where mapping_release_id=i.release_id;

  select value->>'sha256',value->>'layer_version' into layer_hash,layer_version_value from jsonb_array_elements(manifest->'files') value where value->>'name'='cemetery_boundary.geojson';
  for feature in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'cemetery_boundary.geojson')->'features') loop
    props:=feature->'properties';
    insert into public.mapping_boundary(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,kind,area_id,boundary_geom,review_state,created_by,reviewed_at,reviewed_by)
    values(i.release_id,i.site_id,run_id,props->>'source_feature_id',layer_hash,'cemetery_boundary',layer_version_value,'cemetery',null,
      extensions.st_geomfromgeojson((feature->'geometry')::text),'approved',actor,transaction_timestamp(),actor);
  end loop;
  select value->>'sha256',value->>'layer_version' into layer_hash,layer_version_value from jsonb_array_elements(manifest->'files') value where value->>'name'='garden_sections.geojson';
  for feature in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'garden_sections.geojson')->'features') loop
    props:=feature->'properties';
    insert into public.mapping_boundary(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,kind,area_id,boundary_geom,review_state,created_by,reviewed_at,reviewed_by)
    values(i.release_id,i.site_id,run_id,props->>'source_feature_id',layer_hash,'garden_sections',layer_version_value,'area',(props->>'area_id')::bigint,
      extensions.st_geomfromgeojson((feature->'geometry')::text),'approved',actor,transaction_timestamp(),actor);
  end loop;
  select value->>'sha256',value->>'layer_version' into layer_hash,layer_version_value from jsonb_array_elements(manifest->'files') value where value->>'name'='grave_plots.geojson';
  for feature in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'grave_plots.geojson')->'features') loop
    props:=feature->'properties';
    insert into public.plot_geometry(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,lot_id,area_id,plot_geom,review_state,created_by,reviewed_at,reviewed_by)
    values(i.release_id,i.site_id,run_id,props->>'source_feature_id',layer_hash,'grave_plots',layer_version_value,(props->>'lot_id')::bigint,(props->>'area_id')::bigint,
      extensions.st_geomfromgeojson((feature->'geometry')::text),'approved',actor,transaction_timestamp(),actor);
  end loop;
  select value->>'sha256',value->>'layer_version' into layer_hash,layer_version_value from jsonb_array_elements(manifest->'files') value where value->>'name'='roads_walkways.geojson';
  for feature in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'roads_walkways.geojson')->'features') loop
    props:=feature->'properties';
    insert into public.mapping_walkway_source(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,area_id,walkway_type,walking_allowed,restriction_context,centerline_geom,review_state,created_by,reviewed_at,reviewed_by)
    values(i.release_id,i.site_id,run_id,props->>'source_feature_id',layer_hash,'roads_walkways',layer_version_value,i.area_id,props->>'edge_type',(props->>'walking_allowed')::boolean,
      case when (props->>'is_restricted')::boolean then 'restricted by reviewed package' else null end,
      extensions.st_geomfromgeojson((feature->'geometry')::text),'approved',actor,transaction_timestamp(),actor);
  end loop;
  select value->>'sha256',value->>'layer_version' into layer_hash,layer_version_value from jsonb_array_elements(manifest->'files') value where value->>'name'='route_nodes.geojson';
  for feature in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'route_nodes.geojson')->'features') loop
    props:=feature->'properties';
    insert into public.map_node(site_id,node_name,node_type,location_geom,mapping_release_id,source_feature_id,artifact_hash,layer_name,layer_version,review_state,revision,imported_at,reviewed_at,reviewed_by)
    values(i.site_id,props->>'node_name',props->>'node_type',extensions.st_geomfromgeojson((feature->'geometry')::text)::extensions.geography,i.release_id,
      props->>'source_feature_id',layer_hash,'route_nodes',layer_version_value,'approved',1,transaction_timestamp(),transaction_timestamp(),actor);
  end loop;
  select value->>'sha256',value->>'layer_version' into layer_hash,layer_version_value from jsonb_array_elements(manifest->'files') value where value->>'name'='route_edges.geojson';
  for feature in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'route_edges.geojson')->'features') loop
    props:=feature->'properties';
    select node_id into node_id_value from public.map_node where mapping_release_id=i.release_id and source_feature_id=props->>'from_source_feature_id';
    select walkway_source_id into walkway_id from public.mapping_walkway_source where mapping_release_id=i.release_id and source_feature_id=props->>'walkway_source_feature_id';
    insert into public.map_edge(from_node_id,to_node_id,path_geom,edge_type,is_restricted,mapping_release_id,site_id,source_feature_id,artifact_hash,layer_name,layer_version,review_state,revision,imported_at,reviewed_at,reviewed_by,source_walkway_id,walking_allowed,direction)
    select node_id_value,to_node.node_id,extensions.st_geomfromgeojson((feature->'geometry')::text)::extensions.geography,props->>'edge_type',(props->>'is_restricted')::boolean,
      i.release_id,i.site_id,props->>'source_feature_id',layer_hash,'route_edges',layer_version_value,'approved',1,transaction_timestamp(),transaction_timestamp(),actor,
      walkway_id,(props->>'walking_allowed')::boolean,props->>'direction'
    from public.map_node to_node where to_node.mapping_release_id=i.release_id and to_node.source_feature_id=props->>'to_source_feature_id';
  end loop;
  select value->>'sha256',value->>'layer_version' into layer_hash,layer_version_value from jsonb_array_elements(manifest->'files') value where value->>'name'='grave_access_points.geojson';
  for feature in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'grave_access_points.geojson')->'features') loop
    props:=feature->'properties';
    select node_id into node_id_value from public.map_node where mapping_release_id=i.release_id and source_feature_id=props->>'node_source_feature_id';
    insert into public.grave_access_point(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,lot_id,area_id,node_id,access_point_geom,review_state,created_by,reviewed_at,reviewed_by)
    values(i.release_id,i.site_id,run_id,props->>'source_feature_id',layer_hash,'grave_access_points',layer_version_value,(props->>'lot_id')::bigint,(props->>'area_id')::bigint,node_id_value,
      extensions.st_geomfromgeojson((feature->'geometry')::text),'approved',actor,transaction_timestamp(),actor);
  end loop;
  select value->>'sha256',value->>'layer_version' into layer_hash,layer_version_value from jsonb_array_elements(manifest->'files') value where value->>'name'='landmarks.geojson';
  for feature in select value from jsonb_array_elements(gis_private.import_layer(p_import_id,'landmarks.geojson')->'features') loop
    props:=feature->'properties'; node_id_value:=null;
    if props ? 'node_source_feature_id' then select node_id into node_id_value from public.map_node where mapping_release_id=i.release_id and source_feature_id=props->>'node_source_feature_id'; end if;
    insert into public.mapping_display_feature(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,kind,label,route_node_id,display_geom,review_state,created_by,reviewed_at,reviewed_by)
    values(i.release_id,i.site_id,run_id,props->>'source_feature_id',layer_hash,'landmarks',layer_version_value,props->>'kind',props->>'label',node_id_value,
      extensions.st_geomfromgeojson((feature->'geometry')::text),'approved',actor,transaction_timestamp(),actor);
  end loop;
end $$;

create function public.staff_validate_mapping_import(p_import_id uuid,p_expected_revision integer,p_request_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,extensions,pg_temp as $$
declare actor uuid:=auth.uid(); initial public.mapping_import; i public.mapping_import; r public.mapping_release; prior jsonb;
  report jsonb; report_uuid uuid; result jsonb; new_state text; canonical jsonb; competing integer;
begin
  perform gis_private.assert_admin();
  if p_import_id is null or p_expected_revision is null or p_expected_revision<1 or p_request_id is null or p_operation_id is null then
    raise exception 'Invalid validation request'; end if;
  canonical:=jsonb_build_object('importId',p_import_id::text,'expectedRevision',p_expected_revision,'rootRequestId',p_request_id::text,'operationId',p_operation_id::text);
  prior:=gis_private.claim_request(p_operation_id,'staff_validate_mapping_import',canonical);
  if prior is not null then return prior; end if;
  select * into initial from public.mapping_import where import_id=p_import_id;
  if not found then raise exception 'Import not found'; end if;
  perform 1 from public.area where area_id=initial.area_id and site_id=initial.site_id for no key update;
  select * into r from public.mapping_release where release_id=initial.release_id for update;
  select * into i from public.mapping_import where import_id=p_import_id for update;
  if i.actor_account_id is distinct from actor or i.request_id is distinct from p_request_id then raise exception 'Import actor or root request binding mismatch'; end if;
  if r.revision<>p_expected_revision or i.target_revision<>p_expected_revision then raise exception 'Stale release or import target revision' using errcode='40001'; end if;
  if i.state not in ('sealed','invalid','validated') then raise exception 'Import state cannot be validated'; end if;
  if i.state='invalid' and i.failure_classification is distinct from 'live_dependency' then raise exception 'Package-content defects require a new import/root request'; end if;
  perform gis_private.assert_pilot_scope(i.release_id);
  select count(*) into competing from public.mapping_import other where other.release_id=i.release_id and other.import_id<>i.import_id and
    other.created_at>i.created_at and other.state in ('receiving','sealed','validated');
  if competing>0 then raise exception 'A newer competing active import owns this release revision'; end if;
  report:=gis_private.validate_import(p_import_id);
  new_state:=case when (report->'summary'->>'errorCount')::integer=0 then 'validated' else 'invalid' end;
  insert into public.mapping_import_report(import_id,release_revision,package_digest,validator_version,baseline_publication_revision,
    live_dependency_digest,failure_classification,summary,entries,report_hash,created_by)
  values(i.import_id,i.target_revision,i.package_digest,'gis-pilot-v1',(report->>'baselineScopeRevision')::integer,
    report->>'baselineDependencyDigest',report->>'failureClassification',report->'summary',report->'entries',report->>'reportDigest',actor)
  returning report_id into report_uuid;
  update public.mapping_import set state=new_state,revision=revision+1,current_report_id=report_uuid,
    failure_classification=report->>'failureClassification' where import_id=i.import_id;
  result:=jsonb_build_object('schemaVersion',1,'id',i.import_id::text,'importId',i.import_id::text,'releaseId',i.release_id::text,
    'revision',i.revision+1,'state',new_state,'requestId',p_operation_id::text,'rootRequestId',p_request_id::text,'operationId',p_operation_id::text,
    'packageDigest',i.package_digest,'baseRevision',i.base_revision,'targetRevision',i.target_revision,'currentReleaseRevision',r.revision,
    'fileCount',15,'reportId',report_uuid::text,'digest',report->>'reportDigest','reportDigest',report->>'reportDigest');
  perform gis_private.audit_event('mapping_import',i.import_id::text,'status_change',
    jsonb_build_object('schemaVersion',1,'id',i.import_id::text,'revision',i.revision,'state',i.state),result);
  perform gis_private.finish_request(p_operation_id,result);
  return result;
end $$;

create function public.staff_finalize_mapping_import(p_import_id uuid,p_expected_revision integer,p_report_digest text,
  p_acknowledgements jsonb,p_request_id uuid,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,extensions,pg_temp as $$
declare actor uuid:=auth.uid(); initial public.mapping_import; i public.mapping_import; r public.mapping_release; prior jsonb;
  report jsonb; current_report public.mapping_import_report; result jsonb; canonical jsonb; publication_count integer;
  failure_report_id uuid; failure_digest text; failure_entries jsonb; failure_summary jsonb; release_validation jsonb;
begin
  perform gis_private.assert_admin();
  if p_import_id is null or p_expected_revision is null or p_expected_revision<1 or p_report_digest!~'^[0-9a-f]{64}$' or
     p_acknowledgements is null or octet_length(p_acknowledgements::text)>1048576 or p_request_id is null or p_operation_id is null then
    raise exception 'Invalid bounded finalization request'; end if;
  canonical:=jsonb_build_object('importId',p_import_id::text,'expectedRevision',p_expected_revision,'reportDigest',p_report_digest,
    'acknowledgements',p_acknowledgements,'rootRequestId',p_request_id::text,'operationId',p_operation_id::text);
  prior:=gis_private.claim_request(p_operation_id,'staff_finalize_mapping_import',canonical);
  if prior is not null then return prior; end if;
  select * into initial from public.mapping_import where import_id=p_import_id;
  if not found then raise exception 'Import not found'; end if;
  perform 1 from public.area where area_id=initial.area_id and site_id=initial.site_id for no key update;
  select * into r from public.mapping_release where release_id=initial.release_id for update;
  select * into i from public.mapping_import where import_id=p_import_id for update;
  if i.actor_account_id is distinct from actor or i.request_id is distinct from p_request_id then raise exception 'Import actor or root request binding mismatch'; end if;
  if r.revision<>p_expected_revision or i.target_revision<>p_expected_revision then raise exception 'Stale release or import target revision' using errcode='40001'; end if;
  if i.state<>'validated' or r.status<>'staged' then raise exception 'Only a validated import on a staged release can be finalized'; end if;
  perform gis_private.assert_pilot_scope(i.release_id);
  select * into current_report from public.mapping_import_report where report_id=i.current_report_id for share;
  if not found or current_report.report_hash<>p_report_digest then raise exception 'Current report digest is stale or mismatched'; end if;
  report:=gis_private.validate_import(p_import_id);
  if (report->'summary'->>'errorCount')::integer>0 then
    insert into public.mapping_import_report(import_id,release_revision,package_digest,validator_version,baseline_publication_revision,
      live_dependency_digest,failure_classification,summary,entries,report_hash,created_by)
    values(i.import_id,i.target_revision,i.package_digest,'gis-pilot-v1',(report->>'baselineScopeRevision')::integer,
      report->>'baselineDependencyDigest','live_dependency',report->'summary',report->'entries',report->>'reportDigest',actor)
    returning report_id into failure_report_id;
    update public.mapping_import set state='invalid',revision=revision+1,failure_classification='live_dependency',
      current_report_id=failure_report_id where import_id=i.import_id;
    result:=jsonb_build_object('schemaVersion',1,'id',i.import_id::text,'importId',i.import_id::text,'releaseId',i.release_id::text,
      'revision',i.revision+1,'state','invalid','requestId',p_operation_id::text,'rootRequestId',p_request_id::text,'operationId',p_operation_id::text,
      'packageDigest',i.package_digest,'baseRevision',i.base_revision,'targetRevision',i.target_revision,'currentReleaseRevision',r.revision,
      'fileCount',15,'reportId',failure_report_id::text,'digest',report->>'reportDigest','reportDigest',report->>'reportDigest');
    perform gis_private.finish_request(p_operation_id,result);
    return result;
  end if;
  if report->>'reportDigest'<>p_report_digest or report->>'baselineDependencyDigest'<>current_report.live_dependency_digest then
    raise exception 'Validation report is stale; run validation again'; end if;
  perform gis_private.assert_import_acknowledgements(p_import_id,report,p_acknowledgements);
  select count(*) into publication_count from public.mapping_publication where release_id=i.release_id;
  if publication_count<>0 or r.status in ('approved','published','superseded','rejected') or r.reviewed_at is not null or r.published_at is not null then
    raise exception 'Frozen or publication-selected releases cannot be replaced'; end if;
  begin
    perform gis_private.materialize_import(p_import_id,p_acknowledgements);
    release_validation:=gis_private.validate_release(i.release_id);
    if (release_validation->'geometry'->>'errorCount')::integer<>0 or (release_validation->'graph'->>'errorCount')::integer<>0 then
      raise exception 'Materialized release failed authoritative geometry or graph validation';
    end if;
    update public.mapping_release set status='validated',revision=revision+1,
      selected_run_id=(select gr.run_id from public.georeferencing_run gr where gr.release_id=i.release_id and gr.site_id=i.site_id
        and gr.run_code=gis_private.import_layer(p_import_id,'manifest.json')->>'selected_run_code' and gr.review_state='accepted'),
      validation_report_hash=p_report_digest,
      validation_summary=jsonb_build_object('schemaVersion',1,'featureCount',(
        select coalesce(sum(file.declared_feature_count),0)::integer from public.mapping_import_file file
        where file.import_id=i.import_id and file.file_name like '%.geojson'),
        'errorCount',0,'warningCount',(report->'summary'->>'warningCount')::integer,'reportDigest',p_report_digest),
      validated_at=transaction_timestamp(),validated_by=actor where release_id=i.release_id;
    update public.mapping_import set state='finalized',revision=revision+1,failure_classification=null where import_id=i.import_id;
    result:=jsonb_build_object('schemaVersion',1,'id',i.import_id::text,'importId',i.import_id::text,'releaseId',i.release_id::text,
      'revision',i.revision+1,'state','finalized','requestId',p_operation_id::text,'rootRequestId',p_request_id::text,'operationId',p_operation_id::text,
      'packageDigest',i.package_digest,'baseRevision',i.base_revision,'targetRevision',i.target_revision,'currentReleaseRevision',r.revision+1,
      'fileCount',15,'reportId',current_report.report_id::text,'digest',p_report_digest,'reportDigest',p_report_digest);
    perform gis_private.audit_event('mapping_import',i.import_id::text,'status_change',
      jsonb_build_object('schemaVersion',1,'id',i.import_id::text,'revision',i.revision,'state',i.state),result);
  exception when others then
    failure_entries:=jsonb_build_array(jsonb_build_object('severity','ERROR','code','finalization_execution_failure',
      'layer','database','message','Atomic finalization failed; the prior snapshot was retained.'));
    failure_summary:=jsonb_build_object('errorCount',1,'warningCount',0,'infoCount',0,'executionFailure',true);
    failure_digest:=encode(sha256(convert_to(jsonb_build_object('schemaVersion',1,'validatorVersion','gis-pilot-v1',
      'importId',i.import_id::text,'releaseId',i.release_id::text,'revision',i.target_revision,'packageDigest',i.package_digest,
      'baselineDependencyDigest',report->>'baselineDependencyDigest','summary',failure_summary,'entries',failure_entries)::text,'UTF8')),'hex');
    insert into public.mapping_import_report(import_id,release_revision,package_digest,validator_version,baseline_publication_revision,
      live_dependency_digest,failure_classification,summary,entries,report_hash,created_by)
    values(i.import_id,i.target_revision,i.package_digest,'gis-pilot-v1',(report->>'baselineScopeRevision')::integer,
      report->>'baselineDependencyDigest','execution',failure_summary,failure_entries,failure_digest,actor)
    returning report_id into failure_report_id;
    result:=jsonb_build_object('schemaVersion',1,'id',i.import_id::text,'importId',i.import_id::text,'releaseId',i.release_id::text,
      'revision',i.revision,'state','validated','requestId',p_operation_id::text,'rootRequestId',p_request_id::text,'operationId',p_operation_id::text,
      'packageDigest',i.package_digest,'baseRevision',i.base_revision,'targetRevision',i.target_revision,'currentReleaseRevision',r.revision,
      'fileCount',15,'reportId',failure_report_id::text,'digest',failure_digest,'reportDigest',failure_digest);
    perform gis_private.finish_request(p_operation_id,result);
    return result;
  end;
  perform gis_private.finish_request(p_operation_id,result);
  return result;
end $$;

revoke all on function gis_private.import_layer(uuid,text),gis_private.import_live_dependency_digest(uuid),
  gis_private.validate_import(uuid),gis_private.validate_release(uuid),gis_private.assert_import_acknowledgements(uuid,jsonb,jsonb),
  gis_private.materialize_import(uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.staff_validate_mapping_import(uuid,integer,uuid,uuid),
  public.staff_finalize_mapping_import(uuid,integer,text,jsonb,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.staff_validate_mapping_import(uuid,integer,uuid,uuid),
  public.staff_finalize_mapping_import(uuid,integer,text,jsonb,uuid,uuid) to authenticated;

comment on function public.staff_validate_mapping_import(uuid,integer,uuid,uuid) is
  'ADMIN-only deterministic pilot import dry-run; appends a private report and never materializes GIS rows.';
comment on function public.staff_finalize_mapping_import(uuid,integer,text,jsonb,uuid,uuid) is
  'ADMIN-only atomic unapproved pilot snapshot installation; validates but never approves or publishes.';

commit;
