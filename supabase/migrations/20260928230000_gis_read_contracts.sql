begin;

-- M08: one authoritative GIS readiness definition and narrow read contracts.
-- This migration creates no publication selector, mutates no operational data,
-- and leaves all existing application read paths unchanged.

create view gis_private.lot_gis_readiness with (security_invoker=true) as
with published as materialized (
  select mp.site_id,mp.area_id,mp.release_id,
    (select count(*)::integer from public.mapping_publication_event pe
      where pe.site_id=mp.site_id and pe.area_id=mp.area_id) as scope_revision
  from public.mapping_publication mp
  join public.mapping_release mr on mr.release_id=mp.release_id
    and mr.site_id=mp.site_id and mr.status='published'
), reachable as materialized (
  select p.release_id,r.node_id
  from published p
  cross join lateral gis_private.reachable_nodes(p.release_id) as r(node_id)
), access_state as materialized (
  select a.mapping_release_id,a.lot_id,
    true as has_access,
    bool_or(a.review_state='approved' and n.review_state='approved') as has_approved_access,
    bool_or(a.review_state='approved' and n.review_state='approved' and r.node_id is not null) as has_reachable_access
  from public.grave_access_point a
  join public.map_node n on n.node_id=a.node_id and n.mapping_release_id=a.mapping_release_id and n.site_id=a.site_id
  left join reachable r on r.release_id=a.mapping_release_id and r.node_id=a.node_id
  group by a.mapping_release_id,a.lot_id
), assigned as materialized (
  select distinct br.lot_id from public.burial_record br
), stale_polygon as materialized (
  select distinct pg.lot_id
  from public.plot_geometry pg
  join published p on p.release_id=pg.mapping_release_id and p.site_id=pg.site_id and p.area_id=pg.area_id
  where pg.review_state='approved'
)
select
  a.site_id,l.area_id,l.lot_id,l.lot_code,l.deleted_at,
  case when assigned.lot_id is not null then 'occupied'
       when l.status='BOOKED' then 'booked'
       when l.status='HOLD' then 'hold'
       else 'available' end as occupancy,
  case when l.location_geom is null then 'missing'
       when l.coordinate_status='rejected' then 'rejected'
       when l.coordinate_status='verified' and l.coordinate_verified then 'verified'
       else 'pending' end as legacy_coordinate,
  p.release_id,p.scope_revision,
  (l.deleted_at is null and p.release_id is not null and pg.plot_geometry_id is not null) as geometry_ready,
  (l.deleted_at is null and p.release_id is not null and pg.plot_geometry_id is not null
    and coalesce(ax.has_reachable_access,false)) as routing_ready,
  case
    when l.deleted_at is not null then 'lot_removed'
    when p.release_id is null and stale_polygon.lot_id is not null then 'no_approved_polygon'
    when p.release_id is null then 'no_published_release'
    when pg.plot_geometry_id is null then 'no_approved_polygon'
    when not coalesce(ax.has_access,false) then 'no_access_point'
    when not coalesce(ax.has_approved_access,false) then 'unreviewed_access_point'
    when not coalesce(ax.has_reachable_access,false) then 'unreachable'
    else null
  end as reason
from public.lot l
join public.area a on a.area_id=l.area_id
left join assigned on assigned.lot_id=l.lot_id
left join published p on p.site_id=a.site_id and p.area_id=l.area_id
left join stale_polygon on stale_polygon.lot_id=l.lot_id
left join public.plot_geometry pg on pg.mapping_release_id=p.release_id and pg.lot_id=l.lot_id
  and pg.site_id=a.site_id and pg.area_id=l.area_id and pg.review_state='approved'
  and extensions.st_isvalid(pg.plot_geom) and not extensions.st_isempty(pg.plot_geom)
left join access_state ax on ax.mapping_release_id=p.release_id and ax.lot_id=l.lot_id;

revoke all on gis_private.lot_gis_readiness from public,anon,authenticated,service_role;

