-- GraveNav Final F hosted verification fixture.
-- Run only through the authenticated linked CLI or SQL editor after M09 deployment.
-- All identities/data are synthetic, database role claims are simulated, and
-- the fixture ends with ROLLBACK. It does not prove an external JWT exchange.

begin;
set local statement_timeout='120s';

do $guard$
begin
  if exists(select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal and n.nspname='auth' and c.relname='users') then
    raise exception 'Final F refuses synthetic Auth rows while auth.users has external user triggers';
  end if;
  if exists(select 1 from public.mapping_release) or exists(select 1 from public.mapping_import) or
     exists(select 1 from public.mapping_publication) or exists(select 1 from public.mapping_publication_event) then
    raise exception 'Final F requires the reviewed zero-release/zero-selector baseline';
  end if;
end
$guard$;

create function pg_temp.assert_true(p_condition boolean,p_message text) returns void
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $fn$
begin
  if not coalesce(p_condition,false) then raise exception 'Final F assertion failed: %',p_message; end if;
end
$fn$;

create function pg_temp.expect_failure(p_sql text,p_pattern text,p_message text) returns void
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $fn$
declare caught boolean:=false; failure_message text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics failure_message=message_text;
    if failure_message !~* p_pattern then
      raise exception 'Final F unexpected error for %: %',p_message,failure_message;
    end if;
    caught:=true;
  end;
  if not caught then raise exception 'Final F expected failure was not raised: %',p_message; end if;
end
$fn$;
grant execute on function pg_temp.assert_true(boolean,text),pg_temp.expect_failure(text,text,text)
  to authenticated,anon,service_role;

insert into auth.users(id) values
  ('f1500000-0000-4000-8000-000000000001'),
  ('f1500000-0000-4000-8000-000000000002'),
  ('f1500000-0000-4000-8000-000000000003'),
  ('f1500000-0000-4000-8000-000000000004');
insert into public.account(account_id,role_id,username,is_active,account_status,approved_at)
select actor_id,r.role_id,username,is_active,account_status,case when is_active then transaction_timestamp() end
from (values
  ('f1500000-0000-4000-8000-000000000001'::uuid,'zz-final-f-admin',true,'ACTIVE','ADMIN'),
  ('f1500000-0000-4000-8000-000000000002'::uuid,'zz-final-f-manager',true,'ACTIVE','MANAGER'),
  ('f1500000-0000-4000-8000-000000000003'::uuid,'zz-final-f-inactive',false,'PENDING','ADMIN'),
  ('f1500000-0000-4000-8000-000000000004'::uuid,'zz-final-f-other-admin',true,'ACTIVE','ADMIN')
) actor(actor_id,username,is_active,account_status,role_name)
join public.role r on r.role_name=actor.role_name;

insert into public.site(site_id,site_name,address) values
  (915000000001,'ZZ FINAL F SYNTHETIC SITE','Transactional fixture; never commit'),
  (915000000002,'ZZ FINAL F SYNTHETIC OTHER SITE','Transactional fixture; never commit');
insert into public.area(area_id,site_id,area_code,area_name,area_category) values
  (915000000011,915000000001,'ZZ-FINAL-F-PILOT','ZZ FINAL F pilot','garden'),
  (915000000012,915000000001,'ZZ-FINAL-F-EXTRA','ZZ FINAL F extra','garden'),
  (915000000021,915000000002,'ZZ-FINAL-F-OTHER','ZZ FINAL F other','garden');

select set_config('request.jwt.claim.sub','f1500000-0000-4000-8000-000000000001',true);
do $create_releases$
declare item record; result jsonb;
begin
  for item in select * from (values
    ('zz-final-f-first','pilot',915000000011::bigint),
    ('zz-final-f-second','pilot',915000000011::bigint),
    ('zz-final-f-atomic','pilot',915000000011::bigint),
    ('zz-final-f-stale','pilot',915000000011::bigint),
    ('zz-final-f-rejected','pilot',915000000011::bigint),
    ('zz-final-f-missing','pilot',915000000011::bigint),
    ('zz-final-f-wrong','pilot',915000000011::bigint),
    ('zz-final-f-extra','pilot',915000000011::bigint),
    ('zz-final-f-validated','pilot',915000000011::bigint),
    ('zz-final-f-staged','pilot',915000000011::bigint),
    ('zz-final-f-draft','pilot',915000000011::bigint),
    ('zz-final-f-full','full',null::bigint)
  ) v(code,scope_kind,pilot_area_id)
  loop
    result:=public.staff_create_mapping_release(jsonb_build_object(
      'site_id','915000000001','release_code',item.code,'title','ZZ FINAL F synthetic release',
      'description','Transactional hosted verification only','scope_kind',item.scope_kind,
      'pilot_area_id',case when item.pilot_area_id is null then null else item.pilot_area_id::text end,
      'package_reference','zz-final-f/package.zip','package_hash',repeat('8',64),
      'source_plan_reference','zz-final-f/plan.pdf','source_plan_version','v1',
      'source_plan_hash',repeat('7',64),'source_coordinate_space','pixels',
      'field_srid',4326,'working_srid',32651,'published_srid',4326,'qgis_version','3.40',
      'notes','ZZ FINAL F PRIVATE SYNTHETIC NOTE'),gen_random_uuid());
    perform pg_temp.assert_true(result->>'state'='draft' and (result->>'revision')::integer=1,
      'protected synthetic release creation');
  end loop;
