import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import { createTestDatabase } from "./database-helper.mjs";
import {
  createRelease,
  gisActors,
  gisLogin,
  releaseValues,
  seedGisFixtures,
  withOwnerTransaction,
} from "./gis-fixtures.mjs";
import {
  DATA_FILE_NAMES,
  PACKAGE_LIMITS,
  computePackageDigest,
} from "../scripts/gis/package-contract.mjs";
import { parseStrictJson } from "../scripts/gis/strict-json.mjs";
import { GIS_STRICT_JSON_CORPUS } from "./fixtures/gis-strict-json-corpus.mjs";

const M06 = "20260928210000_gis_import_transport.sql";
const HASH_PATTERN = /^[0-9a-f]{64}$/;

function stableJson(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function featureCollection(features = []) {
  return { type: "FeatureCollection", features };
}

function packageFixture(releaseCode, overrides = {}) {
  const observations = Array.from({ length: 720 }, (_, index) => ({
    capture_code: "CAP-01",
    observation_order: index + 1,
    latitude: 13.01,
    longitude: 123.01,
    reported_accuracy_m: 1,
    captured_at: new Date(Date.parse("2026-09-28T00:00:00.000Z") + index * 1000).toISOString(),
  }));
  const data = {
    "cemetery_boundary.geojson": featureCollection([{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[123, 13], [123.02, 13], [123.02, 13.02], [123, 13.02], [123, 13]]] }, properties: {} }]),
    "garden_sections.geojson": featureCollection([{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[123.001, 13.001], [123.019, 13.001], [123.019, 13.019], [123.001, 13.019], [123.001, 13.001]]] }, properties: {} }]),
    "roads_walkways.geojson": featureCollection([{ type: "Feature", geometry: { type: "LineString", coordinates: [[123.002, 13.002], [123.018, 13.018]] }, properties: {} }]),
    "grave_plots.geojson": featureCollection([{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[123.01, 13.01], [123.011, 13.01], [123.011, 13.011], [123.01, 13.011], [123.01, 13.01]]] }, properties: {} }]),
    "grave_access_points.geojson": featureCollection([{ type: "Feature", geometry: { type: "Point", coordinates: [123.0105, 13.0105] }, properties: {} }]),
    "route_nodes.geojson": featureCollection([{ type: "Feature", geometry: { type: "Point", coordinates: [123.002, 13.002] }, properties: {} }]),
    "route_edges.geojson": featureCollection([{ type: "Feature", geometry: { type: "LineString", coordinates: [[123.002, 13.002], [123.0105, 13.0105]] }, properties: {} }]),
    "landmarks.geojson": featureCollection([]),
    "survey_points.json": [{ point_code: "GCP-01", site_id: "1", role: "GCP" }],
    "survey_captures.json": [{ capture_code: "CAP-01", point_code: "GCP-01", site_id: "1", started_at: "2026-09-28T00:00:00.000Z" }],
    "survey_observations.json": observations,
    "georeferencing_runs.json": [{ run_code: "RUN-01", release_code: releaseCode }],
    "georeferencing_run_points.json": [{ run_code: "RUN-01", point_code: "GCP-01", capture_code: "CAP-01", role: "FITTING", source_x: 10, source_y: 10 }],
    "georeferencing_validation.json": [],
  };
  Object.assign(data, overrides.data || {});
  const dataBytes = Object.fromEntries(Object.entries(data).map(([name, value]) => [name, stableJson(value)]));
  const manifest = {
    schema_version: 1,
    package_id: `transport-${randomUUID()}`,
    site_id: "1",
    pilot_area_id: "1",
    release_code: releaseCode,
    title: "Synthetic transport fixture",
    description: "Fictional Task 9 fixture",
    source_plan: {
      reference: "synthetic-plan.png",
      version: "v1",
      sha256: "b".repeat(64),
      coordinate_space: "image-pixels",
    },
    crs: { field: 4326, working: 32651, export: 4326 },
    exported_at: "2026-09-28T02:00:00.000Z",
    qgis_version: "3.40",
    selected_run_code: "RUN-01",
    pilot_lot_ids: ["1"],
    provenance_notes: "Synthetic data only",
    limitations: ["Transport validation only"],
    files: DATA_FILE_NAMES.map((name) => ({
      name,
      sha256: sha256(dataBytes[name]),
      bytes: dataBytes[name].byteLength,
      feature_count: data[name].features?.length ?? data[name].length,
      layer_version: "v1",
    })),
    ...(overrides.manifest || {}),
  };
  const manifestBytes = stableJson(manifest);
  return {
    data,
    dataBytes,
    manifest,
    manifestBytes,
    digest: computePackageDigest(manifestBytes, manifest.files),
  };
}

