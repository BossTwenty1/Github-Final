begin;

-- M05: release-scoped pedestrian graph, grave access points, visual-only
-- display features, and narrow audit redaction for release-owned graph rows.
-- Existing graph rows remain legacy rows with NULL release membership.

alter table public.map_node
  add column mapping_release_id uuid,
  add column source_feature_id text,
  add column artifact_hash text,
  add column layer_name text,
  add column layer_version text,
  add column review_state text,
  add column revision integer,
  add column imported_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.account(account_id) on delete set null,
  add column review_notes text;

alter table public.map_node
  add constraint map_node_id_site_release_key unique(node_id,site_id,mapping_release_id),
  add constraint map_node_release_site_fkey foreign key(mapping_release_id,site_id)
    references public.mapping_release(release_id,site_id) on delete restrict,
  add constraint map_node_release_profile_check check (
    (mapping_release_id is null and source_feature_id is null and artifact_hash is null and
      layer_name is null and layer_version is null and review_state is null and revision is null and
      imported_at is null and reviewed_at is null and reviewed_by is null and review_notes is null)
    or
    (mapping_release_id is not null and source_feature_id is not null and artifact_hash is not null and
      layer_name is not null and layer_version is not null and review_state is not null and revision is not null and
      imported_at is not null)),
  add constraint map_node_source_check check (
    source_feature_id is null or (length(source_feature_id) between 1 and 100 and source_feature_id ~ '^[A-Za-z0-9._:-]+$')),
  add constraint map_node_provenance_check check (artifact_hash is null or (
    artifact_hash ~ '^[0-9a-f]{64}$' and length(layer_name) between 1 and 100 and btrim(layer_name)<>'' and
    length(layer_version) between 1 and 100 and btrim(layer_version)<>'')),
  add constraint map_node_review_state_check check (review_state is null or review_state in ('pending','approved','rejected')),
  add constraint map_node_revision_check check (revision is null or revision>0),
  add constraint map_node_review_notes_check check (review_notes is null or length(review_notes)<=2000),
  add constraint map_node_release_name_check check (
    mapping_release_id is null or (length(node_name) between 1 and 200 and btrim(node_name)<>'')),
  add constraint map_node_review_check check (
    mapping_release_id is null or
    (review_state='pending' and reviewed_at is null and reviewed_by is null) or
    (review_state in ('approved','rejected') and reviewed_at is not null and reviewed_by is not null));

create unique index map_node_release_source_key on public.map_node(mapping_release_id,source_feature_id)
  where mapping_release_id is not null;
create index map_node_release_site_review_idx on public.map_node(mapping_release_id,site_id,review_state,node_id)
  where mapping_release_id is not null;
create index map_node_reviewed_by_idx on public.map_node(reviewed_by) where reviewed_by is not null;

alter table public.map_edge
  add column mapping_release_id uuid,
  add column site_id bigint,
  add column source_feature_id text,
  add column artifact_hash text,
  add column layer_name text,
  add column layer_version text,
  add column review_state text,
  add column revision integer,
  add column imported_at timestamptz,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.account(account_id) on delete set null,
  add column review_notes text,
  add column source_walkway_id uuid,
  add column walking_allowed boolean,
  add column direction text,
  add column forward_cost_m double precision,
  add column reverse_cost_m double precision;

alter table public.map_edge
  add constraint map_edge_release_site_fkey foreign key(mapping_release_id,site_id)
    references public.mapping_release(release_id,site_id) on delete restrict,
  add constraint map_edge_from_release_node_fkey foreign key(from_node_id,site_id,mapping_release_id)
    references public.map_node(node_id,site_id,mapping_release_id) on delete restrict,
  add constraint map_edge_to_release_node_fkey foreign key(to_node_id,site_id,mapping_release_id)
    references public.map_node(node_id,site_id,mapping_release_id) on delete restrict,
  add constraint map_edge_source_walkway_fkey foreign key(source_walkway_id,mapping_release_id,site_id)
    references public.mapping_walkway_source(walkway_source_id,mapping_release_id,site_id) on delete restrict,
  add constraint map_edge_release_profile_check check (
    (mapping_release_id is null and site_id is null and source_feature_id is null and artifact_hash is null and
      layer_name is null and layer_version is null and review_state is null and revision is null and
      imported_at is null and reviewed_at is null and reviewed_by is null and review_notes is null and
      source_walkway_id is null and walking_allowed is null and direction is null and
      forward_cost_m is null and reverse_cost_m is null)
    or
    (mapping_release_id is not null and site_id is not null and source_feature_id is not null and artifact_hash is not null and
      layer_name is not null and layer_version is not null and review_state is not null and revision is not null and
      imported_at is not null and source_walkway_id is not null and walking_allowed is not null and direction is not null)),
  add constraint map_edge_source_check check (
    source_feature_id is null or (length(source_feature_id) between 1 and 100 and source_feature_id ~ '^[A-Za-z0-9._:-]+$')),
  add constraint map_edge_provenance_check check (artifact_hash is null or (
    artifact_hash ~ '^[0-9a-f]{64}$' and length(layer_name) between 1 and 100 and btrim(layer_name)<>'' and
    length(layer_version) between 1 and 100 and btrim(layer_version)<>'')),
  add constraint map_edge_review_state_check check (review_state is null or review_state in ('pending','approved','rejected')),
  add constraint map_edge_revision_check check (revision is null or revision>0),
  add constraint map_edge_review_notes_check check (review_notes is null or length(review_notes)<=2000),
  add constraint map_edge_review_check check (
    mapping_release_id is null or
    (review_state='pending' and reviewed_at is null and reviewed_by is null) or
    (review_state in ('approved','rejected') and reviewed_at is not null and reviewed_by is not null)),
  add constraint map_edge_direction_check check (direction is null or direction in ('both','forward','reverse')),
  add constraint map_edge_cost_check check (
    (forward_cost_m is null or (forward_cost_m>0 and forward_cost_m::text not in ('NaN','Infinity','-Infinity'))) and
    (reverse_cost_m is null or (reverse_cost_m>0 and reverse_cost_m::text not in ('NaN','Infinity','-Infinity'))));