end
$create_releases$;

create temp table final_f_ids as
select (select release_id from public.mapping_release where release_code='zz-final-f-first') first_id;
grant select on table final_f_ids to authenticated,anon,service_role;

-- Owner-only fixture preparation mirrors the reviewed disposable-DB helper.
-- Triggers are re-enabled before protected lifecycle calls are tested.
alter table public.lot disable trigger user;
alter table public.mapping_release disable trigger user;
alter table public.mapping_release_area disable trigger user;
alter table public.georeferencing_run disable trigger user;
alter table public.mapping_boundary disable trigger user;
alter table public.plot_geometry disable trigger user;
alter table public.mapping_walkway_source disable trigger user;
alter table public.map_node disable trigger user;
alter table public.map_edge disable trigger user;
alter table public.grave_access_point disable trigger user;
alter table public.mapping_import disable trigger user;
alter table public.mapping_import_report disable trigger user;

create function pg_temp.seed_ready_release(
  p_code text,p_lot_id bigint,p_node_a bigint,p_node_b bigint,p_edge_id bigint
) returns void language plpgsql security invoker
set search_path=pg_catalog,public,extensions,pg_temp as $seed$
declare release_uuid uuid; run_uuid uuid:=gen_random_uuid(); import_uuid uuid:=gen_random_uuid();
  report_uuid uuid:=gen_random_uuid(); root_request uuid:=gen_random_uuid(); walkway_uuid uuid:=gen_random_uuid();