function refreshFixtureManifest(fixture) {
  fixture.manifestBytes = stableJson(fixture.manifest);
  fixture.digest = computePackageDigest(fixture.manifestBytes, fixture.manifest.files);
  return fixture;
}

function replaceFixtureFile(fixture, name, value) {
  fixture.data[name] = value;
  fixture.dataBytes[name] = stableJson(value);
  const declaration = fixture.manifest.files.find((file) => file.name === name);
  declaration.sha256 = sha256(fixture.dataBytes[name]);
  declaration.bytes = fixture.dataBytes[name].byteLength;
  declaration.feature_count = value.features?.length ?? value.length;
  return refreshFixtureManifest(fixture);
}

function chunks(bytes) {
  const result = [];
  for (let offset = 0; offset < bytes.length; offset += PACKAGE_LIMITS.maxManifestBytes) {
    result.push(bytes.subarray(offset, Math.min(bytes.length, offset + PACKAGE_LIMITS.maxManifestBytes)));
  }
  return result;
}

async function beginImport(db, releaseId, revision, fixture, requestId = randomUUID()) {
  return (await db.query(
    "select public.staff_begin_mapping_import($1::uuid,$2::int,$3::uuid,$4::text,$5::text) result",
    [releaseId, revision, requestId, fixture.digest, fixture.manifestBytes.toString("base64")],
  )).rows[0].result;
}

async function stageChunk(db, begin, fixture, fileName, chunkIndex, bytes, overrides = {}) {
  return (await db.query(
    "select public.staff_stage_mapping_import_chunk($1::uuid,$2::uuid,$3::text,$4::int,$5::text,$6::int,$7::text) result",
    [
      begin.importId,
      overrides.requestId ?? begin.rootRequestId,
      overrides.digest ?? fixture.digest,
      overrides.revision ?? begin.baseRevision,
      fileName,
      chunkIndex,
      Buffer.from(bytes).toString("base64"),
    ],
  )).rows[0].result;
}

async function stagePackage(db, begin, fixture, { reverseObservationChunks = false } = {}) {
  for (const name of DATA_FILE_NAMES) {
    const parts = chunks(fixture.dataBytes[name]);
    const indexes = parts.map((_, index) => index);
    if (reverseObservationChunks && name === "survey_observations.json") indexes.reverse();
    for (const index of indexes) await stageChunk(db, begin, fixture, name, index, parts[index]);
  }
}

async function sealImport(db, begin, revision = begin.baseRevision, operationId = randomUUID()) {
  return (await db.query(
    "select public.staff_seal_mapping_import($1::uuid,$2::int,$3::uuid,$4::uuid) result",
    [begin.importId, revision, begin.rootRequestId, operationId],
  )).rows[0].result;
}

async function abandonImport(db, begin, revision, operationId = randomUUID(), reason = "Synthetic cancellation") {
  return (await db.query(
    "select public.staff_abandon_mapping_import($1::uuid,$2::int,$3::text,$4::uuid,$5::uuid) result",
    [begin.importId, revision, reason, begin.rootRequestId, operationId],
  )).rows[0].result;
}

async function operationalCounts(db) {
  const tables = [
    "mapping_boundary", "plot_geometry", "mapping_walkway_source", "grave_access_point", "mapping_display_feature",
  ];
  const result = {};
  for (const table of tables) result[table] = (await db.query(`select count(*)::int n from public.${table}`)).rows[0].n;
  result.release_nodes = (await db.query("select count(*)::int n from public.map_node where mapping_release_id is not null")).rows[0].n;
  result.release_edges = (await db.query("select count(*)::int n from public.map_edge where mapping_release_id is not null")).rows[0].n;
  result.publications = (await db.query("select count(*)::int n from public.mapping_publication")).rows[0].n;
  return result;
}