create unique index map_edge_release_source_key on public.map_edge(mapping_release_id,source_feature_id)
  where mapping_release_id is not null;
create index map_edge_release_site_review_idx on public.map_edge(mapping_release_id,site_id,review_state,edge_id)
  where mapping_release_id is not null;
create index map_edge_release_from_idx on public.map_edge(mapping_release_id,from_node_id)
  where mapping_release_id is not null;
create index map_edge_release_to_idx on public.map_edge(mapping_release_id,to_node_id)
  where mapping_release_id is not null;
create index map_edge_source_walkway_idx on public.map_edge(source_walkway_id) where source_walkway_id is not null;
create index map_edge_reviewed_by_idx on public.map_edge(reviewed_by) where reviewed_by is not null;

create table public.grave_access_point (
  access_point_id uuid primary key default pg_catalog.gen_random_uuid(),
  mapping_release_id uuid not null,
  site_id bigint not null,
  georeferencing_run_id uuid not null,
  source_feature_id text not null,
  artifact_hash text not null,
  layer_name text not null,
  layer_version text not null,
  lot_id bigint not null,
  area_id bigint not null,
  node_id bigint not null,
  access_point_geom extensions.geometry(Point,4326) not null,
  review_state text not null default 'pending',
  revision integer not null default 1,
  private_notes text,
  created_at timestamptz not null default transaction_timestamp(),
  imported_at timestamptz not null default transaction_timestamp(),
  created_by uuid references public.account(account_id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.account(account_id) on delete set null,
  constraint grave_access_point_release_source_key unique(mapping_release_id,source_feature_id),
  constraint grave_access_point_release_lot_key unique(mapping_release_id,lot_id),
  constraint grave_access_point_id_release_site_key unique(access_point_id,mapping_release_id,site_id),
  constraint grave_access_point_release_site_fkey foreign key(mapping_release_id,site_id)
    references public.mapping_release(release_id,site_id) on delete restrict,
  constraint grave_access_point_run_scope_fkey foreign key(georeferencing_run_id,mapping_release_id,site_id)
    references public.georeferencing_run(run_id,release_id,site_id) on delete restrict,
  constraint grave_access_point_plot_fkey foreign key(mapping_release_id,lot_id)
    references public.plot_geometry(mapping_release_id,lot_id) on delete restrict,
  constraint grave_access_point_area_fkey foreign key(mapping_release_id,site_id,area_id)
    references public.mapping_release_area(release_id,site_id,area_id) on delete restrict,
  constraint grave_access_point_node_fkey foreign key(node_id,site_id,mapping_release_id)
    references public.map_node(node_id,site_id,mapping_release_id) on delete restrict,
  constraint grave_access_point_source_check check (
    length(source_feature_id) between 1 and 100 and source_feature_id ~ '^[A-Za-z0-9._:-]+$'),
  constraint grave_access_point_provenance_check check (
    artifact_hash ~ '^[0-9a-f]{64}$' and length(layer_name) between 1 and 100 and btrim(layer_name)<>'' and
    length(layer_version) between 1 and 100 and btrim(layer_version)<>''),
  constraint grave_access_point_review_state_check check (review_state in ('pending','approved','rejected')),
  constraint grave_access_point_revision_check check (revision>0),
  constraint grave_access_point_notes_check check (private_notes is null or length(private_notes)<=2000),
  constraint grave_access_point_review_check check (
    (review_state='pending' and reviewed_at is null and reviewed_by is null) or
    (review_state in ('approved','rejected') and reviewed_at is not null and reviewed_by is not null)),
  constraint grave_access_point_geometry_check check (
    extensions.st_geometrytype(access_point_geom)='ST_Point' and extensions.st_srid(access_point_geom)=4326 and
    extensions.st_coorddim(access_point_geom)=2 and not extensions.st_isempty(access_point_geom) and
    extensions.st_isvalid(access_point_geom) and extensions.st_x(access_point_geom) between -180 and 180 and
    extensions.st_y(access_point_geom) between -90 and 90)
);

create table public.mapping_display_feature (
  display_feature_id uuid primary key default pg_catalog.gen_random_uuid(),
  mapping_release_id uuid not null,
  site_id bigint not null,
  georeferencing_run_id uuid not null,
  source_feature_id text not null,
  artifact_hash text not null,
  layer_name text not null,
  layer_version text not null,
  kind text not null,
  label text not null,
  route_node_id bigint,
  display_geom extensions.geometry(Geometry,4326) not null,
  review_state text not null default 'pending',
  revision integer not null default 1,
  private_notes text,
  created_at timestamptz not null default transaction_timestamp(),
  imported_at timestamptz not null default transaction_timestamp(),
  created_by uuid references public.account(account_id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.account(account_id) on delete set null,
  constraint mapping_display_feature_release_source_key unique(mapping_release_id,source_feature_id),
  constraint mapping_display_feature_id_release_site_key unique(display_feature_id,mapping_release_id,site_id),
  constraint mapping_display_feature_release_site_fkey foreign key(mapping_release_id,site_id)
    references public.mapping_release(release_id,site_id) on delete restrict,
  constraint mapping_display_feature_run_scope_fkey foreign key(georeferencing_run_id,mapping_release_id,site_id)
    references public.georeferencing_run(run_id,release_id,site_id) on delete restrict,
  constraint mapping_display_feature_node_fkey foreign key(route_node_id,site_id,mapping_release_id)
    references public.map_node(node_id,site_id,mapping_release_id) on delete restrict,
  constraint mapping_display_feature_kind_check check (kind in ('landmark','building','entrance')),
  constraint mapping_display_feature_label_check check (
    length(label) between 1 and 200 and btrim(label)<>''),
  constraint mapping_display_feature_source_check check (
    length(source_feature_id) between 1 and 100 and source_feature_id ~ '^[A-Za-z0-9._:-]+$'),
  constraint mapping_display_feature_provenance_check check (
    artifact_hash ~ '^[0-9a-f]{64}$' and length(layer_name) between 1 and 100 and btrim(layer_name)<>'' and
    length(layer_version) between 1 and 100 and btrim(layer_version)<>''),
  constraint mapping_display_feature_review_state_check check (review_state in ('pending','approved','rejected')),
  constraint mapping_display_feature_revision_check check (revision>0),
  constraint mapping_display_feature_notes_check check (private_notes is null or length(private_notes)<=2000),
  constraint mapping_display_feature_review_check check (
    (review_state='pending' and reviewed_at is null and reviewed_by is null) or
    (review_state in ('approved','rejected') and reviewed_at is not null and reviewed_by is not null)),
  constraint mapping_display_feature_geometry_check check (
    extensions.st_geometrytype(display_geom) in ('ST_Point','ST_Polygon') and
    extensions.st_srid(display_geom)=4326 and extensions.st_coorddim(display_geom)=2 and
    not extensions.st_isempty(display_geom) and extensions.st_isvalid(display_geom) and
    extensions.st_xmin(extensions.box3d(display_geom)) between -180 and 180 and
    extensions.st_xmax(extensions.box3d(display_geom)) between -180 and 180 and
    extensions.st_ymin(extensions.box3d(display_geom)) between -90 and 90 and
    extensions.st_ymax(extensions.box3d(display_geom)) between -90 and 90)
);

create index grave_access_point_release_area_idx on public.grave_access_point(mapping_release_id,area_id,lot_id);
create index grave_access_point_node_idx on public.grave_access_point(node_id);
create index grave_access_point_run_idx on public.grave_access_point(georeferencing_run_id);
create index grave_access_point_created_by_idx on public.grave_access_point(created_by);
create index grave_access_point_reviewed_by_idx on public.grave_access_point(reviewed_by);
create index grave_access_point_geom_gist on public.grave_access_point using gist(access_point_geom);
create index mapping_display_feature_release_kind_idx on public.mapping_display_feature(mapping_release_id,kind,source_feature_id);
create index mapping_display_feature_node_idx on public.mapping_display_feature(route_node_id) where route_node_id is not null;
create index mapping_display_feature_run_idx on public.mapping_display_feature(georeferencing_run_id);
create index mapping_display_feature_created_by_idx on public.mapping_display_feature(created_by);
create index mapping_display_feature_reviewed_by_idx on public.mapping_display_feature(reviewed_by);
create index mapping_display_feature_geom_gist on public.mapping_display_feature using gist(display_geom);

alter table public.grave_access_point enable row level security;
alter table public.mapping_display_feature enable row level security;
revoke all on public.grave_access_point,public.mapping_display_feature from public,anon,authenticated,service_role;
grant select on public.grave_access_point,public.mapping_display_feature to authenticated;
create policy grave_access_point_admin_read on public.grave_access_point for select to authenticated
  using(public.is_active_admin());
create policy mapping_display_feature_admin_read on public.mapping_display_feature for select to authenticated
  using(public.is_active_admin());

drop policy map_node_admin_manager_all on public.map_node;
drop policy map_edge_admin_manager_all on public.map_edge;

create policy map_node_release_aware_read on public.map_node for select to authenticated
  using((mapping_release_id is null and public.is_active_admin_or_manager()) or
        (mapping_release_id is not null and public.is_active_admin()));
create policy map_node_legacy_insert on public.map_node for insert to authenticated
  with check(mapping_release_id is null and public.is_active_admin_or_manager());
create policy map_node_legacy_update on public.map_node for update to authenticated
  using(mapping_release_id is null and public.is_active_admin_or_manager())
  with check(mapping_release_id is null and public.is_active_admin_or_manager());
create policy map_node_legacy_delete on public.map_node for delete to authenticated
  using(mapping_release_id is null and public.is_active_admin_or_manager());

create policy map_edge_release_aware_read on public.map_edge for select to authenticated
  using((mapping_release_id is null and public.is_active_admin_or_manager()) or
        (mapping_release_id is not null and public.is_active_admin()));
create policy map_edge_legacy_insert on public.map_edge for insert to authenticated
  with check(mapping_release_id is null and public.is_active_admin_or_manager());
create policy map_edge_legacy_update on public.map_edge for update to authenticated
  using(mapping_release_id is null and public.is_active_admin_or_manager())
  with check(mapping_release_id is null and public.is_active_admin_or_manager());
create policy map_edge_legacy_delete on public.map_edge for delete to authenticated
  using(mapping_release_id is null and public.is_active_admin_or_manager());

-- Managers retain every existing audit row they could read, including legacy
-- graph events, but protected release graph provenance remains ADMIN-only.
drop policy audit_log_admin_manager_read on public.audit_log;
create policy audit_log_release_aware_read on public.audit_log for select to authenticated
  using(
    public.is_active_admin() or (
      public.is_active_manager() and not (
        table_name in ('map_node','map_edge') and
        coalesce(new_values->>'mapping_release_id',old_values->>'mapping_release_id') is not null
      )
    )
  );

create function gis_private.reachable_nodes(p_release_id uuid) returns setof bigint
language sql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$
  with recursive directed(src,dst) as (
    select e.from_node_id,e.to_node_id from public.map_edge e
    join public.map_node f on f.node_id=e.from_node_id and f.mapping_release_id=e.mapping_release_id
      and f.site_id=e.site_id and f.review_state='approved'
    join public.map_node t on t.node_id=e.to_node_id and t.mapping_release_id=e.mapping_release_id
      and t.site_id=e.site_id and t.review_state='approved'
    join public.mapping_walkway_source w on w.walkway_source_id=e.source_walkway_id
      and w.mapping_release_id=e.mapping_release_id and w.site_id=e.site_id
      and w.review_state='approved' and w.walking_allowed
    where e.mapping_release_id=p_release_id and e.review_state='approved'
      and e.walking_allowed and not e.is_restricted and e.forward_cost_m is not null
    union all
    select e.to_node_id,e.from_node_id from public.map_edge e
    join public.map_node f on f.node_id=e.from_node_id and f.mapping_release_id=e.mapping_release_id
      and f.site_id=e.site_id and f.review_state='approved'
    join public.map_node t on t.node_id=e.to_node_id and t.mapping_release_id=e.mapping_release_id
      and t.site_id=e.site_id and t.review_state='approved'
    join public.mapping_walkway_source w on w.walkway_source_id=e.source_walkway_id
      and w.mapping_release_id=e.mapping_release_id and w.site_id=e.site_id
      and w.review_state='approved' and w.walking_allowed
    where e.mapping_release_id=p_release_id and e.review_state='approved'
      and e.walking_allowed and not e.is_restricted and e.reverse_cost_m is not null
  ), reachable(node_id) as (
    select n.node_id from public.map_node n
    where n.mapping_release_id=p_release_id and n.node_type='entrance' and n.review_state='approved'
    union
    select d.dst from reachable r join directed d on d.src=r.node_id
  )
  select node_id from reachable;
$$;

create function gis_private.validate_graph(p_release_id uuid) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare
  node_count integer;
  edge_count integer;
  reachable_count integer;
  isolated_count integer;
  access_count integer;
  display_count integer;
  missing_entrance_count integer;
  unreviewed_node_count integer;
  unreviewed_edge_count integer;
  unreviewed_walkway_reference_count integer;
  unreviewed_access_count integer;
  unapproved_access_reference_count integer;
  unreachable_access_count integer;
  error_count integer;
begin
  if p_release_id is null or not exists(select 1 from public.mapping_release where release_id=p_release_id) then
    raise exception 'Mapping release not found';
  end if;
  select count(*)::integer into node_count from public.map_node where mapping_release_id=p_release_id;
  select count(*)::integer into edge_count from public.map_edge where mapping_release_id=p_release_id;
  select count(*)::integer into reachable_count from gis_private.reachable_nodes(p_release_id);
  select count(*)::integer into isolated_count from public.map_node n
    where n.mapping_release_id=p_release_id and not exists(
      select 1 from gis_private.reachable_nodes(p_release_id) r where r=n.node_id);
  select count(*)::integer into access_count from public.grave_access_point where mapping_release_id=p_release_id;
  select count(*)::integer into display_count from public.mapping_display_feature where mapping_release_id=p_release_id;
  select case when exists(select 1 from public.map_node where mapping_release_id=p_release_id
    and node_type='entrance' and review_state='approved') then 0 else 1 end into missing_entrance_count;
  select count(*)::integer into unreviewed_node_count from public.map_node
    where mapping_release_id=p_release_id and review_state<>'approved';
  select count(*)::integer into unreviewed_edge_count from public.map_edge
    where mapping_release_id=p_release_id and review_state<>'approved';
  select count(distinct e.edge_id)::integer into unreviewed_walkway_reference_count
    from public.map_edge e join public.mapping_walkway_source w on w.walkway_source_id=e.source_walkway_id
    where e.mapping_release_id=p_release_id and w.review_state<>'approved';
  select count(*)::integer into unreviewed_access_count from public.grave_access_point
    where mapping_release_id=p_release_id and review_state<>'approved';
  select count(*)::integer into unapproved_access_reference_count
    from public.grave_access_point a
    join public.plot_geometry p on p.mapping_release_id=a.mapping_release_id and p.lot_id=a.lot_id
    join public.map_node n on n.mapping_release_id=a.mapping_release_id and n.site_id=a.site_id and n.node_id=a.node_id
    where a.mapping_release_id=p_release_id and (p.review_state<>'approved' or n.review_state<>'approved');
  select count(*)::integer into unreachable_access_count from public.grave_access_point a
    where a.mapping_release_id=p_release_id and not exists(
      select 1 from gis_private.reachable_nodes(p_release_id) r where r=a.node_id);
  error_count:=missing_entrance_count+isolated_count+unreviewed_node_count+unreviewed_edge_count+
    unreviewed_walkway_reference_count+unreviewed_access_count+unapproved_access_reference_count+
    unreachable_access_count;
  return jsonb_build_object(
    'schemaVersion',1,'releaseId',p_release_id::text,'nodeCount',node_count,'edgeCount',edge_count,
    'reachableNodeCount',reachable_count,'isolatedNodeCount',isolated_count,
    'accessPointCount',access_count,'displayFeatureCount',display_count,
    'missingEntranceCount',missing_entrance_count,'unreviewedNodeCount',unreviewed_node_count,
    'unreviewedEdgeCount',unreviewed_edge_count,'unreviewedWalkwayReferenceCount',unreviewed_walkway_reference_count,
    'unreviewedAccessPointCount',unreviewed_access_count,
    'unapprovedAccessReferenceCount',unapproved_access_reference_count,
    'unreachableAccessPointCount',unreachable_access_count,'errorCount',error_count);
end $$;

create function gis_private.guard_release_graph() returns trigger
language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare
  owner_name name;
  pending_count integer;
  operation text;
  release public.mapping_release;
  walkway public.mapping_walkway_source;
  from_node public.map_node;
  to_node public.map_node;
  v_release_id uuid;
  old_release_id uuid;
  row_site_id bigint;
  row_run_id uuid;
  run_state text;
  working_srid integer;
  metric_length double precision;
begin
  v_release_id:=case when tg_op='DELETE' then old.mapping_release_id else new.mapping_release_id end;
  old_release_id:=case when tg_op='INSERT' then null else old.mapping_release_id end;

  if tg_op='UPDATE' and old.mapping_release_id is distinct from new.mapping_release_id then
    raise exception 'Graph release membership cannot be upgraded, downgraded, or reassigned';
  end if;
  if v_release_id is null then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;

  select pg_get_userbyid(c.relowner) into owner_name from pg_class c where c.oid=tg_relid;
  if current_user<>owner_name then
    raise exception 'Protected release graph owner operation required' using errcode='42501';
  end if;
  perform gis_private.assert_admin();
  select count(*),min(q.operation) into pending_count,operation
  from gis_private.gis_mutation_request q
  where q.actor_account_id=auth.uid() and q.response is null and q.created_at=transaction_timestamp();
  if pending_count<>1 or operation<>'staff_finalize_mapping_import' then
    raise exception 'Protected pending GIS finalization operation required' using errcode='42501';
  end if;

  row_site_id:=case when tg_op='DELETE' then old.site_id else new.site_id end;
  select * into release from public.mapping_release r where r.release_id=v_release_id for update;
  if not found or release.site_id is distinct from row_site_id then raise exception 'Release graph release/site mismatch'; end if;
  if release.status<>'staged' or release.reviewed_at is not null or release.published_at is not null then
    raise exception 'Release graph may be replaced only for a never-frozen staged release';
  end if;
  if tg_op='DELETE' then return old; end if;

  if tg_table_name in ('grave_access_point','mapping_display_feature') then
    row_run_id:=(to_jsonb(new)->>'georeferencing_run_id')::uuid;
    select review_state into run_state from public.georeferencing_run
      where run_id=row_run_id and georeferencing_run.release_id=v_release_id and site_id=row_site_id for share;
    if run_state is distinct from 'accepted' or
      (release.selected_run_id is not null and release.selected_run_id is distinct from row_run_id) then
      raise exception 'Release graph content must preserve an accepted same-release georeferencing run relationship';
    end if;
    if (to_jsonb(new)->>'created_by')::uuid is distinct from auth.uid() then
      raise exception 'Release graph content creator must be the protected actor';
    end if;
  end if;

  if new.review_state='pending' then
    if new.reviewed_at is not null or new.reviewed_by is not null then raise exception 'Pending graph content cannot be reviewed'; end if;
  elsif new.reviewed_at is null or new.reviewed_by is distinct from auth.uid() then
    raise exception 'Reviewed graph content requires the protected reviewer and timestamp';
  end if;
  if tg_op='INSERT' then
    if new.revision<>1 then raise exception 'New graph content must start at revision one'; end if;
  else
    if new.revision<>old.revision+1 then raise exception 'Graph content revision must increment exactly once'; end if;
    if (new.mapping_release_id,new.site_id,new.source_feature_id,new.imported_at)
      is distinct from (old.mapping_release_id,old.site_id,old.source_feature_id,old.imported_at) then
      raise exception 'Release graph identity and provenance are immutable';
    end if;
    if tg_table_name in ('grave_access_point','mapping_display_feature') and
      (to_jsonb(new)->>'georeferencing_run_id',to_jsonb(new)->>'created_at',to_jsonb(new)->>'created_by')
        is distinct from
      (to_jsonb(old)->>'georeferencing_run_id',to_jsonb(old)->>'created_at',to_jsonb(old)->>'created_by') then
      raise exception 'Release graph selected-run and creator provenance are immutable';
    end if;
  end if;

  if tg_table_name='map_node' then
    if new.location_geom is null or exists(select 1 from extensions.st_dumppoints(new.location_geom::extensions.geometry) p
        where extensions.st_x(p.geom)::text in ('NaN','Infinity','-Infinity')
          or extensions.st_y(p.geom)::text in ('NaN','Infinity','-Infinity')) or
      extensions.st_geometrytype(new.location_geom::extensions.geometry)<>'ST_Point' or
      extensions.st_srid(new.location_geom::extensions.geometry)<>4326 or
      extensions.st_coorddim(new.location_geom::extensions.geometry)<>2 or
      extensions.st_isempty(new.location_geom::extensions.geometry) or
      not extensions.st_isvalid(new.location_geom::extensions.geometry) or
      not (extensions.st_x(new.location_geom::extensions.geometry) between -180 and 180) or
      not (extensions.st_y(new.location_geom::extensions.geometry) between -90 and 90) then
      raise exception 'Release graph node requires a valid finite 2D EPSG:4326 point';
    end if;
  elsif tg_table_name='map_edge' then
    select * into walkway from public.mapping_walkway_source w
      where w.walkway_source_id=new.source_walkway_id and w.mapping_release_id=v_release_id and w.site_id=new.site_id for share;
    if not found then raise exception 'Release graph edge has wrong walkway/source lineage'; end if;
    select * into from_node from public.map_node n where n.node_id=new.from_node_id
      and n.site_id=new.site_id and n.mapping_release_id=v_release_id for share;
    if not found then raise exception 'Release graph edge has wrong from-node release/site relationship'; end if;
    select * into to_node from public.map_node n where n.node_id=new.to_node_id
      and n.site_id=new.site_id and n.mapping_release_id=v_release_id for share;
    if not found then raise exception 'Release graph edge has wrong to-node release/site relationship'; end if;
    if new.path_geom is null or new.from_node_id=new.to_node_id or
      exists(select 1 from extensions.st_dumppoints(new.path_geom::extensions.geometry) p
        where extensions.st_x(p.geom)::text in ('NaN','Infinity','-Infinity')
          or extensions.st_y(p.geom)::text in ('NaN','Infinity','-Infinity')) or
      extensions.st_geometrytype(new.path_geom::extensions.geometry)<>'ST_LineString' or
      extensions.st_srid(new.path_geom::extensions.geometry)<>4326 or
      extensions.st_coorddim(new.path_geom::extensions.geometry)<>2 or
      extensions.st_isempty(new.path_geom::extensions.geometry) or
      not extensions.st_isvalid(new.path_geom::extensions.geometry) or
      not extensions.st_issimple(new.path_geom::extensions.geometry) or
      extensions.st_npoints(new.path_geom::extensions.geometry)<2 then
      raise exception 'Release graph edge requires a valid nonzero simple 2D EPSG:4326 LineString';
    end if;
    if not extensions.st_equals(extensions.st_startpoint(new.path_geom::extensions.geometry),from_node.location_geom::extensions.geometry) or
      not extensions.st_equals(extensions.st_endpoint(new.path_geom::extensions.geometry),to_node.location_geom::extensions.geometry) then
      raise exception 'Release graph edge endpoints must exactly equal the referenced node points';
    end if;
    if not extensions.st_coveredby(new.path_geom::extensions.geometry,walkway.centerline_geom) then
      raise exception 'Release graph edge must be covered by its source walkway lineage';
    end if;
    perform 1 from public.map_edge e
      where e.mapping_release_id=v_release_id and e.edge_id<>new.edge_id
        and e.path_geom && new.path_geom
        and extensions.st_crosses(e.path_geom::extensions.geometry,new.path_geom::extensions.geometry)
      for share;
    if found then raise exception 'Release graph edges may not cross without an exact shared node'; end if;
    perform 1 from public.map_edge e
      where e.mapping_release_id=v_release_id and e.edge_id<>new.edge_id
        and e.path_geom && new.path_geom
        and extensions.st_touches(e.path_geom::extensions.geometry,new.path_geom::extensions.geometry)
        and exists (
          select 1
          from extensions.st_dumppoints(
            extensions.st_intersection(e.path_geom::extensions.geometry,new.path_geom::extensions.geometry)
          ) intersection_point
          where not (
            ((e.from_node_id=new.from_node_id or e.to_node_id=new.from_node_id)
              and extensions.st_equals(intersection_point.geom,from_node.location_geom::extensions.geometry)) or
            ((e.from_node_id=new.to_node_id or e.to_node_id=new.to_node_id)
              and extensions.st_equals(intersection_point.geom,to_node.location_geom::extensions.geometry))
          )
        )
      for share;
    if found then raise exception 'Release graph edges may touch only at an exact shared node'; end if;
    perform 1 from public.map_edge e
      where e.mapping_release_id=v_release_id and e.edge_id<>new.edge_id
        and e.path_geom && new.path_geom
        and extensions.st_relate(e.path_geom::extensions.geometry,new.path_geom::extensions.geometry,'1********')
      for share;
    if found then raise exception 'Release graph edges may not have positive-length interior overlap'; end if;
    perform 1 from public.plot_geometry p
      where p.mapping_release_id=v_release_id
        and p.plot_geom && new.path_geom::extensions.geometry
        and extensions.st_relate(new.path_geom::extensions.geometry,p.plot_geom,'1********')
      for share;
    if found then raise exception 'Release graph edges may not route through versioned plot interiors'; end if;
    if new.review_state='approved' and
      (from_node.review_state<>'approved' or to_node.review_state<>'approved' or walkway.review_state<>'approved') then
      raise exception 'Approved graph edges require approved endpoint nodes and source walkway';
    end if;
    working_srid:=release.working_srid;
    metric_length:=extensions.st_length(extensions.st_transform(new.path_geom::extensions.geometry,working_srid));
    if metric_length<=0 or metric_length::text in ('NaN','Infinity','-Infinity') then
      raise exception 'Release graph edge metric length must be finite and positive';
    end if;
    new.distance_m:=metric_length;
    new.walking_allowed:=walkway.walking_allowed;
    if new.is_restricted or not new.walking_allowed then
      new.forward_cost_m:=null; new.reverse_cost_m:=null;
    elsif new.direction='both' then
      new.forward_cost_m:=metric_length; new.reverse_cost_m:=metric_length;
    elsif new.direction='forward' then
      new.forward_cost_m:=metric_length; new.reverse_cost_m:=null;
    elsif new.direction='reverse' then
      new.forward_cost_m:=null; new.reverse_cost_m:=metric_length;
    else
      raise exception 'Release graph edge direction is invalid';
    end if;
  elsif tg_table_name='grave_access_point' then
    if exists(select 1 from extensions.st_dumppoints(new.access_point_geom) p
      where extensions.st_x(p.geom)::text in ('NaN','Infinity','-Infinity')
        or extensions.st_y(p.geom)::text in ('NaN','Infinity','-Infinity')) then
      raise exception 'Grave access point requires a valid finite 2D EPSG:4326 point';
    end if;
  elsif tg_table_name='mapping_display_feature' then
    if exists(select 1 from extensions.st_dumppoints(new.display_geom) p
      where extensions.st_x(p.geom)::text in ('NaN','Infinity','-Infinity')
        or extensions.st_y(p.geom)::text in ('NaN','Infinity','-Infinity')) then
      raise exception 'Display feature requires valid finite Point/Polygon EPSG:4326 geometry';
    end if;
  end if;
  return new;
end $$;

create function gis_private.guard_access_point() returns trigger
language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare
  node public.map_node;
  plot public.plot_geometry;
begin
  if tg_op='DELETE' then return old; end if;
  select * into plot from public.plot_geometry p where p.mapping_release_id=new.mapping_release_id
    and p.site_id=new.site_id and p.lot_id=new.lot_id and p.area_id=new.area_id for share;
  if not found then raise exception 'Grave access point requires the correct release/site/area plot identity'; end if;
  select * into node from public.map_node n where n.node_id=new.node_id and n.site_id=new.site_id
    and n.mapping_release_id=new.mapping_release_id for share;
  if not found then raise exception 'Grave access point requires a same-release/site graph node'; end if;
  if not extensions.st_equals(new.access_point_geom,node.location_geom::extensions.geometry) then
    raise exception 'Grave access point must connect exactly to its graph node';
  end if;
  perform 1 from public.mapping_boundary b where b.mapping_release_id=new.mapping_release_id and b.kind='cemetery'
    and extensions.st_coveredby(new.access_point_geom,b.boundary_geom) for share;
  if not found then raise exception 'Grave access point must be inside the versioned cemetery boundary'; end if;
  if new.review_state='approved' then
    if plot.review_state<>'approved' or node.review_state<>'approved' then
      raise exception 'Approved grave access requires approved plot and graph node evidence';
    end if;
    perform 1 from gis_private.reachable_nodes(new.mapping_release_id) r where r=new.node_id;
    if not found then raise exception 'Approved grave access graph node is not reachable from an approved release entrance'; end if;
  end if;
  return new;
end $$;

create trigger map_node_release_guard before insert or update or delete on public.map_node
  for each row execute function gis_private.guard_release_graph();
create trigger map_edge_release_guard before insert or update or delete on public.map_edge
  for each row execute function gis_private.guard_release_graph();
create trigger grave_access_point_10_release_guard before insert or update or delete on public.grave_access_point
  for each row execute function gis_private.guard_release_graph();
create trigger grave_access_point_20_identity_guard before insert or update or delete on public.grave_access_point
  for each row execute function gis_private.guard_access_point();
create trigger mapping_display_feature_release_guard before insert or update or delete on public.mapping_display_feature
  for each row execute function gis_private.guard_release_graph();

create or replace function public.audit_safe_row(p_table_name text,p_row jsonb) returns jsonb
language sql immutable set search_path=pg_catalog,public,pg_temp as $$
  select case
    when p_table_name='map_node' and p_row->>'mapping_release_id' is not null then
      jsonb_strip_nulls(jsonb_build_object(
        'node_id',p_row->'node_id','site_id',p_row->'site_id','mapping_release_id',p_row->'mapping_release_id',
        'source_feature_id',p_row->'source_feature_id','artifact_hash',p_row->'artifact_hash',
        'layer_name',p_row->'layer_name','layer_version',p_row->'layer_version',
        'review_state',p_row->'review_state','revision',p_row->'revision',
        'imported_at',p_row->'imported_at','reviewed_at',p_row->'reviewed_at','reviewed_by',p_row->'reviewed_by'))
    when p_table_name='map_edge' and p_row->>'mapping_release_id' is not null then
      jsonb_strip_nulls(jsonb_build_object(
        'edge_id',p_row->'edge_id','site_id',p_row->'site_id','mapping_release_id',p_row->'mapping_release_id',
        'from_node_id',p_row->'from_node_id','to_node_id',p_row->'to_node_id',
        'source_feature_id',p_row->'source_feature_id','source_walkway_id',p_row->'source_walkway_id',
        'artifact_hash',p_row->'artifact_hash','layer_name',p_row->'layer_name','layer_version',p_row->'layer_version',
        'review_state',p_row->'review_state','revision',p_row->'revision',
        'imported_at',p_row->'imported_at','reviewed_at',p_row->'reviewed_at','reviewed_by',p_row->'reviewed_by'))
    when p_table_name='lot_owner' then p_row-array[
      'first_name','middle_name','last_name','suffix','aliases','address','representative_name',
      'representative_contact','representative_relation']
    when p_table_name='deceased' then p_row-'cause_of_death'
    when p_table_name='burial_record' then p_row-array['service_provider','quality_notes']
    when p_table_name='account' then p_row-'username'
    else p_row
  end;
$$;

revoke all on function public.audit_safe_row(text,jsonb) from public,anon,authenticated,service_role;
revoke all on all functions in schema gis_private from public,anon,authenticated,service_role;

comment on table public.grave_access_point is
  'Release-versioned routing destination beside a grave plot; connectivity and cemetery containment are authoritative.';
comment on table public.mapping_display_feature is
  'Release-versioned visual-only Point/Polygon features; rows do not create routing graph nodes.';
comment on column public.map_node.mapping_release_id is
  'NULL identifies an unchanged legacy graph row; non-NULL identifies protected release-owned graph content.';
comment on column public.map_edge.mapping_release_id is
  'NULL identifies an unchanged legacy graph row; non-NULL identifies protected release-owned graph content.';

commit;