begin
  select release_id into strict release_uuid from public.mapping_release where release_code=p_code;
  insert into public.lot(lot_id,area_id,lot_code,status,coordinate_status,coordinate_verified)
    values(p_lot_id,915000000011,'ZZ-'||p_lot_id::text,'AVAILABLE','pending',false);
  insert into public.georeferencing_run(run_id,release_id,site_id,run_code,source_reference,source_hash,
    source_width,source_height,source_coordinate_space,working_srid,output_srid,method,processed_at,qgis_version,
    output_artifact_reference,output_artifact_hash,review_state,created_by,reviewed_at,reviewed_by)
  values(run_uuid,release_uuid,915000000001,'run-'||p_lot_id::text,'zz-final-f/plan.png',repeat('a',64),
    1000,1000,'pixels',32651,4326,'polynomial-1',transaction_timestamp(),'3.40',
    'zz-final-f/output.tif',repeat('b',64),'accepted','f1500000-0000-4000-8000-000000000001',
    transaction_timestamp(),'f1500000-0000-4000-8000-000000000001');
  insert into public.mapping_boundary(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,
    artifact_hash,layer_name,layer_version,kind,area_id,boundary_geom,review_state,created_by,reviewed_at,reviewed_by)
  values
    (release_uuid,915000000001,run_uuid,'cemetery-'||p_lot_id::text,repeat('c',64),'boundaries','v1','cemetery',null,
      extensions.st_geomfromtext('POLYGON((123 13,123.02 13,123.02 13.02,123 13.02,123 13))',4326),
      'approved','f1500000-0000-4000-8000-000000000001',transaction_timestamp(),'f1500000-0000-4000-8000-000000000001'),
    (release_uuid,915000000001,run_uuid,'area-'||p_lot_id::text,repeat('c',64),'boundaries','v1','area',915000000011,
      extensions.st_geomfromtext('POLYGON((123.001 13.001,123.019 13.001,123.019 13.019,123.001 13.019,123.001 13.001))',4326),
      'approved','f1500000-0000-4000-8000-000000000001',transaction_timestamp(),'f1500000-0000-4000-8000-000000000001');
  insert into public.plot_geometry(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,
    artifact_hash,layer_name,layer_version,lot_id,area_id,plot_geom,review_state,created_by,reviewed_at,reviewed_by)
  values(release_uuid,915000000001,run_uuid,'plot-'||p_lot_id::text,repeat('d',64),'plots','v1',p_lot_id,915000000011,
    extensions.st_geomfromtext('POLYGON((123.005 13.005,123.0052 13.005,123.0052 13.0052,123.005 13.0052,123.005 13.005))',4326),
    'approved','f1500000-0000-4000-8000-000000000001',transaction_timestamp(),'f1500000-0000-4000-8000-000000000001');
  insert into public.mapping_walkway_source(walkway_source_id,mapping_release_id,site_id,georeferencing_run_id,
    source_feature_id,artifact_hash,layer_name,layer_version,area_id,walkway_type,walking_allowed,centerline_geom,
    review_state,created_by,reviewed_at,reviewed_by)
  values(walkway_uuid,release_uuid,915000000001,run_uuid,'walk-'||p_lot_id::text,repeat('e',64),'walkways','v1',
    915000000011,'path',true,extensions.st_geomfromtext('LINESTRING(123.001 13.005,123.018 13.005)',4326),
    'approved','f1500000-0000-4000-8000-000000000001',transaction_timestamp(),'f1500000-0000-4000-8000-000000000001');
  insert into public.map_node(node_id,site_id,node_name,node_type,location_geom,mapping_release_id,
    source_feature_id,artifact_hash,layer_name,layer_version,review_state,revision,imported_at,reviewed_at,reviewed_by)
  values
    (p_node_a,915000000001,'ZZ Entrance','entrance',extensions.st_geomfromtext('POINT(123.001 13.005)',4326)::extensions.geography,
      release_uuid,'node-a-'||p_lot_id::text,repeat('f',64),'nodes','v1','approved',1,transaction_timestamp(),transaction_timestamp(),'f1500000-0000-4000-8000-000000000001'),
    (p_node_b,915000000001,'ZZ Destination','junction',extensions.st_geomfromtext('POINT(123.005 13.005)',4326)::extensions.geography,
      release_uuid,'node-b-'||p_lot_id::text,repeat('f',64),'nodes','v1','approved',1,transaction_timestamp(),transaction_timestamp(),'f1500000-0000-4000-8000-000000000001');
  insert into public.map_edge(edge_id,from_node_id,to_node_id,path_geom,distance_m,edge_type,is_restricted,
    mapping_release_id,site_id,source_feature_id,artifact_hash,layer_name,layer_version,review_state,revision,imported_at,
    source_walkway_id,walking_allowed,direction,forward_cost_m,reverse_cost_m,reviewed_at,reviewed_by)
  values(p_edge_id,p_node_a,p_node_b,
    extensions.st_geomfromtext('LINESTRING(123.001 13.005,123.005 13.005)',4326)::extensions.geography,
    433,'path',false,release_uuid,915000000001,'edge-'||p_lot_id::text,repeat('1',64),'edges','v1','approved',1,
    transaction_timestamp(),walkway_uuid,true,'both',433,433,transaction_timestamp(),'f1500000-0000-4000-8000-000000000001');
  insert into public.grave_access_point(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,
    artifact_hash,layer_name,layer_version,lot_id,area_id,node_id,access_point_geom,review_state,created_by,reviewed_at,reviewed_by)
  values(release_uuid,915000000001,run_uuid,'access-'||p_lot_id::text,repeat('2',64),'access','v1',p_lot_id,
    915000000011,p_node_b,extensions.st_geomfromtext('POINT(123.005 13.005)',4326),'approved',
    'f1500000-0000-4000-8000-000000000001',transaction_timestamp(),'f1500000-0000-4000-8000-000000000001');
  insert into public.mapping_import(import_id,request_id,actor_account_id,release_id,site_id,area_id,
    base_revision,target_revision,package_digest,manifest_sha256,state,revision)
  values(import_uuid,root_request,'f1500000-0000-4000-8000-000000000001',release_uuid,915000000001,
    915000000011,1,2,repeat('8',64),repeat('8',64),'finalized',5);
  insert into public.mapping_import_report(report_id,import_id,release_revision,package_digest,validator_version,
    baseline_publication_revision,live_dependency_digest,summary,entries,report_hash,created_by)
  values(report_uuid,import_uuid,2,repeat('8',64),'gis-pilot-v1',0,null,
    '{"errorCount":0,"warningCount":0,"infoCount":0}'::jsonb,'[]'::jsonb,repeat('9',64),
    'f1500000-0000-4000-8000-000000000001');
  update public.mapping_import set current_report_id=report_uuid where import_id=import_uuid;
  update public.mapping_release set status='validated',revision=3,selected_run_id=run_uuid,
    validation_report_hash=repeat('9',64),validation_summary=jsonb_build_object('schemaVersion',1,'featureCount',6,
      'errorCount',0,'warningCount',0,'reportDigest',repeat('9',64)),
    validated_at=transaction_timestamp(),validated_by='f1500000-0000-4000-8000-000000000001'
  where release_id=release_uuid;
end
$seed$;

select pg_temp.seed_ready_release('zz-final-f-first',915000000101,915000001001,915000001002,915000002001);
select pg_temp.seed_ready_release('zz-final-f-second',915000000102,915000001011,915000001012,915000002002);
select pg_temp.seed_ready_release('zz-final-f-atomic',915000000103,915000001021,915000001022,915000002003);
select pg_temp.seed_ready_release('zz-final-f-stale',915000000104,915000001031,915000001032,915000002004);
select pg_temp.seed_ready_release('zz-final-f-rejected',915000000105,915000001041,915000001042,915000002005);
select pg_temp.seed_ready_release('zz-final-f-validated',915000000109,915000001081,915000001082,915000002009);