create function gis_private.public_layer_features(p_release_id uuid,p_layer text)
returns table(sort_key text,feature jsonb)
language sql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$
  select b.source_feature_id,
    jsonb_build_object('type','Feature','id',b.source_feature_id,'geometry',extensions.st_asgeojson(b.boundary_geom)::jsonb,
      'properties',jsonb_build_object('sourceFeatureId',b.source_feature_id,'kind',b.kind,
        'areaId',case when b.area_id is null then null else b.area_id::text end))
  from public.mapping_boundary b
  where p_layer='boundaries' and b.mapping_release_id=p_release_id and b.review_state='approved'
  union all
  select p.source_feature_id,
    jsonb_build_object('type','Feature','id',p.source_feature_id,'geometry',extensions.st_asgeojson(p.plot_geom)::jsonb,
      'properties',jsonb_build_object('sourceFeatureId',p.source_feature_id,'lotId',p.lot_id::text,
        'lotCode',l.lot_code,'areaId',p.area_id::text))
  from public.plot_geometry p
  join public.lot l on l.lot_id=p.lot_id and l.area_id=p.area_id and l.deleted_at is null
  join public.area a on a.area_id=l.area_id and a.site_id=p.site_id
  where p_layer='plots' and p.mapping_release_id=p_release_id and p.review_state='approved'
  union all
  select a.source_feature_id,
    jsonb_build_object('type','Feature','id',a.source_feature_id,'geometry',extensions.st_asgeojson(a.access_point_geom)::jsonb,
      'properties',jsonb_build_object('sourceFeatureId',a.source_feature_id,'lotId',a.lot_id::text,
        'areaId',a.area_id::text,'nodeId',a.node_id::text))
  from public.grave_access_point a
  join public.lot l on l.lot_id=a.lot_id and l.area_id=a.area_id and l.deleted_at is null
  join public.map_node n on n.node_id=a.node_id and n.mapping_release_id=a.mapping_release_id
    and n.site_id=a.site_id and n.review_state='approved'
  where p_layer='access_points' and a.mapping_release_id=p_release_id and a.review_state='approved'
  union all
  select w.source_feature_id,
    jsonb_build_object('type','Feature','id',w.source_feature_id,'geometry',extensions.st_asgeojson(w.centerline_geom)::jsonb,
      'properties',jsonb_build_object('sourceFeatureId',w.source_feature_id,'areaId',w.area_id::text,
        'walkwayType',w.walkway_type,'walkingAllowed',true))
  from public.mapping_walkway_source w
  where p_layer='walkways' and w.mapping_release_id=p_release_id and w.review_state='approved' and w.walking_allowed
  union all
  select n.source_feature_id,
    jsonb_build_object('type','Feature','id',n.source_feature_id,
      'geometry',extensions.st_asgeojson(n.location_geom::extensions.geometry)::jsonb,
      'properties',jsonb_build_object('sourceFeatureId',n.source_feature_id,'nodeId',n.node_id::text,
        'name',n.node_name,'nodeType',n.node_type))
  from public.map_node n
  where p_layer='nodes' and n.mapping_release_id=p_release_id and n.review_state='approved'
    and n.location_geom is not null and (
      n.node_type='entrance' or exists(select 1 from public.map_edge e where e.mapping_release_id=p_release_id
        and e.review_state='approved' and e.walking_allowed and not e.is_restricted
        and (e.from_node_id=n.node_id or e.to_node_id=n.node_id)))
  union all
  select e.source_feature_id,
    jsonb_build_object('type','Feature','id',e.source_feature_id,
      'geometry',extensions.st_asgeojson(e.path_geom::extensions.geometry)::jsonb,
      'properties',jsonb_build_object('sourceFeatureId',e.source_feature_id,'edgeId',e.edge_id::text,
        'fromNodeId',e.from_node_id::text,'toNodeId',e.to_node_id::text,'direction',e.direction,
        'forwardCostM',e.forward_cost_m,'reverseCostM',e.reverse_cost_m,'edgeType',e.edge_type))
  from public.map_edge e
  join public.mapping_walkway_source w on w.walkway_source_id=e.source_walkway_id
    and w.mapping_release_id=e.mapping_release_id and w.review_state='approved' and w.walking_allowed
  where p_layer='edges' and e.mapping_release_id=p_release_id and e.review_state='approved'
    and e.walking_allowed and not e.is_restricted and e.path_geom is not null
  union all
  select d.source_feature_id,
    jsonb_build_object('type','Feature','id',d.source_feature_id,'geometry',extensions.st_asgeojson(d.display_geom)::jsonb,
      'properties',jsonb_build_object('sourceFeatureId',d.source_feature_id,'kind',d.kind,'label',d.label,
        'routeNodeId',case when d.route_node_id is null then null else d.route_node_id::text end))
  from public.mapping_display_feature d
  where p_layer='landmarks' and d.mapping_release_id=p_release_id and d.review_state='approved';
