begin;

-- M09: explicit ADMIN approval, atomic pilot publication, and protected rollback.
-- This migration does not create a selector, publish a release, or modify legacy map data.

alter table public.mapping_release drop constraint mapping_release_summary_check;
alter table public.mapping_release add constraint mapping_release_summary_check check (validation_summary is null or (
  jsonb_typeof(validation_summary)='object' and octet_length(validation_summary::text)<=8192 and
  validation_summary-array['schemaVersion','featureCount','errorCount','warningCount','reportDigest',
    'acknowledgementDigest','liveDependencyDigest']='{}'::jsonb and
  (not(validation_summary?'schemaVersion') or validation_summary->'schemaVersion'='1'::jsonb) and
  (not(validation_summary?'featureCount') or (jsonb_typeof(validation_summary->'featureCount')='number' and validation_summary->>'featureCount'~'^[0-9]{1,9}$')) and
  (not(validation_summary?'errorCount') or (jsonb_typeof(validation_summary->'errorCount')='number' and validation_summary->>'errorCount'~'^[0-9]{1,9}$')) and
  (not(validation_summary?'warningCount') or (jsonb_typeof(validation_summary->'warningCount')='number' and validation_summary->>'warningCount'~'^[0-9]{1,9}$')) and
  (not(validation_summary?'reportDigest') or (jsonb_typeof(validation_summary->'reportDigest')='string' and validation_summary->>'reportDigest'~'^[0-9a-f]{64}$')) and
  (not(validation_summary?'acknowledgementDigest') or (jsonb_typeof(validation_summary->'acknowledgementDigest')='string' and validation_summary->>'acknowledgementDigest'~'^[0-9a-f]{64}$')) and
  (not(validation_summary?'liveDependencyDigest') or (jsonb_typeof(validation_summary->'liveDependencyDigest')='string' and validation_summary->>'liveDependencyDigest'~'^[0-9a-f]{64}$'))
));

alter table gis_private.gis_mutation_request drop constraint gis_request_response_check;
alter table gis_private.gis_mutation_request add constraint gis_request_response_check check (response is null or (
  jsonb_typeof(response)='object' and octet_length(response::text)<=8192 and
  response-array[
    'schemaVersion','id','revision','state','requestId','count','digest','reportId','reportDigest',
    'importId','releaseId','rootRequestId','operationId','packageDigest','baseRevision','targetRevision',
    'currentReleaseRevision','fileCount','receivedChunkCount','receivedBytes','missingChunkCount',
    'scopeRevision','previousReleaseId'
  ]='{}'::jsonb and
  response?&array['schemaVersion','id','revision','state','requestId'] and
  response->'schemaVersion'='1'::jsonb and jsonb_typeof(response->'id')='string' and
  length(response->>'id') between 1 and 100 and jsonb_typeof(response->'revision')='number' and
  response->>'revision'~'^[1-9][0-9]{0,9}$' and (response->>'revision')::numeric<=2147483647 and
  jsonb_typeof(response->'state')='string' and response->>'state' in (
    'draft','staged','validated','approved','published','superseded','rejected','accepted','retired',
    'receiving','sealed','invalid','finalized','abandoned') and
  jsonb_typeof(response->'requestId')='string' and response->>'requestId'~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and
  (not(response?'count') or (jsonb_typeof(response->'count')='number' and response->>'count'~'^[0-9]{1,9}$')) and
  (not(response?'digest') or (jsonb_typeof(response->'digest')='string' and response->>'digest'~'^[0-9a-f]{64}$')) and
  (not(response?'reportDigest') or (jsonb_typeof(response->'reportDigest')='string' and response->>'reportDigest'~'^[0-9a-f]{64}$')) and
  (not(response?'reportId') or (jsonb_typeof(response->'reportId')='string' and response->>'reportId'~'^[0-9a-f-]{36}$')) and
  (not(response?'packageDigest') or (jsonb_typeof(response->'packageDigest')='string' and response->>'packageDigest'~'^[0-9a-f]{64}$')) and
  (not(response?'importId') or (jsonb_typeof(response->'importId')='string' and response->>'importId'~'^[0-9a-f-]{36}$')) and
  (not(response?'releaseId') or (jsonb_typeof(response->'releaseId')='string' and response->>'releaseId'~'^[0-9a-f-]{36}$')) and
  (not(response?'rootRequestId') or (jsonb_typeof(response->'rootRequestId')='string' and response->>'rootRequestId'~'^[0-9a-f-]{36}$')) and
  (not(response?'operationId') or (jsonb_typeof(response->'operationId')='string' and response->>'operationId'~'^[0-9a-f-]{36}$')) and
  (not(response?'previousReleaseId') or response->'previousReleaseId'='null'::jsonb or
    (jsonb_typeof(response->'previousReleaseId')='string' and response->>'previousReleaseId'~'^[0-9a-f-]{36}$')) and
  (not(response?'scopeRevision') or (jsonb_typeof(response->'scopeRevision')='number' and response->>'scopeRevision'~'^[1-9][0-9]{0,9}$')) and
  (not(response?'baseRevision') or (jsonb_typeof(response->'baseRevision')='number' and response->>'baseRevision'~'^[1-9][0-9]{0,9}$')) and
  (not(response?'targetRevision') or (jsonb_typeof(response->'targetRevision')='number' and response->>'targetRevision'~'^[1-9][0-9]{0,9}$')) and
  (not(response?'currentReleaseRevision') or (jsonb_typeof(response->'currentReleaseRevision')='number' and response->>'currentReleaseRevision'~'^[1-9][0-9]{0,9}$')) and
  (not(response?'fileCount') or (jsonb_typeof(response->'fileCount')='number' and response->>'fileCount'~'^[0-9]{1,9}$')) and
  (not(response?'receivedChunkCount') or (jsonb_typeof(response->'receivedChunkCount')='number' and response->>'receivedChunkCount'~'^[0-9]{1,9}$')) and
  (not(response?'receivedBytes') or (jsonb_typeof(response->'receivedBytes')='number' and response->>'receivedBytes'~'^[0-9]{1,9}$')) and
  (not(response?'missingChunkCount') or (jsonb_typeof(response->'missingChunkCount')='number' and response->>'missingChunkCount'~'^[0-9]{1,9}$'))
));