update public.mapping_release set status='staged',revision=2 where release_code='zz-final-f-staged';
delete from public.mapping_release_area where release_id=(select release_id from public.mapping_release where release_code='zz-final-f-missing');
update public.mapping_release_area set area_id=915000000012 where release_id=(select release_id from public.mapping_release where release_code='zz-final-f-wrong');
insert into public.mapping_release_area(release_id,site_id,area_id)
select release_id,site_id,915000000012 from public.mapping_release where release_code='zz-final-f-extra';

alter table public.mapping_import_report enable trigger user;
alter table public.mapping_import enable trigger user;
alter table public.grave_access_point enable trigger user;
alter table public.map_edge enable trigger user;
alter table public.map_node enable trigger user;
alter table public.mapping_walkway_source enable trigger user;
alter table public.plot_geometry enable trigger user;
alter table public.mapping_boundary enable trigger user;
alter table public.georeferencing_run enable trigger user;
alter table public.mapping_release_area enable trigger user;
alter table public.mapping_release enable trigger user;
alter table public.lot enable trigger user;

-- ADMIN: approval, first publication, replacement, rollback and exact retries.
reset role;
select set_config('request.jwt.claim.sub','f1500000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $admin_lifecycle$
declare first_id uuid; second_id uuid; first_revision integer; result jsonb; retry jsonb;
  review_request constant uuid:='f1500000-0000-4000-8000-000000000101';
  publish_request constant uuid:='f1500000-0000-4000-8000-000000000102';
  rollback_request constant uuid:='f1500000-0000-4000-8000-000000000103';
  acknowledgements constant jsonb:=jsonb_build_object('packageDigest',repeat('8',64),'reportDigest',repeat('9',64),
    'warnings','[]'::jsonb,'suitabilityReviewed',true,'omissionsReviewed',true,'privacyReviewed',true);
  before_frozen jsonb; after_frozen jsonb; public_result jsonb;
begin
  select release_id into first_id from public.mapping_release where release_code='zz-final-f-first';
  select release_id into second_id from public.mapping_release where release_code='zz-final-f-second';
  perform pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,99,''approve'',%L::jsonb,null,gen_random_uuid())',first_id,acknowledgements::text),'stale|revision','approval revision binding');
  perform pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,3,''approve'',%L::jsonb,null,gen_random_uuid())',first_id,(acknowledgements||jsonb_build_object('reportDigest',repeat('7',64)))::text),'digest|stale|acknowledgement','approval digest binding');
  perform pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,3,''approve'',%L::jsonb,null,gen_random_uuid())',first_id,(acknowledgements||jsonb_build_object('suitabilityReviewed',false))::text),'acknowledgement|review','approval affirmative checks');
  result:=public.staff_review_mapping_release(first_id,3,'approve',acknowledgements,'ZZ FINAL F PRIVATE APPROVAL NOTE',review_request);
  retry:=public.staff_review_mapping_release(first_id,3,'approve',acknowledgements,'ZZ FINAL F PRIVATE APPROVAL NOTE',review_request);
  perform pg_temp.assert_true(result=retry and result->>'state'='approved' and (result->>'revision')::integer=4,'approval idempotency');
  perform pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,4,''approve'',%L::jsonb,''changed'',%L::uuid)',first_id,acknowledgements::text,review_request),'conflict|reused','changed approval request conflict');
  public_result:=public.public_mapping_layer(915000000001,915000000011,'nodes',1,10,null);
  perform pg_temp.assert_true(public_result->>'releaseId' is null and (public_result->>'total')::integer=0,'approved release remains non-public');

  result:=public.staff_publish_mapping_release(first_id,4,0,publish_request);
  retry:=public.staff_publish_mapping_release(first_id,4,0,publish_request);
  perform pg_temp.assert_true(result=retry and result->>'state'='published' and (result->>'scopeRevision')::integer=1,'first publication idempotency');
  perform pg_temp.expect_failure(format('select public.staff_publish_mapping_release(%L::uuid,5,1,%L::uuid)',first_id,publish_request),'conflict|reused','changed publish request conflict');
  public_result:=public.public_mapping_layer(915000000001,915000000011,'nodes',1,10,first_id);
  perform pg_temp.assert_true(public_result->>'releaseId'=first_id::text and (public_result->>'total')::integer=2,'first publication public pointer');

  select to_jsonb(r)-array['status','revision','published_at','published_by'] into before_frozen
    from public.mapping_release r where release_id=first_id;
  result:=public.staff_review_mapping_release(second_id,3,'approve',acknowledgements,null,gen_random_uuid());
  result:=public.staff_publish_mapping_release(second_id,(result->>'revision')::integer,1,gen_random_uuid());
  perform pg_temp.assert_true(result->>'releaseId'=second_id::text and (result->>'scopeRevision')::integer=2,'replacement publication');
  select to_jsonb(r)-array['status','revision','published_at','published_by'] into after_frozen
    from public.mapping_release r where release_id=first_id;
  perform pg_temp.assert_true(before_frozen=after_frozen,'replacement preserves prior frozen contents');
  public_result:=public.public_mapping_layer(915000000001,915000000011,'nodes',1,10,second_id);
  perform pg_temp.assert_true(public_result->>'releaseId'=second_id::text,'public reads move atomically to replacement');

  select revision into first_revision from public.mapping_release where release_id=first_id;
  result:=public.staff_rollback_mapping_release(first_id,first_revision,2,'ZZ FINAL F synthetic rollback',rollback_request);
  retry:=public.staff_rollback_mapping_release(first_id,first_revision,2,'ZZ FINAL F synthetic rollback',rollback_request);
  perform pg_temp.assert_true(result=retry and result->>'releaseId'=first_id::text and (result->>'scopeRevision')::integer=3,'rollback eligibility and idempotency');
  perform pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,%s,3,''changed'',%L::uuid)',first_id,first_revision,rollback_request),'conflict|reused','changed rollback request conflict');
  perform pg_temp.assert_true((select count(*)=3 and count(*) filter(where kind='publish')=2 and
    count(*) filter(where kind='rollback')=1 from public.mapping_publication_event
    where site_id=915000000001 and area_id=915000000011),'publication history append-only composition');