$$;

create function gis_private.admin_layer_rows(p_release_id uuid,p_layer text,p_authoritative boolean)
returns table(sort_key text,row_value jsonb)
language sql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$
  select b.source_feature_id,jsonb_build_object('id',b.boundary_id::text,'sourceFeatureId',b.source_feature_id,
    'kind',b.kind,'areaId',case when b.area_id is null then null else b.area_id::text end,
    'geometry',extensions.st_asgeojson(b.boundary_geom)::jsonb,'reviewState',b.review_state,
    'revision',b.revision,'artifactHash',b.artifact_hash,'layerName',b.layer_name,'layerVersion',b.layer_version,
    'privateNotes',b.private_notes,'authoritative',p_authoritative)
  from public.mapping_boundary b where p_layer='boundaries' and b.mapping_release_id=p_release_id
  union all
  select p.source_feature_id,jsonb_build_object('id',p.plot_geometry_id::text,'sourceFeatureId',p.source_feature_id,
    'lotId',p.lot_id::text,'areaId',p.area_id::text,'geometry',extensions.st_asgeojson(p.plot_geom)::jsonb,
    'reviewState',p.review_state,'revision',p.revision,'artifactHash',p.artifact_hash,'layerName',p.layer_name,
    'layerVersion',p.layer_version,'privateNotes',p.private_notes,'authoritative',p_authoritative)
  from public.plot_geometry p where p_layer='plots' and p.mapping_release_id=p_release_id
  union all
  select a.source_feature_id,jsonb_build_object('id',a.access_point_id::text,'sourceFeatureId',a.source_feature_id,
    'lotId',a.lot_id::text,'areaId',a.area_id::text,'nodeId',a.node_id::text,
    'geometry',extensions.st_asgeojson(a.access_point_geom)::jsonb,'reviewState',a.review_state,
    'revision',a.revision,'artifactHash',a.artifact_hash,'layerName',a.layer_name,'layerVersion',a.layer_version,
    'privateNotes',a.private_notes,'authoritative',p_authoritative)
  from public.grave_access_point a where p_layer='access_points' and a.mapping_release_id=p_release_id
  union all
  select w.source_feature_id,jsonb_build_object('id',w.walkway_source_id::text,'sourceFeatureId',w.source_feature_id,
    'areaId',w.area_id::text,'walkwayType',w.walkway_type,'walkingAllowed',w.walking_allowed,
    'restrictionContext',w.restriction_context,'geometry',extensions.st_asgeojson(w.centerline_geom)::jsonb,
    'reviewState',w.review_state,'revision',w.revision,'artifactHash',w.artifact_hash,'layerName',w.layer_name,
    'layerVersion',w.layer_version,'privateNotes',w.private_notes,'authoritative',p_authoritative)
  from public.mapping_walkway_source w where p_layer='walkways' and w.mapping_release_id=p_release_id
  union all
  select n.source_feature_id,jsonb_build_object('id',n.node_id::text,'sourceFeatureId',n.source_feature_id,
    'name',n.node_name,'nodeType',n.node_type,
    'geometry',case when n.location_geom is null then null else extensions.st_asgeojson(n.location_geom::extensions.geometry)::jsonb end,
    'reviewState',n.review_state,'revision',n.revision,'artifactHash',n.artifact_hash,'layerName',n.layer_name,
    'layerVersion',n.layer_version,'reviewNotes',n.review_notes,'authoritative',p_authoritative)
  from public.map_node n where p_layer='nodes' and n.mapping_release_id=p_release_id
  union all
  select e.source_feature_id,jsonb_build_object('id',e.edge_id::text,'sourceFeatureId',e.source_feature_id,
    'fromNodeId',e.from_node_id::text,'toNodeId',e.to_node_id::text,'direction',e.direction,
    'forwardCostM',e.forward_cost_m,'reverseCostM',e.reverse_cost_m,'walkingAllowed',e.walking_allowed,
    'restricted',e.is_restricted,'geometry',case when e.path_geom is null then null else extensions.st_asgeojson(e.path_geom::extensions.geometry)::jsonb end,
    'reviewState',e.review_state,'revision',e.revision,'artifactHash',e.artifact_hash,'layerName',e.layer_name,
    'layerVersion',e.layer_version,'reviewNotes',e.review_notes,'authoritative',p_authoritative)
  from public.map_edge e where p_layer='edges' and e.mapping_release_id=p_release_id
  union all
  select d.source_feature_id,jsonb_build_object('id',d.display_feature_id::text,'sourceFeatureId',d.source_feature_id,
    'kind',d.kind,'label',d.label,'routeNodeId',case when d.route_node_id is null then null else d.route_node_id::text end,
    'geometry',extensions.st_asgeojson(d.display_geom)::jsonb,'reviewState',d.review_state,
    'revision',d.revision,'artifactHash',d.artifact_hash,'layerName',d.layer_name,'layerVersion',d.layer_version,
    'privateNotes',d.private_notes,'authoritative',p_authoritative)
  from public.mapping_display_feature d where p_layer='landmarks' and d.mapping_release_id=p_release_id;