create function gis_private.release_live_dependency_digest(p_release_id uuid) returns text
language sql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'scope',jsonb_build_array(r.site_id,r.pilot_area_id,a.site_id,a.area_code),
    'lots',coalesce((select jsonb_agg(jsonb_build_array(l.lot_id,l.area_id,l.lot_code,l.deleted_at is not null) order by l.lot_id)
      from public.lot l where l.area_id=r.pilot_area_id),'[]'::jsonb),
    'plots',coalesce((select jsonb_agg(jsonb_build_array(pg.lot_id,pg.area_id,pg.source_feature_id,pg.review_state) order by pg.lot_id,pg.source_feature_id)
      from public.plot_geometry pg where pg.mapping_release_id=r.release_id),'[]'::jsonb),
    'access',coalesce((select jsonb_agg(jsonb_build_array(ap.lot_id,ap.area_id,ap.node_id,ap.source_feature_id,ap.review_state) order by ap.lot_id,ap.source_feature_id)
      from public.grave_access_point ap where ap.mapping_release_id=r.release_id),'[]'::jsonb)
  )::text,'UTF8')),'hex')
  from public.mapping_release r join public.area a on a.area_id=r.pilot_area_id
  where r.release_id=p_release_id
$$;

create function gis_private.assert_release_live(
  p_release_id uuid,p_acknowledgements jsonb default null,p_require_acknowledgements boolean default false
) returns jsonb language plpgsql stable security invoker
set search_path=pg_catalog,extensions,pg_temp as $$
declare r public.mapping_release; i public.mapping_import; report public.mapping_import_report;
  release_validation jsonb; live_digest text; ack_digest text; expected_warnings jsonb; supplied_warnings jsonb;
