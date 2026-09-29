begin;

-- M04: protected, release-versioned boundaries, plot polygons and original
-- walkway lineage. This migration does not alter operational lots or legacy
-- site/area boundary columns and exposes no application mutation RPC.

create table public.mapping_boundary (
  boundary_id uuid primary key default pg_catalog.gen_random_uuid(),
  mapping_release_id uuid not null,
  site_id bigint not null,
  georeferencing_run_id uuid not null,
  source_feature_id text not null,
  artifact_hash text not null,
  layer_name text not null,
  layer_version text not null,
  kind text not null,
  area_id bigint references public.area(area_id) on delete restrict,
  boundary_geom extensions.geometry(Polygon,4326) not null,
  review_state text not null default 'pending',
  revision integer not null default 1,
  private_notes text,
  created_at timestamptz not null default transaction_timestamp(),
  imported_at timestamptz not null default transaction_timestamp(),
  created_by uuid references public.account(account_id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.account(account_id) on delete set null,
  constraint mapping_boundary_release_source_key unique (mapping_release_id,source_feature_id),
  constraint mapping_boundary_id_release_site_key unique (boundary_id,mapping_release_id,site_id),
  constraint mapping_boundary_release_site_fkey foreign key (mapping_release_id,site_id)
    references public.mapping_release(release_id,site_id) on delete restrict,
  constraint mapping_boundary_run_scope_fkey foreign key (georeferencing_run_id,mapping_release_id,site_id)
    references public.georeferencing_run(run_id,release_id,site_id) on delete restrict,
  constraint mapping_boundary_area_scope_fkey foreign key (mapping_release_id,site_id,area_id)
    references public.mapping_release_area(release_id,site_id,area_id) on delete restrict,
  constraint mapping_boundary_kind_check check (
    (kind='cemetery' and area_id is null) or (kind='area' and area_id is not null)),
  constraint mapping_boundary_source_check check (
    length(source_feature_id) between 1 and 100 and source_feature_id ~ '^[A-Za-z0-9._:-]+$'),
  constraint mapping_boundary_provenance_check check (
    artifact_hash ~ '^[0-9a-f]{64}$' and
    length(layer_name) between 1 and 100 and btrim(layer_name)<>'' and
    length(layer_version) between 1 and 100 and btrim(layer_version)<>''),
  constraint mapping_boundary_review_state_check check (review_state in ('pending','approved','rejected')),
  constraint mapping_boundary_revision_check check (revision>0),
  constraint mapping_boundary_notes_check check (private_notes is null or length(private_notes)<=2000),
  constraint mapping_boundary_review_check check (
    (review_state='pending' and reviewed_at is null and reviewed_by is null) or
    (review_state in ('approved','rejected') and reviewed_at is not null and reviewed_by is not null)),
  constraint mapping_boundary_geometry_check check (
    extensions.st_geometrytype(boundary_geom)='ST_Polygon' and
    extensions.st_srid(boundary_geom)=4326 and extensions.st_coorddim(boundary_geom)=2 and
    not extensions.st_isempty(boundary_geom) and extensions.st_isvalid(boundary_geom) and
    extensions.st_xmin(extensions.box3d(boundary_geom)) between -180 and 180 and
    extensions.st_xmax(extensions.box3d(boundary_geom)) between -180 and 180 and
    extensions.st_ymin(extensions.box3d(boundary_geom)) between -90 and 90 and
    extensions.st_ymax(extensions.box3d(boundary_geom)) between -90 and 90)
);

create table public.plot_geometry (
  plot_geometry_id uuid primary key default pg_catalog.gen_random_uuid(),
  mapping_release_id uuid not null,
  site_id bigint not null,
  georeferencing_run_id uuid not null,
  source_feature_id text not null,
  artifact_hash text not null,
  layer_name text not null,
  layer_version text not null,
  lot_id bigint not null references public.lot(lot_id) on delete restrict,
  area_id bigint not null references public.area(area_id) on delete restrict,
  plot_geom extensions.geometry(Polygon,4326) not null,
  review_state text not null default 'pending',
  revision integer not null default 1,
  private_notes text,
  created_at timestamptz not null default transaction_timestamp(),
  imported_at timestamptz not null default transaction_timestamp(),
  created_by uuid references public.account(account_id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.account(account_id) on delete set null,
  constraint plot_geometry_release_source_key unique (mapping_release_id,source_feature_id),
  constraint plot_geometry_release_lot_key unique (mapping_release_id,lot_id),
  constraint plot_geometry_id_release_site_key unique (plot_geometry_id,mapping_release_id,site_id),
  constraint plot_geometry_release_site_fkey foreign key (mapping_release_id,site_id)
    references public.mapping_release(release_id,site_id) on delete restrict,
  constraint plot_geometry_run_scope_fkey foreign key (georeferencing_run_id,mapping_release_id,site_id)
    references public.georeferencing_run(run_id,release_id,site_id) on delete restrict,
  constraint plot_geometry_area_scope_fkey foreign key (mapping_release_id,site_id,area_id)
    references public.mapping_release_area(release_id,site_id,area_id) on delete restrict,
  constraint plot_geometry_source_check check (
    length(source_feature_id) between 1 and 100 and source_feature_id ~ '^[A-Za-z0-9._:-]+$'),
  constraint plot_geometry_provenance_check check (
    artifact_hash ~ '^[0-9a-f]{64}$' and
    length(layer_name) between 1 and 100 and btrim(layer_name)<>'' and
    length(layer_version) between 1 and 100 and btrim(layer_version)<>''),
  constraint plot_geometry_review_state_check check (review_state in ('pending','approved','rejected')),
  constraint plot_geometry_revision_check check (revision>0),
  constraint plot_geometry_notes_check check (private_notes is null or length(private_notes)<=2000),
  constraint plot_geometry_review_check check (
    (review_state='pending' and reviewed_at is null and reviewed_by is null) or
    (review_state in ('approved','rejected') and reviewed_at is not null and reviewed_by is not null)),
  constraint plot_geometry_geometry_check check (
    extensions.st_geometrytype(plot_geom)='ST_Polygon' and
    extensions.st_srid(plot_geom)=4326 and extensions.st_coorddim(plot_geom)=2 and
    not extensions.st_isempty(plot_geom) and extensions.st_isvalid(plot_geom) and
    extensions.st_xmin(extensions.box3d(plot_geom)) between -180 and 180 and
    extensions.st_xmax(extensions.box3d(plot_geom)) between -180 and 180 and
    extensions.st_ymin(extensions.box3d(plot_geom)) between -90 and 90 and
    extensions.st_ymax(extensions.box3d(plot_geom)) between -90 and 90)
);

create table public.mapping_walkway_source (
  walkway_source_id uuid primary key default pg_catalog.gen_random_uuid(),
  mapping_release_id uuid not null,
  site_id bigint not null,
  georeferencing_run_id uuid not null,
  source_feature_id text not null,
  artifact_hash text not null,
  layer_name text not null,
  layer_version text not null,
  area_id bigint not null references public.area(area_id) on delete restrict,
  walkway_type text not null,
  walking_allowed boolean not null default true,
  restriction_context text,
  centerline_geom extensions.geometry(LineString,4326) not null,
  review_state text not null default 'pending',
  revision integer not null default 1,
  private_notes text,
  created_at timestamptz not null default transaction_timestamp(),
  imported_at timestamptz not null default transaction_timestamp(),
  created_by uuid references public.account(account_id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references public.account(account_id) on delete set null,
  constraint mapping_walkway_source_release_source_key unique (mapping_release_id,source_feature_id),
  constraint mapping_walkway_source_id_release_site_key unique (walkway_source_id,mapping_release_id,site_id),
  constraint mapping_walkway_source_release_site_fkey foreign key (mapping_release_id,site_id)
    references public.mapping_release(release_id,site_id) on delete restrict,
  constraint mapping_walkway_source_run_scope_fkey foreign key (georeferencing_run_id,mapping_release_id,site_id)
    references public.georeferencing_run(run_id,release_id,site_id) on delete restrict,
  constraint mapping_walkway_source_area_scope_fkey foreign key (mapping_release_id,site_id,area_id)
    references public.mapping_release_area(release_id,site_id,area_id) on delete restrict,
  constraint mapping_walkway_source_type_check check (walkway_type in ('road','path','entrance')),
  constraint mapping_walkway_source_source_check check (
    length(source_feature_id) between 1 and 100 and source_feature_id ~ '^[A-Za-z0-9._:-]+$'),
  constraint mapping_walkway_source_provenance_check check (
    artifact_hash ~ '^[0-9a-f]{64}$' and
    length(layer_name) between 1 and 100 and btrim(layer_name)<>'' and
    length(layer_version) between 1 and 100 and btrim(layer_version)<>''),
  constraint mapping_walkway_source_context_check check (
    restriction_context is null or length(restriction_context)<=500),
  constraint mapping_walkway_source_review_state_check check (review_state in ('pending','approved','rejected')),
  constraint mapping_walkway_source_revision_check check (revision>0),
  constraint mapping_walkway_source_notes_check check (private_notes is null or length(private_notes)<=2000),
  constraint mapping_walkway_source_review_check check (
    (review_state='pending' and reviewed_at is null and reviewed_by is null) or
    (review_state in ('approved','rejected') and reviewed_at is not null and reviewed_by is not null)),
  constraint mapping_walkway_source_geometry_check check (
    extensions.st_geometrytype(centerline_geom)='ST_LineString' and
    extensions.st_srid(centerline_geom)=4326 and extensions.st_coorddim(centerline_geom)=2 and
    not extensions.st_isempty(centerline_geom) and extensions.st_isvalid(centerline_geom) and
    extensions.st_npoints(centerline_geom)>=2 and
    extensions.st_xmin(extensions.box3d(centerline_geom)) between -180 and 180 and
    extensions.st_xmax(extensions.box3d(centerline_geom)) between -180 and 180 and
    extensions.st_ymin(extensions.box3d(centerline_geom)) between -90 and 90 and
    extensions.st_ymax(extensions.box3d(centerline_geom)) between -90 and 90)
);

create unique index mapping_boundary_one_cemetery_idx on public.mapping_boundary(mapping_release_id)
  where kind='cemetery';
create unique index mapping_boundary_one_area_idx on public.mapping_boundary(mapping_release_id,area_id)
  where kind='area';
create index mapping_boundary_release_kind_idx on public.mapping_boundary(mapping_release_id,kind,area_id);
create index mapping_boundary_area_idx on public.mapping_boundary(area_id) where area_id is not null;
create index mapping_boundary_run_idx on public.mapping_boundary(georeferencing_run_id);
create index mapping_boundary_created_by_idx on public.mapping_boundary(created_by);
create index mapping_boundary_reviewed_by_idx on public.mapping_boundary(reviewed_by);
create index mapping_boundary_geom_gist on public.mapping_boundary using gist(boundary_geom);

create index plot_geometry_release_area_idx on public.plot_geometry(mapping_release_id,area_id,lot_id);
create index plot_geometry_area_idx on public.plot_geometry(area_id);
create index plot_geometry_lot_idx on public.plot_geometry(lot_id);
create index plot_geometry_run_idx on public.plot_geometry(georeferencing_run_id);
create index plot_geometry_created_by_idx on public.plot_geometry(created_by);
create index plot_geometry_reviewed_by_idx on public.plot_geometry(reviewed_by);
create index plot_geometry_geom_gist on public.plot_geometry using gist(plot_geom);

create index mapping_walkway_source_release_area_idx on public.mapping_walkway_source(mapping_release_id,area_id,source_feature_id);
create index mapping_walkway_source_area_idx on public.mapping_walkway_source(area_id);
create index mapping_walkway_source_run_idx on public.mapping_walkway_source(georeferencing_run_id);
create index mapping_walkway_source_created_by_idx on public.mapping_walkway_source(created_by);
create index mapping_walkway_source_reviewed_by_idx on public.mapping_walkway_source(reviewed_by);
create index mapping_walkway_source_geom_gist on public.mapping_walkway_source using gist(centerline_geom);

alter table public.mapping_boundary enable row level security;
alter table public.plot_geometry enable row level security;
alter table public.mapping_walkway_source enable row level security;
revoke all on public.mapping_boundary,public.plot_geometry,public.mapping_walkway_source
  from public,anon,authenticated,service_role;
grant select on public.mapping_boundary,public.plot_geometry,public.mapping_walkway_source to authenticated;
create policy mapping_boundary_admin_read on public.mapping_boundary for select to authenticated
  using (public.is_active_admin());
create policy plot_geometry_admin_read on public.plot_geometry for select to authenticated
  using (public.is_active_admin());
create policy mapping_walkway_source_admin_read on public.mapping_walkway_source for select to authenticated
  using (public.is_active_admin());

create function gis_private.guard_gis_content() returns trigger
language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare
  owner_name name;
  pending_count integer;
  operation text;
  release public.mapping_release;
  run_state text;
  v_release_id uuid;
  row_site_id bigint;
  row_run_id uuid;
begin
  select pg_get_userbyid(c.relowner) into owner_name from pg_class c where c.oid=tg_relid;
  if current_user<>owner_name then
    raise exception 'Protected GIS content owner operation required' using errcode='42501';
  end if;
  perform gis_private.assert_admin();
  select count(*),min(q.operation) into pending_count,operation
  from gis_private.gis_mutation_request q
  where q.actor_account_id=auth.uid() and q.response is null and q.created_at=transaction_timestamp();
  if pending_count<>1 or operation<>'staff_finalize_mapping_import' then
    raise exception 'Protected pending GIS finalization operation required' using errcode='42501';
  end if;

  if tg_op='DELETE' then
    v_release_id:=old.mapping_release_id; row_site_id:=old.site_id; row_run_id:=old.georeferencing_run_id;
  else
    v_release_id:=new.mapping_release_id; row_site_id:=new.site_id; row_run_id:=new.georeferencing_run_id;
  end if;
  select * into release from public.mapping_release r where r.release_id=v_release_id for update;
  if not found or release.site_id<>row_site_id then raise exception 'GIS content release/site mismatch'; end if;
  if release.status<>'staged' or release.reviewed_at is not null or release.published_at is not null then
    raise exception 'GIS content may be replaced only for a never-frozen staged release';
  end if;
  select review_state into run_state from public.georeferencing_run
  where run_id=row_run_id and georeferencing_run.release_id=v_release_id and site_id=row_site_id for share;
  if run_state is distinct from 'accepted' or
    (release.selected_run_id is not null and release.selected_run_id is distinct from row_run_id) then
    raise exception 'GIS content must preserve an accepted same-release georeferencing run relationship';
  end if;
  if tg_op='DELETE' then return old; end if;

  if new.created_by is distinct from auth.uid() then raise exception 'GIS content creator must be the protected actor'; end if;
  if new.review_state='pending' then
    if new.reviewed_at is not null or new.reviewed_by is not null then raise exception 'Pending GIS content cannot be reviewed'; end if;
  elsif new.reviewed_at is null or new.reviewed_by is distinct from auth.uid() then
    raise exception 'Reviewed GIS content requires the protected reviewer and timestamp';
  end if;
  if tg_op='INSERT' then
    if new.revision<>1 then raise exception 'New GIS content must start at revision one'; end if;
  else
    if new.revision<>old.revision+1 then raise exception 'GIS content revision must increment exactly once'; end if;
    if (new.mapping_release_id,new.site_id,new.georeferencing_run_id,new.source_feature_id,new.created_at,new.created_by)
      is distinct from
      (old.mapping_release_id,old.site_id,old.georeferencing_run_id,old.source_feature_id,old.created_at,old.created_by) then
      raise exception 'GIS content identity and selected-run provenance are immutable';
    end if;
  end if;

  if tg_table_name='mapping_boundary' then
    if exists(select 1 from extensions.st_dumppoints(new.boundary_geom) p
      where extensions.st_x(p.geom)::text in ('NaN','Infinity','-Infinity')
        or extensions.st_y(p.geom)::text in ('NaN','Infinity','-Infinity')) then
      raise exception 'Boundary geometry must be a valid finite nonempty 2D EPSG:4326 polygon';
    end if;
    if extensions.st_geometrytype(new.boundary_geom)<>'ST_Polygon' or
      extensions.st_srid(new.boundary_geom)<>4326 or extensions.st_coorddim(new.boundary_geom)<>2 or
      extensions.st_isempty(new.boundary_geom) or not extensions.st_isvalid(new.boundary_geom) or
      not (extensions.st_xmin(extensions.box3d(new.boundary_geom)) between -180 and 180) or
      not (extensions.st_xmax(extensions.box3d(new.boundary_geom)) between -180 and 180) or
      not (extensions.st_ymin(extensions.box3d(new.boundary_geom)) between -90 and 90) or
      not (extensions.st_ymax(extensions.box3d(new.boundary_geom)) between -90 and 90) then
      raise exception 'Boundary geometry must be a valid finite nonempty 2D EPSG:4326 polygon';
    end if;
    if new.kind='cemetery' then
      if exists(select 1 from public.mapping_boundary b where b.mapping_release_id=v_release_id and b.kind='area'
        and not extensions.st_coveredby(b.boundary_geom,new.boundary_geom)) then
        raise exception 'Cemetery boundary must cover every existing versioned area boundary';
      end if;
    else
      perform 1 from public.area a where a.area_id=new.area_id and a.site_id=new.site_id for share;
      if not found then raise exception 'Boundary area must belong to the release site'; end if;
      perform 1 from public.mapping_boundary b where b.mapping_release_id=v_release_id and b.kind='cemetery'
        and extensions.st_coveredby(new.boundary_geom,b.boundary_geom) for share;
      if not found then raise exception 'Versioned area boundary must be covered by the cemetery boundary'; end if;
      if exists(select 1 from public.plot_geometry p where p.mapping_release_id=v_release_id
        and p.area_id=new.area_id and not extensions.st_coveredby(p.plot_geom,new.boundary_geom)) then
        raise exception 'Versioned area boundary must cover every existing plot polygon in that area';
      end if;
    end if;
  elsif tg_table_name='mapping_walkway_source' then
    if exists(select 1 from extensions.st_dumppoints(new.centerline_geom) p
      where extensions.st_x(p.geom)::text in ('NaN','Infinity','-Infinity')
        or extensions.st_y(p.geom)::text in ('NaN','Infinity','-Infinity')) then
      raise exception 'Walkway geometry must be a valid finite nonempty 2D EPSG:4326 LineString';
    end if;
    if extensions.st_geometrytype(new.centerline_geom)<>'ST_LineString' or
      extensions.st_srid(new.centerline_geom)<>4326 or extensions.st_coorddim(new.centerline_geom)<>2 or
      extensions.st_isempty(new.centerline_geom) or not extensions.st_isvalid(new.centerline_geom) or
      extensions.st_npoints(new.centerline_geom)<2 or
      not (extensions.st_xmin(extensions.box3d(new.centerline_geom)) between -180 and 180) or
      not (extensions.st_xmax(extensions.box3d(new.centerline_geom)) between -180 and 180) or
      not (extensions.st_ymin(extensions.box3d(new.centerline_geom)) between -90 and 90) or
      not (extensions.st_ymax(extensions.box3d(new.centerline_geom)) between -90 and 90) then
      raise exception 'Walkway geometry must be a valid finite nonempty 2D EPSG:4326 LineString';
    end if;
    perform 1 from public.area a join public.mapping_release_area ra
      on ra.area_id=a.area_id and ra.site_id=a.site_id
      where a.area_id=new.area_id and a.site_id=new.site_id and ra.release_id=v_release_id for share of a;
    if not found then raise exception 'Walkway area must belong to the release scope and site'; end if;
  end if;
  return new;
end $$;

create function gis_private.validate_plot_identity() returns trigger
language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare lot public.lot; area_site bigint;
begin
  if tg_op='DELETE' then return old; end if;
  if exists(select 1 from extensions.st_dumppoints(new.plot_geom) p
    where extensions.st_x(p.geom)::text in ('NaN','Infinity','-Infinity')
      or extensions.st_y(p.geom)::text in ('NaN','Infinity','-Infinity')) then
    raise exception 'Plot geometry must be a valid finite nonempty 2D EPSG:4326 polygon';
  end if;
  if extensions.st_geometrytype(new.plot_geom)<>'ST_Polygon' or
    extensions.st_srid(new.plot_geom)<>4326 or extensions.st_coorddim(new.plot_geom)<>2 or
    extensions.st_isempty(new.plot_geom) or not extensions.st_isvalid(new.plot_geom) or
    not (extensions.st_xmin(extensions.box3d(new.plot_geom)) between -180 and 180) or
    not (extensions.st_xmax(extensions.box3d(new.plot_geom)) between -180 and 180) or
    not (extensions.st_ymin(extensions.box3d(new.plot_geom)) between -90 and 90) or
    not (extensions.st_ymax(extensions.box3d(new.plot_geom)) between -90 and 90) then
    raise exception 'Plot geometry must be a valid finite nonempty 2D EPSG:4326 polygon';
  end if;
  select * into lot from public.lot where lot_id=new.lot_id for share;
  if not found then raise exception 'Plot geometry lot does not exist'; end if;
  if lot.deleted_at is not null then raise exception 'Plot geometry requires a current, non-removed lot'; end if;
  if lot.area_id<>new.area_id then raise exception 'Plot geometry lot/area mismatch'; end if;
  select site_id into area_site from public.area where area_id=new.area_id for share;
  if area_site is null or area_site<>new.site_id then raise exception 'Plot geometry area/site mismatch'; end if;
  perform 1 from public.mapping_release_area ra where ra.release_id=new.mapping_release_id
    and ra.site_id=new.site_id and ra.area_id=new.area_id for share;
  if not found then raise exception 'Plot geometry area is outside the release scope'; end if;
  perform 1 from public.mapping_boundary b where b.mapping_release_id=new.mapping_release_id
    and b.kind='cemetery' and extensions.st_coveredby(new.plot_geom,b.boundary_geom) for share;
  if not found then raise exception 'Plot geometry must be covered by the versioned cemetery boundary'; end if;
  perform 1 from public.mapping_boundary b where b.mapping_release_id=new.mapping_release_id
    and b.kind='area' and b.area_id=new.area_id and extensions.st_coveredby(new.plot_geom,b.boundary_geom) for share;
  if not found then raise exception 'Plot geometry must be covered by its versioned area boundary'; end if;
  perform 1 from public.plot_geometry p
    where p.mapping_release_id=new.mapping_release_id
      and p.plot_geometry_id<>new.plot_geometry_id
      and p.plot_geom && new.plot_geom
      and extensions.st_relate(p.plot_geom,new.plot_geom,'2********')
    for share;
  if found then raise exception 'Plot polygon interior overlap conflict'; end if;
  return new;
end $$;

create function gis_private.validate_geometry_core(p_release_id uuid) returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$
declare
  boundary_count integer; plot_count integer; walkway_count integer;
  missing_cemetery integer; missing_area integer; boundary_error integer;
  plot_identity_error integer; plot_containment_error integer; overlap_error integer;
  walkway_error integer; selected_run_error integer; error_count integer;
begin
  if p_release_id is null or not exists(select 1 from public.mapping_release where release_id=p_release_id) then
    raise exception 'Mapping release not found';
  end if;
  select count(*)::integer into boundary_count from public.mapping_boundary where mapping_release_id=p_release_id;
  select count(*)::integer into plot_count from public.plot_geometry where mapping_release_id=p_release_id;
  select count(*)::integer into walkway_count from public.mapping_walkway_source where mapping_release_id=p_release_id;
  select count(*)::integer into missing_cemetery from public.mapping_release r
    where r.release_id=p_release_id and not exists(select 1 from public.mapping_boundary b
      where b.mapping_release_id=r.release_id and b.kind='cemetery');
  select count(*)::integer into missing_area from public.mapping_release_area ra
    where ra.release_id=p_release_id and not exists(select 1 from public.mapping_boundary b
      where b.mapping_release_id=ra.release_id and b.kind='area' and b.area_id=ra.area_id);
  select count(*)::integer into selected_run_error from public.mapping_release r
    where r.release_id=p_release_id and (
      (r.selected_run_id is not null and not exists(
        select 1 from public.georeferencing_run gr where gr.run_id=r.selected_run_id
          and gr.release_id=r.release_id and gr.site_id=r.site_id and gr.review_state='accepted')) or
      (select count(distinct run_id) from (
        select georeferencing_run_id run_id from public.mapping_boundary where mapping_release_id=r.release_id
        union all select georeferencing_run_id from public.plot_geometry where mapping_release_id=r.release_id
        union all select georeferencing_run_id from public.mapping_walkway_source where mapping_release_id=r.release_id
      ) runs)>1);
  select count(*)::integer into boundary_error from public.mapping_boundary b
    join public.mapping_release r on r.release_id=b.mapping_release_id
    where b.mapping_release_id=p_release_id and (
      b.site_id<>r.site_id or (r.selected_run_id is not null and b.georeferencing_run_id is distinct from r.selected_run_id) or
      (b.kind='area' and not exists(select 1 from public.area a where a.area_id=b.area_id and a.site_id=b.site_id)) or
      (b.kind='area' and not exists(select 1 from public.mapping_boundary c where c.mapping_release_id=b.mapping_release_id
        and c.kind='cemetery' and extensions.st_coveredby(b.boundary_geom,c.boundary_geom))));
  select count(*)::integer into plot_identity_error from public.plot_geometry p
    join public.mapping_release r on r.release_id=p.mapping_release_id
    where p.mapping_release_id=p_release_id and (p.site_id<>r.site_id or (r.selected_run_id is not null and p.georeferencing_run_id is distinct from r.selected_run_id)
      or not exists(select 1 from public.lot l join public.area a on a.area_id=l.area_id
        where l.lot_id=p.lot_id and l.deleted_at is null and l.area_id=p.area_id and a.site_id=p.site_id));
  select count(*)::integer into plot_containment_error from public.plot_geometry p
    where p.mapping_release_id=p_release_id and (
      not exists(select 1 from public.mapping_boundary b where b.mapping_release_id=p.mapping_release_id
        and b.kind='cemetery' and extensions.st_coveredby(p.plot_geom,b.boundary_geom)) or
      not exists(select 1 from public.mapping_boundary b where b.mapping_release_id=p.mapping_release_id
        and b.kind='area' and b.area_id=p.area_id and extensions.st_coveredby(p.plot_geom,b.boundary_geom)));
  select count(*)::integer into overlap_error from public.plot_geometry a join public.plot_geometry b
    on b.mapping_release_id=a.mapping_release_id and b.plot_geometry_id>a.plot_geometry_id
    and b.plot_geom && a.plot_geom and extensions.st_relate(b.plot_geom,a.plot_geom,'2********')
    where a.mapping_release_id=p_release_id;
  select count(*)::integer into walkway_error from public.mapping_walkway_source w
    join public.mapping_release r on r.release_id=w.mapping_release_id
    where w.mapping_release_id=p_release_id and (w.site_id<>r.site_id or (r.selected_run_id is not null and w.georeferencing_run_id is distinct from r.selected_run_id)
      or not exists(select 1 from public.area a join public.mapping_release_area ra
        on ra.release_id=w.mapping_release_id and ra.site_id=a.site_id and ra.area_id=a.area_id
        where a.area_id=w.area_id and a.site_id=w.site_id));
  error_count:=missing_cemetery+missing_area+selected_run_error+boundary_error+plot_identity_error+
    plot_containment_error+overlap_error+walkway_error;
  return jsonb_build_object(
    'schemaVersion',1,'releaseId',p_release_id::text,
    'boundaryCount',boundary_count,'plotCount',plot_count,'walkwayCount',walkway_count,
    'errorCount',error_count,'errors',jsonb_build_object(
      'missingCemeteryBoundary',missing_cemetery,'missingAreaBoundary',missing_area,
      'selectedRun',selected_run_error,'boundaryIdentityOrContainment',boundary_error,
      'plotIdentity',plot_identity_error,'plotContainment',plot_containment_error,
      'plotInteriorOverlap',overlap_error,'walkwayIdentity',walkway_error));
end $$;

create trigger mapping_boundary_content_guard before insert or update or delete on public.mapping_boundary
  for each row execute function gis_private.guard_gis_content();
create trigger plot_geometry_10_content_guard before insert or update or delete on public.plot_geometry
  for each row execute function gis_private.guard_gis_content();
create trigger plot_geometry_20_identity_guard before insert or update or delete on public.plot_geometry
  for each row execute function gis_private.validate_plot_identity();
create trigger mapping_walkway_source_content_guard before insert or update or delete on public.mapping_walkway_source
  for each row execute function gis_private.guard_gis_content();

revoke all on all functions in schema gis_private from public,anon,authenticated,service_role;

comment on table public.mapping_boundary is
  'Protected release-versioned cemetery and area boundaries; never replaces legacy site/area boundary columns.';
comment on table public.plot_geometry is
  'Protected release-versioned polygons linked only to existing operational lot identities.';
comment on table public.mapping_walkway_source is
  'Protected release-versioned original road/walkway lineage, not a routing graph.';

commit;
