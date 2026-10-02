import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";

const MIGRATION = "20260928220000_gis_import_validation.sql";
const MIGRATIONS = new URL("../supabase/migrations/", import.meta.url);
const IMAGE = "postgis/postgis:17-3.5";
const DATABASE = "gravenav_test";
const ADMIN = "10000000-0000-0000-0000-000000000001";
const RELEASE = "20000000-0000-0000-0000-000000000001";
const IMPORT = "30000000-0000-0000-0000-000000000001";
const ROOT_REQUEST = "40000000-0000-0000-0000-000000000001";
const REPORT = "50000000-0000-0000-0000-000000000001";
const DIGEST = "a".repeat(64);
const LIVE_DIGEST = "b".repeat(64);
const M09 = "20260929000000_gis_publication.sql";

function docker(args, options = {}) {
  return spawnSync("docker", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
}

function sql(container, statement) {
  const result = docker(["exec", "-i", container, "psql", "-U", "postgres", "-d", DATABASE, "-v", "ON_ERROR_STOP=1", "-X", "-Atq"], { input: statement });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function asyncSql(container, statement) {
  return new Promise((resolve) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", DATABASE, "-v", "ON_ERROR_STOP=1", "-X", "-Atq"]);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (data) => { stdout += data; });
    child.stderr.on("data", (data) => { stderr += data; });
    child.on("close", (status) => resolve({ status, stdout: stdout.trim(), stderr: stderr.trim() }));
    child.stdin.end(statement);
  });
}

test("M07 serializes two genuine PostgreSQL finalizer sessions and advances exactly once", { timeout: 180_000 }, async (t) => {
  const source = await readFile(new URL(`../supabase/migrations/${MIGRATION}`, import.meta.url), "utf8");
  const areaLock = source.indexOf("from public.area where area_id=initial.area_id and site_id=initial.site_id for no key update");
  const releaseLock = source.indexOf("from public.mapping_release where release_id=initial.release_id for update", areaLock);
  const importLock = source.indexOf("from public.mapping_import where import_id=p_import_id for update", releaseLock);
  assert.ok(areaLock >= 0 && releaseLock > areaLock && importLock > releaseLock, "scope-area -> release -> import lock order");

  const engine = docker(["version", "--format", "{{.Server.Version}}"]);
  assert.equal(engine.status, 0, `Docker engine is required for the genuine two-client race: ${engine.stderr || engine.stdout}`);
  const container = `gravenav-m07-race-${randomUUID().slice(0, 8)}`;
  t.after(() => docker(["rm", "-f", container]));
  const started = docker(["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=postgres", IMAGE]);
  assert.equal(started.status, 0, started.stderr || started.stdout);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const logs = docker(["logs", container]);
    const ready = docker(["exec", container, "pg_isready", "-U", "postgres"]);
    const initialized = `${logs.stdout}\n${logs.stderr}`.includes("PostgreSQL init process complete; ready for start up.");
    if (initialized && ready.status === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (attempt === 59) assert.fail(logs.stderr || ready.stderr || ready.stdout || "Disposable PostgreSQL did not finish initialization");
  }

  const created = docker(["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-c", `create database ${DATABASE} template template0`]);
  assert.equal(created.status, 0, created.stderr || created.stdout);

  sql(container, `
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  const files = (await readdir(MIGRATIONS)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files.slice(0, files.indexOf(MIGRATION) + 1)) sql(container, await readFile(new URL(file, MIGRATIONS), "utf8"));

  sql(container, `
    set session_replication_role=replica;
    insert into auth.users values('${ADMIN}');
    insert into public.account(account_id,role_id,username,is_active,account_status,approved_at)
      select '${ADMIN}',role_id,'fictional-race-admin',true,'ACTIVE',now() from public.role where role_name='ADMIN';
    insert into public.site(site_id,site_name,address) values(1,'Fictional race site','Synthetic address');
    insert into public.area(area_id,site_id,area_code,area_name,area_category) values(1,1,'RACE','Fictional race area','garden');
    insert into public.mapping_release(release_id,site_id,release_code,title,scope_kind,pilot_area_id,status,revision,
      package_reference,package_hash,source_plan_reference,source_plan_version,source_plan_hash,source_coordinate_space,
      field_srid,working_srid,published_srid,qgis_version,created_by,staged_at,staged_by)
      values('${RELEASE}',1,'race-release','Fictional race release','pilot',1,'staged',2,
        'gis-package:${DIGEST}','${DIGEST}','synthetic-plan.png','v1','${DIGEST}','image-pixels',
        4326,32651,4326,'3.40','${ADMIN}',now(),'${ADMIN}');
    insert into public.mapping_release_area values('${RELEASE}',1,1);
    insert into public.mapping_import(import_id,request_id,actor_account_id,release_id,site_id,area_id,base_revision,target_revision,
      package_digest,manifest_sha256,state,revision)
      values('${IMPORT}','${ROOT_REQUEST}','${ADMIN}','${RELEASE}',1,1,1,2,'${DIGEST}','${DIGEST}','validated',4);
    insert into public.mapping_import_report(report_id,import_id,release_revision,package_digest,validator_version,
      baseline_publication_revision,live_dependency_digest,summary,entries,report_hash,created_by)
      values('${REPORT}','${IMPORT}',2,'${DIGEST}','gis-pilot-v1',0,'${LIVE_DIGEST}',
        '{"errorCount":0,"warningCount":0,"infoCount":0}'::jsonb,'[]'::jsonb,'${DIGEST}','${ADMIN}');
    update public.mapping_import set current_report_id='${REPORT}' where import_id='${IMPORT}';
    set session_replication_role=origin;

    create or replace function gis_private.validate_import(p_import_id uuid) returns jsonb language sql stable security invoker
      set search_path=pg_catalog,extensions,pg_temp as $$select jsonb_build_object(
        'schemaVersion',1,'validatorVersion','gis-pilot-v1','baselineScopeRevision',0,
        'baselineDependencyDigest','${LIVE_DIGEST}','summary',jsonb_build_object('errorCount',0,'warningCount',0,'infoCount',0),
        'entries','[]'::jsonb,'reportDigest','${DIGEST}','failureClassification',null)$$;
    create or replace function gis_private.import_layer(p_import_id uuid,p_file_name text) returns jsonb language sql stable security invoker
      set search_path=pg_catalog,extensions,pg_temp as $$select case when p_file_name='manifest.json'
        then '{"selected_run_code":"RACE-RUN"}'::jsonb else '{}'::jsonb end$$;
    create or replace function gis_private.assert_import_acknowledgements(p_import_id uuid,p_report jsonb,p_acknowledgements jsonb) returns void
      language plpgsql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$begin return; end$$;
    create or replace function gis_private.materialize_import(p_import_id uuid,p_acknowledgements jsonb) returns void
      language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$begin perform pg_sleep(1); end$$;
    create or replace function gis_private.validate_release(p_release_id uuid) returns jsonb language sql stable security invoker
      set search_path=pg_catalog,extensions,pg_temp as $$select jsonb_build_object('schemaVersion',1,
        'geometry',jsonb_build_object('errorCount',0),'graph',jsonb_build_object('errorCount',0))$$;
  `);

  const opOne = randomUUID();
  const opTwo = randomUUID();
  const call = (operation) => `set role authenticated; select set_config('request.jwt.claim.sub','${ADMIN}',false);
    select public.staff_finalize_mapping_import('${IMPORT}'::uuid,2,'${DIGEST}','{"warnings":[],"reviewed_layer_hashes":{}}'::jsonb,
      '${ROOT_REQUEST}'::uuid,'${operation}'::uuid)::text;`;
  const [one, two] = await Promise.all([asyncSql(container, call(opOne)), asyncSql(container, call(opTwo))]);
  const winners = [one, two].filter((result) => result.status === 0);
  const losers = [one, two].filter((result) => result.status !== 0);
  assert.equal(winners.length, 1, JSON.stringify({ one, two }));
  assert.equal(losers.length, 1, JSON.stringify({ one, two }));
  assert.match(losers[0].stderr, /stale release|revision|validated import|staged release|cannot be finalized/i);
  assert.equal(JSON.parse(winners[0].stdout.split(/\r?\n/).at(-1)).state, "finalized");

  const verification = sql(container, `select jsonb_build_object(
    'release',(select jsonb_build_object('status',status,'revision',revision) from public.mapping_release where release_id='${RELEASE}'),
    'import',(select jsonb_build_object('state',state,'revision',revision) from public.mapping_import where import_id='${IMPORT}'),
    'successReceipts',(select count(*) from gis_private.gis_mutation_request where operation='staff_finalize_mapping_import' and response->>'state'='finalized'),
    'pendingReceipts',(select count(*) from gis_private.gis_mutation_request where operation='staff_finalize_mapping_import' and response is null),
    'publications',(select count(*) from public.mapping_publication))::text;`);
  assert.deepEqual(JSON.parse(verification.split(/\r?\n/).at(-1)), {
    release: { status: "validated", revision: 3 },
    import: { state: "finalized", revision: 5 },
    successReceipts: 1,
    pendingReceipts: 0,
    publications: 0,
  });
});

test("M09 serializes publication and import lifecycle races without partial state", { timeout: 240_000 }, async (t) => {
  const engine = docker(["version", "--format", "{{.Server.Version}}"]).stdout.trim();
  assert.ok(engine, "Docker engine is required for genuine publication races");
  const container = `gravenav-m09-race-${randomUUID().slice(0, 8)}`;
  t.after(() => docker(["rm", "-f", container]));
  const started = docker(["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=postgres", IMAGE]);
  assert.equal(started.status, 0, started.stderr || started.stdout);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const logs = docker(["logs", container]);
    const ready = docker(["exec", container, "pg_isready", "-U", "postgres"]);
    if (`${logs.stdout}\n${logs.stderr}`.includes("PostgreSQL init process complete; ready for start up.") && ready.status === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (attempt === 59) assert.fail(logs.stderr || ready.stderr || ready.stdout || "Disposable PostgreSQL did not initialize");
  }
  assert.equal(docker(["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-c", `create database ${DATABASE} template template0`]).status, 0);
  sql(container, `
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  const files = (await readdir(MIGRATIONS)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files.slice(0, files.indexOf(M09) + 1)) sql(container, await readFile(new URL(file, MIGRATIONS), "utf8"));

  const releases = [1, 2, 3, 4, 5].map((n) => `20000000-0000-0000-0000-00000000000${n}`);
  const restageRelease = "20000000-0000-0000-0000-000000000006";
  const finalizeImport = "30000000-0000-0000-0000-000000000006";
  const finalizeRoot = "40000000-0000-0000-0000-000000000006";
  const restageRoot = "40000000-0000-0000-0000-000000000007";
  const finalizeReport = "50000000-0000-0000-0000-000000000006";
  sql(container, `
    set session_replication_role=replica;
    insert into auth.users values('${ADMIN}');
    insert into public.account(account_id,role_id,username,is_active,account_status,approved_at)
      select '${ADMIN}',role_id,'fictional-publication-race-admin',true,'ACTIVE',now() from public.role where role_name='ADMIN';
    insert into public.site(site_id,site_name,address) values
      (1,'Fictional publication site','Synthetic address'),(2,'Fictional import site','Synthetic address');
    insert into public.area(area_id,site_id,area_code,area_name,area_category) values
      (1,1,'PUB','Fictional publication area','garden'),(2,2,'RST','Fictional restage area','garden');
    insert into public.lot(lot_id,area_id,lot_code,status) values(9001,1,'PUB-9001','AVAILABLE');
    insert into public.mapping_release(release_id,site_id,release_code,title,scope_kind,pilot_area_id,status,revision,
      package_reference,package_hash,source_plan_reference,source_plan_version,source_plan_hash,source_coordinate_space,
      field_srid,working_srid,published_srid,qgis_version,created_by,validation_report_hash,validation_summary,reviewed_at,reviewed_by)
    select release_id,1,'publication-race-'||ordinality,'Fictional approved release','pilot',1,'approved',4,
      'gis-package:${DIGEST}','${DIGEST}','synthetic-plan.png','v1','${DIGEST}','image-pixels',4326,32651,4326,'3.40','${ADMIN}',
      '${DIGEST}',jsonb_build_object('schemaVersion',1,'featureCount',1,'errorCount',0,'warningCount',0,
        'reportDigest','${DIGEST}','acknowledgementDigest','${DIGEST}','liveDependencyDigest','${LIVE_DIGEST}'),now(),'${ADMIN}'
      from unnest(array['${releases.join("','")}']::uuid[]) with ordinality ids(release_id,ordinality);
    insert into public.mapping_release_area select release_id,1,1 from public.mapping_release where site_id=1;

    insert into public.mapping_release(release_id,site_id,release_code,title,scope_kind,pilot_area_id,status,revision,
      package_reference,package_hash,source_plan_reference,source_plan_version,source_plan_hash,source_coordinate_space,
      field_srid,working_srid,published_srid,qgis_version,created_by,staged_at,staged_by)
      values('${restageRelease}',2,'restage-race','Fictional restage release','pilot',2,'staged',2,
        'gis-package:${DIGEST}','${DIGEST}','synthetic-plan.png','v1','${DIGEST}','image-pixels',4326,32651,4326,'3.40','${ADMIN}',now(),'${ADMIN}');
    insert into public.mapping_release_area values('${restageRelease}',2,2);
    insert into public.mapping_import(import_id,request_id,actor_account_id,release_id,site_id,area_id,base_revision,target_revision,
      package_digest,manifest_sha256,state,revision)
      values('${finalizeImport}','${finalizeRoot}','${ADMIN}','${restageRelease}',2,2,1,2,'${DIGEST}','${DIGEST}','validated',4);
    insert into public.mapping_import_report(report_id,import_id,release_revision,package_digest,validator_version,
      baseline_publication_revision,live_dependency_digest,summary,entries,report_hash,created_by)
      values('${finalizeReport}','${finalizeImport}',2,'${DIGEST}','gis-pilot-v1',0,'${LIVE_DIGEST}',
        '{"errorCount":0,"warningCount":0,"infoCount":0}'::jsonb,'[]'::jsonb,'${DIGEST}','${ADMIN}');
    update public.mapping_import set current_report_id='${finalizeReport}' where import_id='${finalizeImport}';

    set session_replication_role=origin;

    create or replace function gis_private.assert_release_live(p_release_id uuid,p_acknowledgements jsonb default null,
      p_require_acknowledgements boolean default false) returns jsonb language plpgsql security invoker
      set search_path=pg_catalog,extensions,pg_temp as $$begin
        perform pg_sleep(0.4);
        if exists(select 1 from public.lot where area_id=1 and deleted_at is not null) then
          raise exception 'Current live lot dependency changed';
        end if;
        return jsonb_build_object('liveDependencyDigest','${LIVE_DIGEST}','acknowledgementDigest','${DIGEST}');
      end$$;
    create or replace function gis_private.validate_import(p_import_id uuid) returns jsonb language sql stable security invoker
      set search_path=pg_catalog,extensions,pg_temp as $$select jsonb_build_object('schemaVersion',1,'validatorVersion','gis-pilot-v1',
        'baselineScopeRevision',0,'baselineDependencyDigest','${LIVE_DIGEST}',
        'summary',jsonb_build_object('errorCount',0,'warningCount',0,'infoCount',0),'entries','[]'::jsonb,
        'reportDigest','${DIGEST}','failureClassification',null)$$;
    create or replace function gis_private.import_layer(p_import_id uuid,p_file_name text) returns jsonb language sql stable security invoker
      set search_path=pg_catalog,extensions,pg_temp as $$select '{"selected_run_code":"RACE-RUN"}'::jsonb$$;
    create or replace function gis_private.assert_import_acknowledgements(p_import_id uuid,p_report jsonb,p_acknowledgements jsonb) returns void
      language plpgsql stable security invoker set search_path=pg_catalog,extensions,pg_temp as $$begin return; end$$;
    create or replace function gis_private.materialize_import(p_import_id uuid,p_acknowledgements jsonb) returns void
      language plpgsql security invoker set search_path=pg_catalog,extensions,pg_temp as $$begin perform pg_sleep(0.8); end$$;
    create or replace function gis_private.validate_release(p_release_id uuid) returns jsonb language sql stable security invoker
      set search_path=pg_catalog,extensions,pg_temp as $$select jsonb_build_object('schemaVersion',1,
        'geometry',jsonb_build_object('errorCount',0),'graph',jsonb_build_object('errorCount',0))$$;
    create or replace function gis_private.assert_import_manifest(p_manifest jsonb,p_manifest_bytes bytea,p_package_digest text,
      p_site_id bigint,p_area_id bigint,p_release_code text) returns void language plpgsql stable security invoker
      set search_path=pg_catalog,extensions,pg_temp as $$begin return; end$$;
    create or replace function gis_private.package_digest(p_manifest_bytes bytea,p_files jsonb) returns text language sql stable security invoker
      set search_path=pg_catalog,extensions,pg_temp as $$select '${DIGEST}'::text$$;
  `);

  const publishCall = (release, scopeRevision, request = randomUUID()) => `set role authenticated;
    select set_config('request.jwt.claim.sub','${ADMIN}',false);
    select public.staff_publish_mapping_release('${release}'::uuid,4,${scopeRevision},'${request}'::uuid)::text;`;
  const first = await Promise.all([asyncSql(container, publishCall(releases[0], 0)), asyncSql(container, publishCall(releases[1], 0))]);
  assert.equal(first.filter((result) => result.status === 0).length, 1, JSON.stringify(first));
  assert.equal(first.filter((result) => result.status !== 0).length, 1, JSON.stringify(first));
  assert.match(first.find((result) => result.status !== 0).stderr, /stale publication scope revision/i);
  const firstWinner = JSON.parse(first.find((result) => result.status === 0).stdout.split(/\r?\n/).at(-1)).releaseId;
  assert.deepEqual(JSON.parse(sql(container, `select jsonb_build_object('selector',(select release_id from public.mapping_publication where site_id=1 and area_id=1),
    'events',(select count(*) from public.mapping_publication_event where site_id=1 and area_id=1),
    'published',(select count(*) from public.mapping_release where release_id=any(array['${releases[0]}','${releases[1]}']::uuid[]) and status='published'),
    'approved',(select count(*) from public.mapping_release where release_id=any(array['${releases[0]}','${releases[1]}']::uuid[]) and status='approved'))::text;`).split(/\r?\n/).at(-1)),
    { selector: firstWinner, events: 1, published: 1, approved: 1 });

  const replacement = await Promise.all([asyncSql(container, publishCall(releases[2], 1)), asyncSql(container, publishCall(releases[3], 1))]);
  assert.equal(replacement.filter((result) => result.status === 0).length, 1, JSON.stringify(replacement));
  assert.equal(replacement.filter((result) => result.status !== 0).length, 1, JSON.stringify(replacement));
  assert.match(replacement.find((result) => result.status !== 0).stderr, /stale publication scope revision/i);
  const replacementWinner = JSON.parse(replacement.find((result) => result.status === 0).stdout.split(/\r?\n/).at(-1)).releaseId;
  const replacementState = JSON.parse(sql(container, `select jsonb_build_object(
    'selector',(select release_id from public.mapping_publication where site_id=1 and area_id=1),
    'events',(select count(*) from public.mapping_publication_event where site_id=1 and area_id=1),
    'prior',(select status from public.mapping_release where release_id='${firstWinner}'),
    'winner',(select status from public.mapping_release where release_id='${replacementWinner}'))::text;`).split(/\r?\n/).at(-1));
  assert.deepEqual(replacementState, { selector: replacementWinner, events: 2, prior: "superseded", winner: "published" });

  const edit = asyncSql(container, `begin; update public.lot set deleted_at=now() where lot_id=9001; select pg_sleep(0.8); commit;`);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const publishDuringEdit = asyncSql(container, publishCall(releases[4], 2));
  const [editResult, blockedPublish] = await Promise.all([edit, publishDuringEdit]);
  assert.equal(editResult.status, 0, editResult.stderr);
  assert.notEqual(blockedPublish.status, 0, blockedPublish.stdout);
  assert.match(blockedPublish.stderr, /live lot dependency changed/i);
  assert.deepEqual(JSON.parse(sql(container, `select jsonb_build_object(
    'selector',(select release_id from public.mapping_publication where site_id=1 and area_id=1),
    'events',(select count(*) from public.mapping_publication_event where site_id=1 and area_id=1),
    'target',(select status from public.mapping_release where release_id='${releases[4]}'))::text;`).split(/\r?\n/).at(-1)),
    { selector: replacementWinner, events: 2, target: "approved" });

  const finalizeOperation = randomUUID();
  const finalize = `set role authenticated; select set_config('request.jwt.claim.sub','${ADMIN}',false);
    select public.staff_finalize_mapping_import('${finalizeImport}'::uuid,2,'${DIGEST}',
      '{"warnings":[],"reviewed_layer_hashes":{}}'::jsonb,'${finalizeRoot}'::uuid,'${finalizeOperation}'::uuid)::text;`;
  const restageManifest = Buffer.from('{"files":[]}', "utf8").toString("base64");
  const restage = `set role authenticated; select set_config('request.jwt.claim.sub','${ADMIN}',false);
    select public.staff_begin_mapping_import('${restageRelease}'::uuid,2,'${restageRoot}'::uuid,'${DIGEST}','${restageManifest}')::text;`;
  const lifecycle = await Promise.all([asyncSql(container, finalize), asyncSql(container, restage)]);
  assert.equal(lifecycle.filter((result) => result.status === 0).length, 1, JSON.stringify(lifecycle));
  assert.equal(lifecycle.filter((result) => result.status !== 0).length, 1, JSON.stringify(lifecycle));
  assert.match(lifecycle.find((result) => result.status !== 0).stderr, /stale release|revision|active_release|duplicate key/i);
  const lifecycleState = JSON.parse(sql(container, `select jsonb_build_object(
    'release',(select jsonb_build_object('status',status,'revision',revision) from public.mapping_release where release_id='${restageRelease}'),
    'finalizeImport',(select state from public.mapping_import where import_id='${finalizeImport}'),
    'restageImports',(select count(*) from public.mapping_import where release_id='${restageRelease}' and import_id<>'${finalizeImport}'),
    'successReceipts',(select count(*) from gis_private.gis_mutation_request where request_id in ('${finalizeOperation}','${restageRoot}') and response is not null),
    'pendingReceipts',(select count(*) from gis_private.gis_mutation_request where request_id in ('${finalizeOperation}','${restageRoot}') and response is null))::text;`).split(/\r?\n/).at(-1));
  assert.equal(lifecycleState.successReceipts, 1);
  assert.equal(lifecycleState.pendingReceipts, 0);
  assert.deepEqual(lifecycleState.release, { status: "validated", revision: 3 });
  assert.equal(lifecycleState.finalizeImport, "finalized");
  assert.equal(lifecycleState.restageImports, 0);

  const finalSafety = JSON.parse(sql(container, `select jsonb_build_object(
    'publicationRows',(select count(*) from public.mapping_publication where site_id=1 and area_id=1),
    'events',(select count(*) from public.mapping_publication_event where site_id=1 and area_id=1),
    'legacyNodes',(select count(*) from public.map_node where mapping_release_id is null),
    'pendingReceipts',(select count(*) from gis_private.gis_mutation_request where response is null))::text;`).split(/\r?\n/).at(-1));
  assert.deepEqual(finalSafety, { publicationRows: 1, events: 2, legacyNodes: 0, pendingReceipts: 0 });
});