end
$admin_lifecycle$;
reset role;

-- The same request UUID cannot be reused by another active ADMIN.
select set_config('request.jwt.claim.sub','f1500000-0000-4000-8000-000000000004',true);
set local role authenticated;
select pg_temp.expect_failure(format(
  'select public.staff_review_mapping_release(%L::uuid,3,''approve'',%L::jsonb,''ZZ FINAL F PRIVATE APPROVAL NOTE'',%L::uuid)',
  (select release_id from public.mapping_release where release_code='zz-final-f-first'),
  jsonb_build_object('packageDigest',repeat('8',64),'reportDigest',repeat('9',64),'warnings','[]'::jsonb,
    'suitabilityReviewed',true,'omissionsReviewed',true,'privacyReviewed',true)::text,
  'f1500000-0000-4000-8000-000000000101'::uuid),'conflict|reused','changed actor request conflict');
reset role;

-- Approve an atomic target, then deliberately fail its final audit insert.
select set_config('request.jwt.claim.sub','f1500000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.staff_review_mapping_release(
  (select release_id from public.mapping_release where release_code='zz-final-f-atomic'),3,'approve',
  jsonb_build_object('packageDigest',repeat('8',64),'reportDigest',repeat('9',64),'warnings','[]'::jsonb,
    'suitabilityReviewed',true,'omissionsReviewed',true,'privacyReviewed',true),null,
  'f1500000-0000-4000-8000-000000000104');
reset role;

create temp table final_f_atomic_before as
select
  (select to_jsonb(mp) from public.mapping_publication mp where site_id=915000000001 and area_id=915000000011) selector,
  (select jsonb_agg(jsonb_build_object('id',release_id,'status',status,'revision',revision) order by release_id)
   from public.mapping_release where release_code in ('zz-final-f-first','zz-final-f-second','zz-final-f-atomic')) states,
  (select count(*) from public.mapping_publication_event where site_id=915000000001 and area_id=915000000011) event_count,
  (select count(*) from public.audit_log where record_id in (
    select release_id::text from public.mapping_release where release_code in ('zz-final-f-first','zz-final-f-second','zz-final-f-atomic'))) audit_count;

create function public.zz_final_f_fail_audit() returns trigger language plpgsql as $fail$
begin raise exception 'ZZ FINAL F synthetic final audit failure'; end
$fail$;
create trigger zz_final_f_fail_audit before insert on public.audit_log
for each row execute function public.zz_final_f_fail_audit();