begin
  perform gis_private.assert_admin();
  perform gis_private.assert_pilot_scope(p_release_id);
  select * into r from public.mapping_release where release_id=p_release_id;
  if not found or r.status not in ('validated','approved','published','superseded') then
    raise exception 'Release is not eligible for approval or activation'; end if;
  select * into i from public.mapping_import where release_id=p_release_id and state='finalized'
    order by created_at desc,import_id desc limit 1;
  if not found or i.current_report_id is null or i.package_digest is distinct from r.package_hash then
    raise exception 'A finalized package matching the frozen release is required'; end if;
  select * into report from public.mapping_import_report where report_id=i.current_report_id and import_id=i.import_id;
  if not found or report.report_hash is distinct from r.validation_report_hash or report.package_digest is distinct from r.package_hash or
     report.failure_classification is not null or coalesce((report.summary->>'errorCount')::integer,0)<>0 or
     r.validation_summary->>'reportDigest' is distinct from report.report_hash then
    raise exception 'Current validation report digest or package hash is stale'; end if;
  if r.selected_run_id is null or not exists(select 1 from public.georeferencing_run gr
    where gr.run_id=r.selected_run_id and gr.release_id=r.release_id and gr.site_id=r.site_id and gr.review_state='accepted') then
    raise exception 'An accepted frozen selected georeferencing run is required'; end if;
  live_digest:=gis_private.release_live_dependency_digest(p_release_id);
  if live_digest is null then raise exception 'Current live release dependencies are unavailable'; end if;

  -- Activation is bound to the exact live lot/geometry/access snapshot reviewed at
  -- approval. Check that binding before the broader topology calculation so an
  -- intervening lot reassignment/removal is reported as stale approval evidence.
  if not p_require_acknowledgements and
     (r.validation_summary->>'acknowledgementDigest' !~ '^[0-9a-f]{64}$' or
      r.validation_summary->>'liveDependencyDigest' is distinct from live_digest) then
    raise exception 'Approved acknowledgement or live dependency digest is stale';
  end if;
  release_validation:=gis_private.validate_release(p_release_id);
  if coalesce((release_validation->'geometry'->>'errorCount')::integer,0)<>0 or
     coalesce((release_validation->'graph'->>'errorCount')::integer,0)<>0 then
    raise exception 'Current release geometry or graph validation failed'; end if;

  if p_require_acknowledgements then
    if p_acknowledgements is null or jsonb_typeof(p_acknowledgements)<>'object' or
       p_acknowledgements-array['packageDigest','reportDigest','warnings','suitabilityReviewed','omissionsReviewed','privacyReviewed']<>'{}'::jsonb or
       p_acknowledgements->>'packageDigest' is distinct from r.package_hash or
       p_acknowledgements->>'reportDigest' is distinct from report.report_hash or
       p_acknowledgements->'suitabilityReviewed'<>'true'::jsonb or
       p_acknowledgements->'omissionsReviewed'<>'true'::jsonb or
       p_acknowledgements->'privacyReviewed'<>'true'::jsonb or
       jsonb_typeof(p_acknowledgements->'warnings')<>'array' or
       octet_length(p_acknowledgements::text)>65536 then
      raise exception 'Stale or invalid approval acknowledgement'; end if;
    select coalesce(jsonb_agg(token order by token),'[]'::jsonb) into expected_warnings from (
      select distinct item.value->>'code'||':'||coalesce(item.value->>'sourceFeatureId',item.value->>'lotId','*') token
      from jsonb_array_elements(report.entries) item(value) where item.value->>'severity'='WARNING') warnings;
    if exists(select 1 from jsonb_array_elements(p_acknowledgements->'warnings') item(value) where jsonb_typeof(item.value)<>'string') then
      raise exception 'Warning acknowledgement tokens must be strings'; end if;
    select coalesce(jsonb_agg(token order by token),'[]'::jsonb) into supplied_warnings from (
      select distinct value token from jsonb_array_elements_text(p_acknowledgements->'warnings')) warnings;
    if supplied_warnings is distinct from expected_warnings or
       jsonb_array_length(supplied_warnings)<>jsonb_array_length(p_acknowledgements->'warnings') then
      raise exception 'Every current warning requires one exact acknowledgement'; end if;
    ack_digest:=encode(sha256(convert_to(p_acknowledgements::text,'UTF8')),'hex');
  else
    ack_digest:=r.validation_summary->>'acknowledgementDigest';
  end if;
  return jsonb_build_object('importId',i.import_id::text,'reportDigest',report.report_hash,
    'packageDigest',r.package_hash,'liveDependencyDigest',live_digest,'acknowledgementDigest',ack_digest,
    'warningCount',coalesce((report.summary->>'warningCount')::integer,0));