$$;

revoke all on function gis_private.public_layer_features(uuid,text) from public,anon,authenticated,service_role;
revoke all on function gis_private.admin_layer_rows(uuid,text,boolean) from public,anon,authenticated,service_role;

create function public.staff_gis_readiness(
  p_site_id bigint,p_area_id bigint,p_page integer default 1,p_page_size integer default 20
) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,extensions,pg_temp as $$
declare result jsonb; active_release uuid; active_scope_revision integer:=0;
begin
  if not public.is_active_admin_or_manager() then
    raise exception 'An active staff account is required' using errcode='42501';
  end if;
  if p_site_id is null or p_site_id<=0 or p_area_id is null or p_area_id<=0 then
    raise exception 'Valid positive site and area IDs are required';
  end if;
  if p_page is null or p_page<1 or p_page>100000 then raise exception 'Page is outside the supported bound'; end if;
  if p_page_size is null or p_page_size<1 or p_page_size>50 then raise exception 'Page size is outside the supported bound'; end if;
  select mp.release_id,(select count(*)::integer from public.mapping_publication_event pe
      where pe.site_id=mp.site_id and pe.area_id=mp.area_id)
    into active_release,active_scope_revision
  from public.mapping_publication mp join public.mapping_release mr on mr.release_id=mp.release_id
  where mp.site_id=p_site_id and mp.area_id=p_area_id and mr.site_id=p_site_id and mr.status='published';
  with source as materialized (
    select r.site_id,r.area_id,r.lot_id,r.lot_code,r.occupancy,r.legacy_coordinate,r.release_id,r.scope_revision,
      r.geometry_ready,r.routing_ready,r.reason
    from gis_private.lot_gis_readiness r
    where r.site_id=p_site_id and r.area_id=p_area_id and r.deleted_at is null
  ), page_rows as (
    select s.site_id,s.area_id,s.lot_id,s.lot_code,s.occupancy,s.legacy_coordinate,s.release_id,s.scope_revision,
      s.geometry_ready,s.routing_ready,s.reason
    from source s order by s.lot_id limit p_page_size offset (p_page-1)*p_page_size
  )
  select jsonb_build_object(
    'schemaVersion',1,'siteId',p_site_id::text,'areaId',p_area_id::text,
    'releaseId',active_release::text,'scopeRevision',coalesce(active_scope_revision,0),
    'page',p_page,'pageSize',p_page_size,'total',(select count(*) from source),
    'totalPages',case when (select count(*) from source)=0 then 0 else ceil((select count(*) from source)::numeric/p_page_size)::integer end,
    'counts',jsonb_build_object(
      'geometryReady',(select count(*) from source where geometry_ready),
      'routingReady',(select count(*) from source where routing_ready),
      'legacyMissing',(select count(*) from source where legacy_coordinate='missing')),
    'rows',coalesce((select jsonb_agg(jsonb_build_object(
      'lotId',p.lot_id::text,'lotCode',p.lot_code,'areaId',p.area_id::text,'occupancy',p.occupancy,
      'legacyCoordinate',p.legacy_coordinate,'geometryReady',p.geometry_ready,'routingReady',p.routing_ready,
      'reason',p.reason) order by p.lot_id) from page_rows p),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create function public.staff_mapping_release(
  p_release_id uuid,p_layer text,p_page integer default 1,p_page_size integer default 50
) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,extensions,pg_temp as $$
declare r public.mapping_release; authority text; authoritative boolean; total_count bigint; rows_json jsonb;
begin
  if not public.is_active_admin() then raise exception 'An active administrator account is required' using errcode='42501'; end if;
  if p_release_id is null then raise exception 'Release ID is required'; end if;
  if p_layer not in ('metadata','boundaries','plots','access_points','walkways','nodes','edges','landmarks') then
    raise exception 'Unsupported mapping release layer';
  end if;
  if p_page is null or p_page<1 or p_page>100000 then raise exception 'Page is outside the supported bound'; end if;
  if p_page_size is null or p_page_size<1 or p_page_size>200 then raise exception 'Page size is outside the supported bound'; end if;
  select mr.release_id,mr.site_id,mr.release_code,mr.title,mr.description,mr.scope_kind,mr.pilot_area_id,mr.status,
    mr.revision,mr.package_reference,mr.package_hash,mr.source_plan_reference,mr.source_plan_version,mr.source_plan_hash,
    mr.source_coordinate_space,mr.field_srid,mr.working_srid,mr.published_srid,mr.qgis_version,mr.selected_run_id,
    mr.validation_report_hash,mr.validation_summary,mr.notes,mr.rejection_reason,mr.created_at,mr.created_by,
    mr.staged_at,mr.staged_by,mr.validated_at,mr.validated_by,mr.reviewed_at,mr.reviewed_by,mr.published_at,mr.published_by
    into r from public.mapping_release mr where mr.release_id=p_release_id;
  if not found then raise exception 'Mapping release not found'; end if;
  authority := case
    when r.status='staged' and exists(select 1 from public.plot_geometry p where p.mapping_release_id=r.release_id)
      then 'retained_unapproved'
    when r.status='validated' then 'current_validated'
    when r.status in ('approved','published','superseded','rejected') and exists(
      select 1 from public.plot_geometry p where p.mapping_release_id=r.release_id) then 'frozen'
    else 'none' end;
  authoritative := authority in ('current_validated','frozen');
  if p_layer='metadata' then total_count:=0; rows_json:='[]'::jsonb;
  else
    with source as materialized (
      select a.sort_key,a.row_value from gis_private.admin_layer_rows(r.release_id,p_layer,authoritative) a
    ), page_rows as (
      select s.sort_key,s.row_value from source s order by s.sort_key limit p_page_size offset (p_page-1)*p_page_size
    )
    select (select count(*) from source),coalesce((select jsonb_agg(p.row_value order by p.sort_key) from page_rows p),'[]'::jsonb)
      into total_count,rows_json;
  end if;
  return jsonb_build_object('schemaVersion',1,'release',jsonb_build_object(
    'id',r.release_id::text,'siteId',r.site_id::text,'releaseCode',r.release_code,'title',r.title,
    'description',r.description,'scopeKind',r.scope_kind,'pilotAreaId',case when r.pilot_area_id is null then null else r.pilot_area_id::text end,
    'status',r.status,'revision',r.revision,'packageReference',r.package_reference,'packageHash',r.package_hash,
    'sourcePlanReference',r.source_plan_reference,'sourcePlanVersion',r.source_plan_version,'sourcePlanHash',r.source_plan_hash,
    'sourceCoordinateSpace',r.source_coordinate_space,'fieldSrid',r.field_srid,'workingSrid',r.working_srid,
    'publishedSrid',r.published_srid,'qgisVersion',r.qgis_version,'selectedRunId',r.selected_run_id::text,
    'validationReportHash',r.validation_report_hash,'validationSummary',r.validation_summary,'notes',r.notes,
    'rejectionReason',r.rejection_reason),
    'contentAuthority',authority,'layer',p_layer,'page',p_page,'pageSize',p_page_size,
    'total',total_count,'totalPages',case when total_count=0 then 0 else ceil(total_count::numeric/p_page_size)::integer end,
    'rows',rows_json);
end $$;

create function public.public_mapping_layer(
  p_site_id bigint,p_area_id bigint,p_layer text,p_page integer default 1,p_page_size integer default 100,
  p_expected_release_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,extensions,pg_temp as $$
declare release_id uuid; scope_revision integer:=0; total_count bigint:=0; features jsonb:='[]'::jsonb;
begin
  if p_site_id is null or p_site_id<=0 or p_area_id is null or p_area_id<=0 then
    raise exception 'Valid positive site and area IDs are required';
  end if;
  if p_layer not in ('boundaries','plots','access_points','walkways','nodes','edges','landmarks') then
    raise exception 'Unsupported public mapping layer';
  end if;
  if p_page is null or p_page<1 or p_page>100000 then raise exception 'Page is outside the supported bound'; end if;
  if p_page_size is null or p_page_size<1 or p_page_size>200 then raise exception 'Page size is outside the supported bound'; end if;
  select mp.release_id,(select count(*)::integer from public.mapping_publication_event pe
      where pe.site_id=mp.site_id and pe.area_id=mp.area_id)
    into release_id,scope_revision
  from public.mapping_publication mp join public.mapping_release mr on mr.release_id=mp.release_id
  where mp.site_id=p_site_id and mp.area_id=p_area_id and mr.site_id=p_site_id and mr.status='published';
  if release_id is null then
    if p_expected_release_id is not null then raise exception 'release_changed' using errcode='40001'; end if;
    return jsonb_build_object('schemaVersion',1,'releaseId',null,'scopeRevision',0,'layer',p_layer,
      'page',p_page,'pageSize',p_page_size,'total',0,'totalPages',0,'features','[]'::jsonb);
  end if;
  if p_expected_release_id is not null and p_expected_release_id<>release_id then
    raise exception 'release_changed' using errcode='40001';
  end if;
  with source as materialized (
    select f.sort_key,f.feature from gis_private.public_layer_features(release_id,p_layer) f
  ), page_rows as (
    select s.sort_key,s.feature from source s order by s.sort_key limit p_page_size offset (p_page-1)*p_page_size
  )
  select (select count(*) from source),coalesce((select jsonb_agg(p.feature order by p.sort_key) from page_rows p),'[]'::jsonb)
    into total_count,features;
  return jsonb_build_object('schemaVersion',1,'releaseId',release_id::text,'scopeRevision',scope_revision,
    'layer',p_layer,'page',p_page,'pageSize',p_page_size,'total',total_count,
    'totalPages',case when total_count=0 then 0 else ceil(total_count::numeric/p_page_size)::integer end,'features',features);
end $$;

create function public.public_burial_gis(p_burial_id bigint) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,extensions,pg_temp as $$
declare result jsonb;
begin
  if p_burial_id is null or p_burial_id<=0 then raise exception 'Valid positive burial ID is required'; end if;
  select jsonb_build_object('schemaVersion',1,'burialId',br.burial_id::text,'lotId',l.lot_id::text,
    'lotCode',l.lot_code,'areaId',l.area_id::text,'releaseId',r.release_id::text,
    'geometryReady',coalesce(r.geometry_ready,false),'routingReady',coalesce(r.routing_ready,false),
    'reason',coalesce(r.reason,'no_published_release'),
    'plotGeometry',case when r.geometry_ready then extensions.st_asgeojson(pg.plot_geom)::jsonb else null end,
    'accessPoint',case when r.routing_ready then extensions.st_asgeojson(ap.access_point_geom)::jsonb else null end)
  into result
  from public.burial_record br
  join public.deceased d on d.deceased_id=br.deceased_id
  join public.lot l on l.lot_id=br.lot_id
  left join gis_private.lot_gis_readiness r on r.lot_id=l.lot_id and r.deleted_at is null
  left join public.plot_geometry pg on pg.mapping_release_id=r.release_id and pg.lot_id=l.lot_id
    and pg.area_id=l.area_id and pg.review_state='approved'
  left join public.grave_access_point ap on ap.mapping_release_id=r.release_id and ap.lot_id=l.lot_id
    and ap.area_id=l.area_id and ap.review_state='approved'
  where br.burial_id=p_burial_id and br.record_status='active' and br.deleted_at is null
    and d.public_display and l.deleted_at is null;
  return result;
end $$;

revoke all on function public.staff_gis_readiness(bigint,bigint,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.staff_mapping_release(uuid,text,integer,integer) from public,anon,authenticated,service_role;
revoke all on function public.public_mapping_layer(bigint,bigint,text,integer,integer,uuid) from public,anon,authenticated,service_role;
revoke all on function public.public_burial_gis(bigint) from public,anon,authenticated,service_role;
grant execute on function public.staff_gis_readiness(bigint,bigint,integer,integer) to authenticated;
grant execute on function public.staff_mapping_release(uuid,text,integer,integer) to authenticated;
grant execute on function public.public_mapping_layer(bigint,bigint,text,integer,integer,uuid) to anon,authenticated;
grant execute on function public.public_burial_gis(bigint) to anon,authenticated;

commit;