select set_config('request.jwt.claim.sub','f1500000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.expect_failure(format('select public.staff_publish_mapping_release(%L::uuid,4,3,gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-atomic')),
  'ZZ FINAL F synthetic final audit failure','final audit failure atomicity');
reset role;
drop trigger zz_final_f_fail_audit on public.audit_log;
drop function public.zz_final_f_fail_audit();
select pg_temp.assert_true(
  (select to_jsonb(mp) from public.mapping_publication mp where site_id=915000000001 and area_id=915000000011)
    is not distinct from (select selector from final_f_atomic_before) and
  (select jsonb_agg(jsonb_build_object('id',release_id,'status',status,'revision',revision) order by release_id)
   from public.mapping_release where release_code in ('zz-final-f-first','zz-final-f-second','zz-final-f-atomic'))
    is not distinct from (select states from final_f_atomic_before) and
  (select count(*) from public.mapping_publication_event where site_id=915000000001 and area_id=915000000011)
    =(select event_count from final_f_atomic_before) and
  (select count(*) from public.audit_log where record_id in (
    select release_id::text from public.mapping_release where release_code in ('zz-final-f-first','zz-final-f-second','zz-final-f-atomic')))
    =(select audit_count from final_f_atomic_before),
  'failed final audit leaves selector, states, events and audit unchanged');

-- Stale live dependencies are rechecked after approval.
select set_config('request.jwt.claim.sub','f1500000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.staff_review_mapping_release(
  (select release_id from public.mapping_release where release_code='zz-final-f-stale'),3,'approve',
  jsonb_build_object('packageDigest',repeat('8',64),'reportDigest',repeat('9',64),'warnings','[]'::jsonb,
    'suitabilityReviewed',true,'omissionsReviewed',true,'privacyReviewed',true),null,gen_random_uuid());
reset role;
alter table public.lot disable trigger user;
update public.lot set deleted_at=transaction_timestamp() where lot_id=915000000104;
alter table public.lot enable trigger user;
set local role authenticated;
select pg_temp.expect_failure(format('select public.staff_publish_mapping_release(%L::uuid,4,3,gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-stale')),
  'live|dependency|lot|stale','live dependency revalidation');
reset role;
select pg_temp.assert_true((select status='approved' from public.mapping_release where release_code='zz-final-f-stale'),
  'stale publication leaves release approved');

-- The superseded rollback target is also subject to live dependency checks.
create temp table final_f_live_before as
select (select to_jsonb(mp) from public.mapping_publication mp where site_id=915000000001 and area_id=915000000011) selector,
  (select count(*) from public.mapping_publication_event) events;
alter table public.lot disable trigger user;
update public.lot set deleted_at=transaction_timestamp() where lot_id=915000000102;
alter table public.lot enable trigger user;
set local role authenticated;
select pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,%s,3,''ZZ stale rollback'',gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-second'),
  (select revision from public.mapping_release where release_code='zz-final-f-second')),
  'live|dependency|lot|stale','rollback live dependency revalidation');
reset role;
select pg_temp.assert_true((select to_jsonb(mp) from public.mapping_publication mp where site_id=915000000001 and area_id=915000000011)
  is not distinct from (select selector from final_f_live_before)
  and (select count(*) from public.mapping_publication_event)=(select events from final_f_live_before),
  'stale rollback preserves selector and history');

-- Rejection and draft/staged/validated-only/rejected rollback targets fail.
set local role authenticated;
select public.staff_review_mapping_release(
  (select release_id from public.mapping_release where release_code='zz-final-f-rejected'),3,'reject','{}'::jsonb,
  'ZZ FINAL F synthetic rejection',gen_random_uuid());
select pg_temp.expect_failure(format('select public.staff_publish_mapping_release(%L::uuid,4,3,gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-rejected')),'rejected|approved|state','rejected publish target');
select pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,4,3,''ZZ synthetic'',gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-rejected')),'rejected|superseded|eligible|state','rejected rollback target');
select pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,1,3,''ZZ synthetic'',gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-draft')),'superseded|eligible|state','draft rollback target');
select pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,2,3,''ZZ synthetic'',gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-staged')),'superseded|eligible|state','staged rollback target');
select pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,3,3,''ZZ synthetic'',gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-validated')),'superseded|eligible|state','validated rollback target');
select pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,4,3,''ZZ synthetic'',gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-atomic')),'superseded|eligible|state','never-published approved rollback target');
reset role;

-- Full, missing, wrong and extra pilot scopes fail without selector/history effects.
create temp table final_f_scope_before as
select (select count(*) from public.mapping_publication) selectors,
  (select count(*) from public.mapping_publication_event) events,
  (select count(*) from public.audit_log) audits,
  (select count(*) from gis_private.gis_mutation_request) receipts;
set local role authenticated;
select pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,1,''approve'',%L::jsonb,null,gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-full'),
  jsonb_build_object('packageDigest',repeat('8',64),'reportDigest',repeat('9',64),'warnings','[]'::jsonb,
    'suitabilityReviewed',true,'omissionsReviewed',true,'privacyReviewed',true)::text),'pilot|scope','full-scope approval');
select pg_temp.expect_failure(format('select public.staff_publish_mapping_release(%L::uuid,1,3,gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-full')),'pilot|scope','full-scope publication');
select pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,1,3,''ZZ synthetic'',gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-full')),'pilot|scope','full-scope rollback');
select pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,3,''approve'',%L::jsonb,null,gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-missing'),
  jsonb_build_object('packageDigest',repeat('8',64),'reportDigest',repeat('9',64),'warnings','[]'::jsonb,
    'suitabilityReviewed',true,'omissionsReviewed',true,'privacyReviewed',true)::text),'pilot|scope|area|membership','missing pilot membership');
select pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,3,''approve'',%L::jsonb,null,gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-wrong'),
  jsonb_build_object('packageDigest',repeat('8',64),'reportDigest',repeat('9',64),'warnings','[]'::jsonb,
    'suitabilityReviewed',true,'omissionsReviewed',true,'privacyReviewed',true)::text),'pilot|scope|area|membership','wrong pilot membership');
select pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,3,''approve'',%L::jsonb,null,gen_random_uuid())',
  (select release_id from public.mapping_release where release_code='zz-final-f-extra'),
  jsonb_build_object('packageDigest',repeat('8',64),'reportDigest',repeat('9',64),'warnings','[]'::jsonb,
    'suitabilityReviewed',true,'omissionsReviewed',true,'privacyReviewed',true)::text),'pilot|scope|area|membership','extra pilot membership');
do $invalid_scope_publication$
declare target record;
begin
  for target in select release_id,revision,release_code from public.mapping_release
    where release_code in ('zz-final-f-missing','zz-final-f-wrong','zz-final-f-extra')
  loop
    perform pg_temp.expect_failure(format('select public.staff_publish_mapping_release(%L::uuid,%s,3,gen_random_uuid())',
      target.release_id,target.revision),'pilot|scope|area|membership',target.release_code||' publication');
    perform pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,%s,3,''ZZ invalid scope'',gen_random_uuid())',
      target.release_id,target.revision),'pilot|scope|area|membership',target.release_code||' rollback');
  end loop;
end
$invalid_scope_publication$;
reset role;
select pg_temp.assert_true((select count(*) from public.mapping_publication)=(select selectors from final_f_scope_before)
  and (select count(*) from public.mapping_publication_event)=(select events from final_f_scope_before)
  and (select count(*) from public.audit_log)=(select audits from final_f_scope_before)
  and (select count(*) from gis_private.gis_mutation_request)=(select receipts from final_f_scope_before),
  'invalid scope attempts have no selector/history/audit/receipt effects');
select pg_temp.expect_failure(format('select gis_private.activate_release(%L::uuid,1,3,''publish'')',
  (select release_id from public.mapping_release where release_code='zz-final-f-full')),'pilot|scope','private full-scope activation');