end $$;

create function gis_private.activate_release(
  p_release_id uuid,p_expected_revision integer,p_expected_scope_revision integer,p_mode text
) returns jsonb language plpgsql security invoker
set search_path=pg_catalog,extensions,pg_temp as $$
declare actor uuid:=auth.uid(); initial public.mapping_release; target public.mapping_release; current_release public.mapping_release;
  current_release_id uuid; receipt gis_private.gis_mutation_request; receipt_count integer; scope_revision integer;
  operation text; event_uuid uuid; result jsonb;
begin
  perform gis_private.assert_admin();
  if p_release_id is null or p_expected_revision is null or p_expected_revision<1 or
     p_expected_scope_revision is null or p_expected_scope_revision<0 or p_mode not in ('publish','rollback') then
    raise exception 'Invalid activation request'; end if;
  select * into initial from public.mapping_release where release_id=p_release_id;
  if not found then raise exception 'Release not found'; end if;
  if initial.scope_kind<>'pilot' or initial.pilot_area_id is null then raise exception 'The v1 pipeline requires a pilot scope'; end if;
  perform 1 from public.area where area_id=initial.pilot_area_id and site_id=initial.site_id for no key update;
  if not found then raise exception 'Pilot area/site mismatch'; end if;
  perform gis_private.assert_pilot_scope(p_release_id);
  select mp.release_id into current_release_id from public.mapping_publication mp
    where mp.site_id=initial.site_id and mp.area_id=initial.pilot_area_id;
  perform 1 from public.mapping_release r where r.release_id=p_release_id or r.release_id=current_release_id
    order by r.release_id for update;
  select * into target from public.mapping_release where release_id=p_release_id;
  select * into current_release from public.mapping_release where release_id=current_release_id;
  perform 1 from public.lot where area_id=target.pilot_area_id order by lot_id for share;
  select count(*),min(q.operation) into receipt_count,operation from gis_private.gis_mutation_request q
    where q.actor_account_id=actor and q.response is null and q.created_at=transaction_timestamp();
  if receipt_count<>1 or operation<>(case p_mode when 'publish' then 'staff_publish_mapping_release' else 'staff_rollback_mapping_release' end) then
    raise exception 'Protected publication operation required' using errcode='42501'; end if;
  select * into receipt from gis_private.gis_mutation_request q where q.actor_account_id=actor and q.response is null
    and q.created_at=transaction_timestamp() for update;
  select count(*)::integer into scope_revision from public.mapping_publication_event
    where site_id=target.site_id and area_id=target.pilot_area_id;
  if target.revision<>p_expected_revision then raise exception 'Stale release revision' using errcode='40001'; end if;
  if scope_revision<>p_expected_scope_revision then raise exception 'Stale publication scope revision' using errcode='40001'; end if;
  if p_mode='publish' and target.status<>'approved' then raise exception 'Only an approved release can be published'; end if;
  if p_mode='rollback' and (target.status<>'superseded' or target.published_at is null or not exists(
    select 1 from public.mapping_publication_event where new_release_id=target.release_id)) then
    raise exception 'Rollback requires an eligible previously published superseded release'; end if;
  if current_release_id is not null and (current_release.status<>'published' or current_release.site_id<>target.site_id or
     current_release.pilot_area_id<>target.pilot_area_id or current_release_id=target.release_id) then
    raise exception 'Current publication selector is inconsistent'; end if;
  perform gis_private.assert_release_live(p_release_id,null,false);

  if current_release_id is not null then
    update public.mapping_release set status='superseded',revision=revision+1 where release_id=current_release_id;
  end if;
  update public.mapping_release set status='published',revision=revision+1,published_at=transaction_timestamp(),published_by=actor
    where release_id=target.release_id;
  insert into public.mapping_publication(site_id,area_id,release_id,published_at,published_by)
    values(target.site_id,target.pilot_area_id,target.release_id,transaction_timestamp(),actor)
    on conflict(site_id,area_id) do update set release_id=excluded.release_id,published_at=excluded.published_at,published_by=excluded.published_by;
  insert into public.mapping_publication_event(site_id,area_id,previous_release_id,new_release_id,request_id,kind,actor_account_id)
    values(target.site_id,target.pilot_area_id,current_release_id,target.release_id,receipt.request_id,p_mode,actor)
    returning event_id into event_uuid;
  result:=jsonb_build_object('schemaVersion',1,'id',target.release_id::text,'releaseId',target.release_id::text,
    'revision',target.revision+1,'state','published','requestId',receipt.request_id::text,
    'scopeRevision',scope_revision+1,'previousReleaseId',case when current_release_id is null then null else to_jsonb(current_release_id::text) end,
    'digest',target.validation_report_hash);
  perform gis_private.audit_event('mapping_release',target.release_id::text,'status_change',
    jsonb_build_object('schemaVersion',1,'id',target.release_id::text,'revision',target.revision,'state',target.status),result);
  perform gis_private.audit_event('mapping_publication_event',event_uuid::text,'insert',null,
    jsonb_build_object('schemaVersion',1,'id',event_uuid::text,'revision',scope_revision+1,'state',p_mode,
      'requestId',receipt.request_id::text,'siteId',target.site_id,'areaId',target.pilot_area_id));
  return result;