async function prepareRelease(db, overrides = {}) {
  const values = releaseValues({ release_code: `transport-${randomUUID()}`, ...overrides });
  const release = await createRelease(db, values);
  return { release, values, fixture: packageFixture(values.release_code) };
}

async function withCommittedOwnerOperation(db, callback) {
  await gisLogin(db, gisActors.admin, "postgres");
  await db.exec("begin");
  try {
    const result = await callback();
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  } finally {
    await gisLogin(db);
  }
}

async function privateReceiptCount(db) {
  await gisLogin(db, gisActors.admin, "postgres");
  try {
    return (await db.query("select count(*)::int n from gis_private.gis_mutation_request")).rows[0].n;
  } finally {
    await gisLogin(db);
  }
}

test("M06 bounded private import transport", async (t) => {
  const db = await createTestDatabase({ throughMigration: M06 });
  t.after(() => db.close());
  await seedGisFixtures(db);
  await gisLogin(db);

  await t.test("creates only the approved M06 objects and exact RPC surface", async () => {
    const tables = (await db.query(`select table_name from information_schema.tables
      where table_schema='public' and table_name like 'mapping_import%' order by table_name`)).rows.map((row) => row.table_name);
    assert.deepEqual(tables, ["mapping_import", "mapping_import_chunk", "mapping_import_file", "mapping_import_report"]);
    const functions = (await db.query(`select p.proname,pg_get_function_identity_arguments(p.oid) args
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname like 'staff_%mapping_import%' order by p.proname`)).rows;
    assert.deepEqual(functions, [
      { proname: "staff_abandon_mapping_import", args: "p_import_id uuid, p_expected_revision integer, p_reason text, p_request_id uuid, p_operation_id uuid" },
      { proname: "staff_begin_mapping_import", args: "p_release_id uuid, p_expected_revision integer, p_request_id uuid, p_package_digest text, p_manifest_bytes_base64 text" },
      { proname: "staff_mapping_import_status", args: "p_import_id uuid, p_report_page integer, p_report_page_size integer" },
      { proname: "staff_seal_mapping_import", args: "p_import_id uuid, p_expected_revision integer, p_request_id uuid, p_operation_id uuid" },
      { proname: "staff_stage_mapping_import_chunk", args: "p_import_id uuid, p_request_id uuid, p_package_digest text, p_expected_revision integer, p_file_name text, p_chunk_index integer, p_bytes_base64 text" },
    ]);
    assert.equal((await db.query("select to_regprocedure('public.staff_validate_mapping_import(uuid,integer,uuid,uuid)') is null absent")).rows[0].absent, true);
    assert.equal((await db.query("select to_regprocedure('public.staff_finalize_mapping_import(uuid,integer,text,jsonb,uuid,uuid)') is null absent")).rows[0].absent, true);

    const rls = (await db.query(`select relname,relrowsecurity from pg_class
      where oid=any(array['public.mapping_import'::regclass,'public.mapping_import_file'::regclass,
        'public.mapping_import_chunk'::regclass,'public.mapping_import_report'::regclass]) order by relname`)).rows;
    assert.equal(rls.length, 4);
    assert.equal(rls.every((row) => row.relrowsecurity), true);

    const rpcSecurity = (await db.query(`select bool_and(p.prosecdef) security_definer,
        bool_and('search_path=pg_catalog, extensions, pg_temp'=any(p.proconfig)) pinned
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=any(array[
        'staff_begin_mapping_import','staff_stage_mapping_import_chunk','staff_seal_mapping_import',
        'staff_abandon_mapping_import','staff_mapping_import_status'])`)).rows[0];
    assert.deepEqual(rpcSecurity, { security_definer: true, pinned: true });

    const privateExecution = (await db.query(`select p.proname,
        has_function_privilege('authenticated',p.oid,'EXECUTE') may_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='gis_private' and p.proname=any(array[
        'decode_strict_base64','strict_json','package_digest','assert_import_manifest',
        'assemble_import_file','guard_mapping_import','guard_import_evidence']) order by p.proname`)).rows;
    assert.equal(privateExecution.length, 7);
    assert.equal(privateExecution.every((row) => !row.may_execute), true);

    const tablePrivileges = (await db.query(`select table_name,
        has_table_privilege('authenticated','public.'||table_name,'SELECT') may_select,
        has_table_privilege('authenticated','public.'||table_name,'INSERT,UPDATE,DELETE') may_write,
        has_table_privilege('anon','public.'||table_name,'SELECT') anonymous_select
      from information_schema.tables where table_schema='public' and table_name like 'mapping_import%'
      order by table_name`)).rows;
    assert.equal(tablePrivileges.length, 4);
    assert.equal(tablePrivileges.every((row) => row.may_select && !row.may_write && !row.anonymous_select), true);

    const indexes = (await db.query(`select indexname from pg_indexes where schemaname='public'
      and tablename like 'mapping_import%' order by indexname`)).rows.map((row) => row.indexname);
    for (const required of [
      "mapping_import_active_release_key", "mapping_import_chunk_assembly_idx",
      "mapping_import_release_state_idx", "mapping_import_report_import_time_idx",
    ]) assert.ok(indexes.includes(required), required);
  });

  await t.test("begin is idempotent and binds actor, release revision, digest, and exact manifest", async () => {
    const { release, fixture } = await prepareRelease(db);
    const rootRequest = randomUUID();
    const first = await beginImport(db, release.id, 1, fixture, rootRequest);
    const retry = await beginImport(db, release.id, 1, fixture, rootRequest);
    assert.deepEqual(retry, first);
    assert.equal(first.state, "receiving");
    assert.equal(first.baseRevision, 1);
    assert.equal(first.targetRevision, 2);
    assert.equal(first.rootRequestId, rootRequest);
    assert.equal(first.packageDigest, fixture.digest);
    assert.equal((await db.query("select count(*)::int n from public.mapping_import where release_id=$1", [release.id])).rows[0].n, 1);

    await assert.rejects(beginImport(db, release.id, 2, fixture, rootRequest), /conflict|revision|request/i);
    await assert.rejects(beginImport(db, release.id, 1, { ...fixture, digest: "f".repeat(64) }, rootRequest), /conflict|digest|request/i);
    const changedManifest = packageFixture(fixture.manifest.release_code, { manifest: { title: "Changed manifest" } });
    await assert.rejects(beginImport(db, release.id, 1, changedManifest, rootRequest), /conflict|manifest|request/i);
    await gisLogin(db, gisActors.otherAdmin);
    await assert.rejects(beginImport(db, release.id, 1, fixture, rootRequest), /actor|administrator|conflict|request/i);
    await gisLogin(db);

    const oversizedFile = await prepareRelease(db);
    oversizedFile.fixture.manifest.files[0].bytes = 4_194_305;
    refreshFixtureManifest(oversizedFile.fixture);
    await assert.rejects(beginImport(db, oversizedFile.release.id, 1, oversizedFile.fixture), /file|manifest|limit|invalid/i);

    const oversizedPackage = await prepareRelease(db);
    oversizedPackage.fixture.manifest.files[0].bytes = 4_194_304;
    oversizedPackage.fixture.manifest.files[1].bytes = 4_194_304;
    refreshFixtureManifest(oversizedPackage.fixture);
    await assert.rejects(beginImport(db, oversizedPackage.release.id, 1, oversizedPackage.fixture), /package|total|byte|invalid/i);
  });

  await t.test("chunk retries are natural-key idempotent, bounded, immutable, and cumulative", async () => {
    const { release, fixture } = await prepareRelease(db);
    const begin = await beginImport(db, release.id, 1, fixture);
    const observationParts = chunks(fixture.dataBytes["survey_observations.json"]);
    assert.equal(observationParts.length, 2);
    const later = await stageChunk(db, begin, fixture, "survey_observations.json", 1, observationParts[1]);
    const retry = await stageChunk(db, begin, fixture, "survey_observations.json", 1, observationParts[1]);
    assert.deepEqual(retry, later);
    const earlier = await stageChunk(db, begin, fixture, "survey_observations.json", 0, observationParts[0]);
    assert.equal(earlier.receivedChunkCount, 2);
    assert.equal(earlier.receivedBytes, fixture.dataBytes["survey_observations.json"].byteLength);

    const changed = Buffer.from(observationParts[0]);
    changed[0] = changed[0] === 0x5b ? 0x7b : 0x5b;
    await assert.rejects(stageChunk(db, begin, fixture, "survey_observations.json", 0, changed), /conflict|immutable|chunk/i);
    await assert.rejects(stageChunk(db, begin, fixture, "survey_observations.json", 0, observationParts[0], { digest: "f".repeat(64) }), /digest|binding/i);
    await assert.rejects(stageChunk(db, begin, fixture, "survey_observations.json", 0, observationParts[0], { revision: 2 }), /revision|binding/i);
    await gisLogin(db, gisActors.otherAdmin);
    await assert.rejects(stageChunk(db, begin, fixture, "survey_observations.json", 0, observationParts[0]), /actor|owner|administrator/i);
    await gisLogin(db);

    await assert.rejects(stageChunk(db, begin, fixture, "route_nodes.geojson", 0, Buffer.alloc(65_537, 1)), /64|chunk|limit|large/i);
    await assert.rejects(db.query(
      "select public.staff_stage_mapping_import_chunk($1::uuid,$2::uuid,$3,$4,$5,$6,$7)",
      [begin.importId, begin.rootRequestId, fixture.digest, 1, "route_nodes.geojson", 0, "A".repeat(131_073)],
    ), /128|envelope|limit|base64|large/i);
    await assert.rejects(db.query(
      "select public.staff_stage_mapping_import_chunk($1::uuid,$2::uuid,$3,$4,$5,$6,$7)",
      [begin.importId, begin.rootRequestId, fixture.digest, 1, "route_nodes.geojson", 0, "%%%"],
    ), /base64|canonical|payload/i);

    await db.exec("set role authenticated");
    await assert.rejects(db.query("update public.mapping_import_chunk set chunk_bytes='x'::bytea where import_id=$1", [begin.importId]), /permission denied|row-level security/i);
    await gisLogin(db);
  });

  await t.test("missing chunks stay resumable, valid out-of-order input seals once, and content defects are retained invalid", async () => {
    const baseline = await operationalCounts(db);
    const valid = await prepareRelease(db);
    const begin = await beginImport(db, valid.release.id, 1, valid.fixture);
    await stageChunk(db, begin, valid.fixture, DATA_FILE_NAMES[0], 0, chunks(valid.fixture.dataBytes[DATA_FILE_NAMES[0]])[0]);
    const incompleteOperation = randomUUID();
    const incomplete = await sealImport(db, begin, 1, incompleteOperation);
    assert.equal(incomplete.state, "receiving");
    assert.ok(incomplete.missingChunkCount > 0);
    assert.equal((await db.query("select state from public.mapping_import where import_id=$1", [begin.importId])).rows[0].state, "receiving");
    await gisLogin(db, gisActors.admin, "postgres");
    assert.equal((await db.query("select count(*)::int n from gis_private.gis_mutation_request where request_id=$1", [incompleteOperation])).rows[0].n, 0);
    await gisLogin(db);
    await stagePackage(db, begin, valid.fixture, { reverseObservationChunks: true });
    const sealOperation = randomUUID();
    const sealed = await sealImport(db, begin, 1, sealOperation);
    assert.equal(sealed.state, "sealed");
    assert.equal(sealed.currentReleaseRevision, 2);
    assert.deepEqual(await sealImport(db, begin, 1, sealOperation), sealed);
    const releaseRow = (await db.query("select status,revision,package_hash from public.mapping_release where release_id=$1", [valid.release.id])).rows[0];
    assert.deepEqual(releaseRow, { status: "staged", revision: 2, package_hash: valid.fixture.digest });

    const bad = await prepareRelease(db);
    const badBegin = await beginImport(db, bad.release.id, 1, bad.fixture);
    const badBytes = { ...bad.fixture.dataBytes, "route_nodes.geojson": stableJson(featureCollection([])) };
    for (const name of DATA_FILE_NAMES) {
      const parts = chunks(badBytes[name]);
      for (let index = 0; index < parts.length; index += 1) await stageChunk(db, badBegin, bad.fixture, name, index, parts[index]);
    }
    const invalid = await sealImport(db, badBegin);
    assert.equal(invalid.state, "invalid");
    assert.equal(invalid.currentReleaseRevision, 1);
    assert.equal((await db.query("select failure_classification from public.mapping_import where import_id=$1", [badBegin.importId])).rows[0].failure_classification, "package");
    assert.equal((await db.query("select count(*)::int n from public.mapping_import_report where import_id=$1", [badBegin.importId])).rows[0].n, 1);
    assert.deepEqual(await operationalCounts(db), baseline);
    await assert.rejects(stageChunk(db, badBegin, bad.fixture, "route_nodes.geojson", 0, bad.fixture.dataBytes["route_nodes.geojson"]), /state|receiving|immutable/i);
    const abandoned = await abandonImport(db, badBegin, 1);
    assert.equal(abandoned.state, "abandoned");

    const wrongCount = await prepareRelease(db);
    wrongCount.fixture.manifest.files.find((file) => file.name === "route_nodes.geojson").feature_count = 2;
    refreshFixtureManifest(wrongCount.fixture);
    const wrongCountBegin = await beginImport(db, wrongCount.release.id, 1, wrongCount.fixture);
    await stagePackage(db, wrongCountBegin, wrongCount.fixture);
    assert.equal((await sealImport(db, wrongCountBegin)).state, "invalid");

    const aggregate = await prepareRelease(db);
    replaceFixtureFile(aggregate.fixture, "georeferencing_run_points.json", Array.from({ length: 2001 }, () => ({})));
    replaceFixtureFile(aggregate.fixture, "georeferencing_validation.json", Array.from({ length: 2000 }, () => ({})));
    const aggregateBegin = await beginImport(db, aggregate.release.id, 1, aggregate.fixture);
    await stagePackage(db, aggregateBegin, aggregate.fixture);
    assert.equal((await sealImport(db, aggregateBegin)).state, "invalid");
    assert.deepEqual(await operationalCounts(db), baseline);
  });

  await t.test("SQL strict JSON matches the Task 8 adversarial corpus", async () => {
    await gisLogin(db, gisActors.admin, "postgres");
    for (const fixture of GIS_STRICT_JSON_CORPUS) {
      let jsValid = true;
      try { parseStrictJson(fixture.bytes); } catch { jsValid = false; }
      assert.equal(jsValid, fixture.valid, `JS corpus expectation: ${fixture.name}`);
      if (fixture.valid) {
        const row = (await db.query("select gis_private.strict_json(decode($1,'hex')) value", [fixture.bytes.toString("hex")])).rows[0];
        assert.ok(row.value !== undefined, fixture.name);
      } else {
        await assert.rejects(
          db.query("select gis_private.strict_json(decode($1,'hex')) value", [fixture.bytes.toString("hex")]),
          undefined,
          fixture.name,
        );
      }
    }
    await gisLogin(db);
  });

  await t.test("begin and seal independently enforce exact pilot scope without side effects", async () => {
    const beforeImports = (await db.query("select count(*)::int n from public.mapping_import")).rows[0].n;
    const full = await prepareRelease(db, { scope_kind: "full", pilot_area_id: null });
    await assert.rejects(beginImport(db, full.release.id, 1, full.fixture), /pilot|scope/i);
    assert.equal((await db.query("select count(*)::int n from public.mapping_import")).rows[0].n, beforeImports);

    const missing = await prepareRelease(db);
    await withOwnerTransaction(db, async () => {
      await db.exec("alter table public.mapping_release_area disable trigger user");
      await db.query("delete from public.mapping_release_area where release_id=$1", [missing.release.id]);
      await assert.rejects(beginImport(db, missing.release.id, 1, missing.fixture), /pilot|scope|area/i);
    });
    assert.equal((await db.query("select count(*)::int n from public.mapping_import where release_id=$1", [missing.release.id])).rows[0].n, 0);

    const sealScope = await prepareRelease(db);
    const begin = await beginImport(db, sealScope.release.id, 1, sealScope.fixture);
    await stagePackage(db, begin, sealScope.fixture);
    const beforeRelease = (await db.query("select status,revision from public.mapping_release where release_id=$1", [sealScope.release.id])).rows[0];
    const beforePublications = (await db.query("select count(*)::int n from public.mapping_publication")).rows[0].n;
    await withOwnerTransaction(db, async () => {
      await db.exec("alter table public.mapping_release_area disable trigger user");
      await db.query("insert into public.mapping_release_area(release_id,site_id,area_id) values($1,1,2)", [sealScope.release.id]);
      await assert.rejects(sealImport(db, begin), /pilot|scope|area/i);
    });
    assert.deepEqual((await db.query("select status,revision from public.mapping_release where release_id=$1", [sealScope.release.id])).rows[0], beforeRelease);
    assert.equal((await db.query("select state from public.mapping_import where import_id=$1", [begin.importId])).rows[0].state, "receiving");
    assert.equal((await db.query("select count(*)::int n from public.mapping_publication")).rows[0].n, beforePublications);
  });

  await t.test("restaging advances the release once and retains prior transport/report evidence", async () => {
    const first = await prepareRelease(db);
    const beginOne = await beginImport(db, first.release.id, 1, first.fixture);
    await stagePackage(db, beginOne, first.fixture);
    await sealImport(db, beginOne, 1);

    const reportId = randomUUID();
    await withCommittedOwnerOperation(db, async () => {
      const validateReceipt = randomUUID();
      await db.query(`insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash)
        values($1,$2,'staff_validate_mapping_import',$3)`, [validateReceipt, gisActors.admin, "a".repeat(64)]);
      await db.query(`insert into public.mapping_import_report(
        report_id,import_id,release_revision,package_digest,validator_version,baseline_publication_revision,
        failure_classification,summary,entries,report_hash,created_by)
        values($1,$2,2,$3,'gis-pilot-v1',0,null,'{"errorCount":0,"warningCount":0}'::jsonb,'[]'::jsonb,$4,$5)`,
      [reportId, beginOne.importId, first.fixture.digest, "c".repeat(64), gisActors.admin]);
      await db.query("update public.mapping_import set state='validated',revision=revision+1,current_report_id=$2 where import_id=$1", [beginOne.importId, reportId]);
      await db.query("delete from gis_private.gis_mutation_request where request_id=$1", [validateReceipt]);
    });
    await withCommittedOwnerOperation(db, async () => {
      const finalizeReceipt = randomUUID();
      await db.query(`insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash)
        values($1,$2,'staff_finalize_mapping_import',$3)`, [finalizeReceipt, gisActors.admin, "d".repeat(64)]);
      await db.query("update public.mapping_import set state='finalized',revision=revision+1 where import_id=$1", [beginOne.importId]);
      await db.query(`update public.mapping_release set status='validated',revision=revision+1,
        validation_report_hash=$2,validation_summary='{"schemaVersion":1,"errorCount":0,"warningCount":0,"reportDigest":"${"c".repeat(64)}"}'::jsonb,
        validated_at=transaction_timestamp(),validated_by=$3 where release_id=$1`,
      [first.release.id, "c".repeat(64), gisActors.admin]);
      await db.query("delete from gis_private.gis_mutation_request where request_id=$1", [finalizeReceipt]);
    });

    const historyBefore = {
      files: (await db.query("select count(*)::int n from public.mapping_import_file where import_id=$1", [beginOne.importId])).rows[0].n,
      chunks: (await db.query("select count(*)::int n from public.mapping_import_chunk where import_id=$1", [beginOne.importId])).rows[0].n,
      reports: (await db.query("select count(*)::int n from public.mapping_import_report where import_id=$1", [beginOne.importId])).rows[0].n,
      receipts: await privateReceiptCount(db),
    };
    const secondFixture = packageFixture(first.values.release_code, { manifest: { description: "Corrected synthetic package" } });
    const beginTwo = await beginImport(db, first.release.id, 3, secondFixture);
    await stagePackage(db, beginTwo, secondFixture);
    const restaged = await sealImport(db, beginTwo, 3);
    assert.equal(restaged.currentReleaseRevision, 4);
    const releaseRow = (await db.query(`select status,revision,validation_report_hash,validation_summary,
      validated_at,validated_by from public.mapping_release where release_id=$1`, [first.release.id])).rows[0];
    assert.deepEqual(releaseRow, {
      status: "staged", revision: 4, validation_report_hash: null, validation_summary: null,
      validated_at: null, validated_by: null,
    });
    assert.deepEqual({
      files: (await db.query("select count(*)::int n from public.mapping_import_file where import_id=$1", [beginOne.importId])).rows[0].n,
      chunks: (await db.query("select count(*)::int n from public.mapping_import_chunk where import_id=$1", [beginOne.importId])).rows[0].n,
      reports: (await db.query("select count(*)::int n from public.mapping_import_report where import_id=$1", [beginOne.importId])).rows[0].n,
      receipts: await privateReceiptCount(db) >= historyBefore.receipts,
    }, { ...historyBefore, receipts: true });
  });

  await t.test("state guards, status redaction, RLS, ACLs, and role denial remain authoritative", async () => {
    const prepared = await prepareRelease(db);
    const begin = await beginImport(db, prepared.release.id, 1, prepared.fixture);
    const status = (await db.query("select public.staff_mapping_import_status($1::uuid,1,100) result", [begin.importId])).rows[0].result;
    assert.equal(status.state, "receiving");
    assert.ok(Array.isArray(status.missingChunks));
    assert.equal(JSON.stringify(status).includes("chunkBytes"), false);
    assert.equal(JSON.stringify(status).includes(prepared.fixture.manifestBytes.toString("base64")), false);

    for (const [actor, role] of [[gisActors.manager, "authenticated"], [gisActors.inactive, "authenticated"], [null, "anon"]]) {
      await gisLogin(db, actor, role);
      await assert.rejects(beginImport(db, prepared.release.id, 1, prepared.fixture, randomUUID()), /administrator|permission/i);
      await assert.rejects(db.query("select public.staff_mapping_import_status($1::uuid,1,100)", [begin.importId]), /administrator|permission/i);
      if (role === "anon") {
        await assert.rejects(db.query("select * from public.mapping_import limit 1"), /permission denied/i);
        await assert.rejects(db.query("select * from public.mapping_import_chunk limit 1"), /permission denied/i);
      } else {
        assert.equal((await db.query("select * from public.mapping_import limit 1")).rows.length, 0);
        assert.equal((await db.query("select * from public.mapping_import_chunk limit 1")).rows.length, 0);
      }
      await assert.rejects(db.query("select gis_private.strict_json('7b7d'::bytea)"), /permission denied|schema/i);
    }
    await gisLogin(db);
    await assert.rejects(db.query("update public.mapping_import set state='finalized' where import_id=$1", [begin.importId]), /permission denied|row-level security/i);

    for (const transition of [
      { from: "receiving", to: "validated", operation: "staff_validate_mapping_import" },
      { from: "sealed", to: "finalized", operation: "staff_finalize_mapping_import" },
      { from: "invalid", to: "sealed", operation: "staff_seal_mapping_import" },
      { from: "validated", to: "sealed", operation: "staff_seal_mapping_import" },
      { from: "finalized", to: "abandoned", operation: "staff_abandon_mapping_import" },
      { from: "abandoned", to: "receiving", operation: "staff_begin_mapping_import" },
    ]) {
      await withOwnerTransaction(db, async () => {
        await db.exec("alter table public.mapping_import disable trigger mapping_import_guard");
        await db.query(`update public.mapping_import set state=$2,revision=10,
          abandon_reason=case when $2='abandoned' then 'Synthetic terminal fixture' else null end
          where import_id=$1`, [begin.importId, transition.from]);
        await db.exec("alter table public.mapping_import enable trigger mapping_import_guard");
        await db.query(`insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash)
          values($1,$2,$3,$4)`, [randomUUID(), gisActors.admin, transition.operation, "e".repeat(64)]);
        await assert.rejects(db.query("update public.mapping_import set state=$2,revision=11 where import_id=$1",
          [begin.importId, transition.to]), /forbidden|transition|operation/i);
      });
    }

    const abandoned = await abandonImport(db, begin, 1);
    assert.equal(abandoned.state, "abandoned");
    await assert.rejects(abandonImport(db, begin, 1, randomUUID()), /terminal|state|abandon/i);
    const audits = (await db.query("select old_values,new_values from public.audit_log where table_name='mapping_import' and record_id=$1", [begin.importId])).rows;
    assert.ok(audits.length >= 2);
    const auditText = JSON.stringify(audits);
    assert.equal(auditText.includes("Synthetic cancellation"), false);
    assert.equal(auditText.includes(prepared.fixture.manifestBytes.toString("base64")), false);
    assert.equal(HASH_PATTERN.test(prepared.fixture.digest), true);
  });
});