-- MANAGER, inactive, anonymous and service-role application contexts cannot
-- invoke any protected publication mutation. These are SQL claim simulations.
select set_config('request.jwt.claim.sub','f1500000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,7,''reject'',''{}''::jsonb,''ZZ'',gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'administrator|permission denied|admin','MANAGER review denial');
select pg_temp.expect_failure(format('select public.staff_publish_mapping_release(%L::uuid,7,3,gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'administrator|permission denied|admin','MANAGER publication denial');
select pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,7,3,''ZZ'',gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'administrator|permission denied|admin','MANAGER rollback denial');
do $manager_private$
begin
  perform pg_temp.assert_true((select count(*) from public.mapping_import_report)=0,'MANAGER cannot read private import reports');
end
$manager_private$;
reset role;

select set_config('request.jwt.claim.sub','f1500000-0000-4000-8000-000000000003',true);
set local role authenticated;
select pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,7,''reject'',''{}''::jsonb,''ZZ'',gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'administrator|permission denied|admin','inactive review denial');
select pg_temp.expect_failure(format('select public.staff_publish_mapping_release(%L::uuid,7,3,gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'administrator|permission denied|admin','inactive publication denial');
select pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,7,3,''ZZ'',gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'administrator|permission denied|admin','inactive rollback denial');
reset role;

select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,7,''reject'',''{}''::jsonb,''ZZ'',gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'permission denied|administrator|admin','anonymous review denial');
select pg_temp.expect_failure(format('select public.staff_publish_mapping_release(%L::uuid,7,3,gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'permission denied|administrator|admin','anonymous publication denial');
select pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,7,3,''ZZ'',gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'permission denied|administrator|admin','anonymous rollback denial');
reset role;

select set_config('request.jwt.claim.sub','f1500000-0000-4000-8000-000000000001',true);
set local role service_role;
select pg_temp.expect_failure(format('select public.staff_review_mapping_release(%L::uuid,7,''reject'',''{}''::jsonb,''ZZ'',gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'permission denied|administrator|admin','service-role review denial');
select pg_temp.expect_failure(format('select public.staff_publish_mapping_release(%L::uuid,7,3,gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'permission denied|administrator|admin','service-role publication denial');
select pg_temp.expect_failure(format('select public.staff_rollback_mapping_release(%L::uuid,7,3,''ZZ'',gen_random_uuid())',(select first_id from pg_temp.final_f_ids)),'permission denied|administrator|admin','service-role rollback denial');
reset role;

-- Even an authenticated ADMIN cannot bypass direct table/helper boundaries.
set local role authenticated;
select pg_temp.expect_failure(format('update public.mapping_release set status=''approved'',revision=revision+1 where release_id=%L::uuid',(select first_id from pg_temp.final_f_ids)),'permission denied|protected|operation','direct release lifecycle write');
select pg_temp.expect_failure(format('insert into public.mapping_publication(site_id,area_id,release_id,published_by) values(915000000001,915000000011,%L::uuid,%L::uuid)',(select first_id from pg_temp.final_f_ids),'f1500000-0000-4000-8000-000000000001'),'permission denied|protected|operation','direct selector write');
select pg_temp.expect_failure(format('select gis_private.activate_release(%L::uuid,7,3,''publish'')',(select first_id from pg_temp.final_f_ids)),'permission denied','private activation denial');
reset role;

-- Anonymous public DTOs see only the active release and exclude private/raw data.
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $public_safety$
declare result jsonb;
begin
  result:=public.public_mapping_layer(915000000001,915000000011,'plots',1,20,null);
  perform pg_temp.assert_true(result->>'releaseId' is not null and (result->>'total')::integer=1,'rollback public pointer');
  perform pg_temp.assert_true(result::text !~* 'package|chunk|device|operator|private|reviewNotes|artifactHash|sourcePlan',
    'public DTO excludes raw package and private evidence');
end
$public_safety$;
reset role;
select pg_temp.assert_true((select status='superseded' from public.mapping_release where release_code='zz-final-f-second'),
  'superseded replacement is inactive');
select pg_temp.assert_true((select status='approved' from public.mapping_release where release_code='zz-final-f-atomic'),
  'approved-but-unpublished release remains non-public');

select pg_temp.assert_true(not exists(
  select 1 from public.audit_log
  where record_id in (select release_id::text from public.mapping_release where release_code like 'zz-final-f-%')
    and (coalesce(old_values,'{}'::jsonb)::text||coalesce(new_values,'{}'::jsonb)::text)
      ~* 'PRIVATE APPROVAL NOTE|geometry|device|chunk_bytes|package_reference|source_plan|raw'),
  'general audit remains sanitized');
select pg_temp.assert_true(not exists(
  select 1 from gis_private.gis_mutation_request
  where operation in ('staff_review_mapping_release','staff_publish_mapping_release','staff_rollback_mapping_release')
    and coalesce(response,'{}'::jsonb)::text ~* 'PRIVATE APPROVAL NOTE|geometry|device|chunk_bytes|source_plan|raw'),
  'mutation receipts remain sanitized');

rollback;

-- Emitted only after every assertion passed and the fixture rolled back.
select jsonb_pretty(jsonb_build_object(
  'fixture','FINAL_F_ROLLBACK_FIXTURE_PASSED','transactionRolledBack',true,
  'counts',jsonb_build_object(
    'sites',(select count(*) from public.site),'areas',(select count(*) from public.area),
    'lots',(select count(*) from public.lot),'deceased',(select count(*) from public.deceased),
    'burialRecords',(select count(*) from public.burial_record),
    'availableLots',(select count(*) from public.lot where status='AVAILABLE'),
    'pendingCoordinates',(select count(*) from public.lot where coordinate_status='pending'),
    'verifiedCoordinates',(select count(*) from public.lot where coordinate_verified),
    'coordinateGeometries',(select count(*) from public.lot where location_geom is not null),
    'pendingBurialRecords',(select count(*) from public.burial_record where record_status='pending'),
    'releases',(select count(*) from public.mapping_release),'imports',(select count(*) from public.mapping_import),
    'selectors',(select count(*) from public.mapping_publication),'events',(select count(*) from public.mapping_publication_event),
    'legacyNodes',(select count(*) from public.map_node where mapping_release_id is null),
    'legacyEdges',(select count(*) from public.map_edge where mapping_release_id is null),
    'releaseNodes',(select count(*) from public.map_node where mapping_release_id is not null),
    'releaseEdges',(select count(*) from public.map_edge where mapping_release_id is not null)),
  'hashes',jsonb_build_object(
    'legacyNodeHash',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(n)::text,'|' order by node_id),''),'UTF8')),'hex') from public.map_node n where mapping_release_id is null),
    'legacyEdgeHash',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(e)::text,'|' order by edge_id),''),'UTF8')),'hex') from public.map_edge e where mapping_release_id is null)),
  'sequences',jsonb_build_object(
    'auditSequence',(select last_value from public.audit_log_audit_id_seq),
    'mapEdgeSequence',(select last_value from public.map_edge_edge_id_seq),
    'siteSequence',(select last_value from public.site_site_id_seq),
    'areaSequence',(select last_value from public.area_area_id_seq),
    'lotSequence',(select last_value from public.lot_lot_id_seq))
)) as final_f_result;