end $$;

create function public.staff_review_mapping_release(
  p_release_id uuid,p_expected_revision integer,p_decision text,p_acknowledgements jsonb,p_notes text,p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,extensions,pg_temp as $$
declare initial public.mapping_release; r public.mapping_release; prior jsonb; canonical jsonb; evidence jsonb; result jsonb;
begin
  perform gis_private.assert_admin();
  if p_release_id is null or p_expected_revision is null or p_expected_revision<1 or
     p_decision not in ('approve','reject') or p_acknowledgements is null or jsonb_typeof(p_acknowledgements)<>'object' or
     octet_length(p_acknowledgements::text)>65536 or p_request_id is null or
     (p_notes is not null and (length(p_notes)>2000 or btrim(p_notes)='')) then raise exception 'Invalid bounded review request'; end if;
  canonical:=jsonb_build_object('releaseId',p_release_id::text,'expectedRevision',p_expected_revision,
    'decision',p_decision,'acknowledgements',p_acknowledgements,'notes',p_notes,'requestId',p_request_id::text);
  prior:=gis_private.claim_request(p_request_id,'staff_review_mapping_release',canonical);
  if prior is not null then return prior; end if;
  select * into initial from public.mapping_release where release_id=p_release_id;
  if not found then raise exception 'Release not found'; end if;
  if initial.scope_kind<>'pilot' or initial.pilot_area_id is null then raise exception 'The v1 pipeline requires a pilot scope'; end if;
  perform 1 from public.area where area_id=initial.pilot_area_id and site_id=initial.site_id for no key update;
  perform gis_private.assert_pilot_scope(p_release_id);
  select * into r from public.mapping_release where release_id=p_release_id for update;
  if r.revision<>p_expected_revision then raise exception 'Stale release revision' using errcode='40001'; end if;
  if p_decision='approve' then
    if r.status<>'validated' then raise exception 'Only a validated release can be approved'; end if;
    evidence:=gis_private.assert_release_live(p_release_id,p_acknowledgements,true);
    update public.mapping_release set status='approved',revision=revision+1,reviewed_at=transaction_timestamp(),reviewed_by=auth.uid(),
      notes=coalesce(p_notes,notes),validation_summary=validation_summary||jsonb_build_object(
        'acknowledgementDigest',evidence->>'acknowledgementDigest','liveDependencyDigest',evidence->>'liveDependencyDigest')
      where release_id=p_release_id;
    result:=jsonb_build_object('schemaVersion',1,'id',p_release_id::text,'releaseId',p_release_id::text,
      'revision',r.revision+1,'state','approved','requestId',p_request_id::text,'digest',r.validation_report_hash);
    perform gis_private.audit_event('mapping_release',p_release_id::text,'approve',
      jsonb_build_object('schemaVersion',1,'id',p_release_id::text,'revision',r.revision,'state',r.status),result);
  else
    if r.status not in ('draft','staged','validated','approved') or p_notes is null then
      raise exception 'Review rejection requires an eligible release and bounded reason'; end if;
    update public.mapping_release set status='rejected',revision=revision+1,rejection_reason=p_notes,
      reviewed_at=transaction_timestamp(),reviewed_by=auth.uid() where release_id=p_release_id;
    result:=jsonb_build_object('schemaVersion',1,'id',p_release_id::text,'releaseId',p_release_id::text,
      'revision',r.revision+1,'state','rejected','requestId',p_request_id::text,'digest',coalesce(r.validation_report_hash,r.package_hash));
    perform gis_private.audit_event('mapping_release',p_release_id::text,'status_change',
      jsonb_build_object('schemaVersion',1,'id',p_release_id::text,'revision',r.revision,'state',r.status),result);
  end if;
  perform gis_private.finish_request(p_request_id,result);
  return result;
end $$;

create function public.staff_publish_mapping_release(
  p_release_id uuid,p_expected_revision integer,p_expected_scope_revision integer,p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,extensions,pg_temp as $$
declare prior jsonb; canonical jsonb; result jsonb;
begin
  perform gis_private.assert_admin();
  if p_release_id is null or p_expected_revision is null or p_expected_revision<1 or
     p_expected_scope_revision is null or p_expected_scope_revision<0 or p_request_id is null then
    raise exception 'Invalid publish request'; end if;
  canonical:=jsonb_build_object('releaseId',p_release_id::text,'expectedRevision',p_expected_revision,
    'expectedScopeRevision',p_expected_scope_revision,'requestId',p_request_id::text);
  prior:=gis_private.claim_request(p_request_id,'staff_publish_mapping_release',canonical);
  if prior is not null then return prior; end if;
  result:=gis_private.activate_release(p_release_id,p_expected_revision,p_expected_scope_revision,'publish');
  perform gis_private.finish_request(p_request_id,result);
  return result;
end $$;

create function public.staff_rollback_mapping_release(
  p_release_id uuid,p_expected_revision integer,p_expected_scope_revision integer,p_reason text,p_request_id uuid
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,extensions,pg_temp as $$
declare prior jsonb; canonical jsonb; result jsonb;
begin
  perform gis_private.assert_admin();
  if p_release_id is null or p_expected_revision is null or p_expected_revision<1 or
     p_expected_scope_revision is null or p_expected_scope_revision<0 or p_request_id is null or
     p_reason is null or btrim(p_reason)='' or length(p_reason)>2000 then raise exception 'Invalid bounded rollback request'; end if;
  canonical:=jsonb_build_object('releaseId',p_release_id::text,'expectedRevision',p_expected_revision,
    'expectedScopeRevision',p_expected_scope_revision,'reason',p_reason,'requestId',p_request_id::text);
  prior:=gis_private.claim_request(p_request_id,'staff_rollback_mapping_release',canonical);
  if prior is not null then return prior; end if;
  result:=gis_private.activate_release(p_release_id,p_expected_revision,p_expected_scope_revision,'rollback');
  perform gis_private.finish_request(p_request_id,result);
  return result;
end $$;

revoke all on function gis_private.release_live_dependency_digest(uuid),
  gis_private.assert_release_live(uuid,jsonb,boolean),gis_private.activate_release(uuid,integer,integer,text)
  from public,anon,authenticated,service_role;
revoke all on function public.staff_review_mapping_release(uuid,integer,text,jsonb,text,uuid),
  public.staff_publish_mapping_release(uuid,integer,integer,uuid),
  public.staff_rollback_mapping_release(uuid,integer,integer,text,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.staff_review_mapping_release(uuid,integer,text,jsonb,text,uuid),
  public.staff_publish_mapping_release(uuid,integer,integer,uuid),
  public.staff_rollback_mapping_release(uuid,integer,integer,text,uuid) to authenticated;

comment on function public.staff_review_mapping_release(uuid,integer,text,jsonb,text,uuid) is
  'Explicit active-ADMIN review of one validated pilot release; approval binds exact package/report acknowledgements.';
comment on function public.staff_publish_mapping_release(uuid,integer,integer,uuid) is
  'Explicit active-ADMIN atomic publication of one approved pilot release.';
comment on function public.staff_rollback_mapping_release(uuid,integer,integer,text,uuid) is
  'Explicit active-ADMIN rollback to one eligible previously published frozen pilot release.';

commit;
