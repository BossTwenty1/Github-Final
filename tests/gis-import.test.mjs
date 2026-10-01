import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
import { createImportClient, readResumeState, writeResumeState } from "../scripts/gis/import-client.mjs";
import { run as runImportCli } from "../scripts/import-gis-package.mjs";

const M06 = "20260928210000_gis_import_transport.sql";
const M07 = "20260928220000_gis_import_validation.sql";
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

function finalizablePackageFixture(releaseCode, lotId = "1") {
  const common = (source_feature_id) => ({ source_feature_id, site_id: "1", artifact_hash: "e".repeat(64), layer_version: "v1" });
  const observations = [];
  for (const capture_code of ["CAP-GCP-01", "CAP-VAL-01"]) {
    for (let index = 0; index < 5; index += 1) observations.push({ capture_code, observation_order: index + 1,
      latitude: 13.006, longitude: 123.006, reported_accuracy_m: 1,
      captured_at: new Date(Date.parse("2026-09-28T01:00:00.000Z") + index * 30_000).toISOString() });
  }
  return packageFixture(releaseCode, { data: {
    "cemetery_boundary.geojson": featureCollection([{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[123, 13], [123.02, 13], [123.02, 13.02], [123, 13.02], [123, 13]]] }, properties: { ...common("cemetery-1"), kind: "cemetery", area_id: "1" } }]),
    "garden_sections.geojson": featureCollection([{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[123.001, 13.001], [123.019, 13.001], [123.019, 13.019], [123.001, 13.019], [123.001, 13.001]]] }, properties: { ...common("area-1"), kind: "area", area_id: "1" } }]),
    "roads_walkways.geojson": featureCollection([{ type: "Feature", geometry: { type: "LineString", coordinates: [[123.002, 13.002], [123.009, 13.009]] }, properties: { ...common("walkway-1"), edge_type: "path", walking_allowed: true, is_restricted: false } }]),
    "grave_plots.geojson": featureCollection([{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[123.01, 13.01], [123.011, 13.01], [123.011, 13.011], [123.01, 13.011], [123.01, 13.01]]] }, properties: { ...common("plot-1"), lot_id: lotId, area_id: "1" } }]),
    "grave_access_points.geojson": featureCollection([{ type: "Feature", geometry: { type: "Point", coordinates: [123.009, 13.009] }, properties: { ...common("access-1"), lot_id: lotId, area_id: "1", node_source_feature_id: "node-access" } }]),
    "route_nodes.geojson": featureCollection([
      { type: "Feature", geometry: { type: "Point", coordinates: [123.002, 13.002] }, properties: { ...common("node-entrance"), node_name: "Pilot entrance", node_type: "entrance" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [123.009, 13.009] }, properties: { ...common("node-access"), node_name: "Plot access", node_type: "junction" } },
    ]),
    "route_edges.geojson": featureCollection([{ type: "Feature", geometry: { type: "LineString", coordinates: [[123.002, 13.002], [123.009, 13.009]] }, properties: { ...common("edge-1"), from_source_feature_id: "node-entrance", to_source_feature_id: "node-access", walkway_source_feature_id: "walkway-1", edge_type: "path", walking_allowed: true, is_restricted: false, direction: "both" } }]),
    "landmarks.geojson": featureCollection([]),
    "survey_points.json": [
      { point_code: "GCP-01", site_id: "1", role: "GCP", description: "Synthetic fitting control" },
      { point_code: "VAL-01", site_id: "1", role: "VALIDATION", description: "Synthetic independent validation" },
    ],
    "survey_captures.json": [
      { capture_code: "CAP-GCP-01", point_code: "GCP-01", site_id: "1", started_at: "2026-09-28T01:00:00.000Z", ended_at: "2026-09-28T01:05:00.000Z" },
      { capture_code: "CAP-VAL-01", point_code: "VAL-01", site_id: "1", started_at: "2026-09-28T01:00:00.000Z", ended_at: "2026-09-28T01:05:00.000Z" },
    ],
    "survey_observations.json": observations,
    "georeferencing_runs.json": [{ run_code: "RUN-01", release_code: releaseCode, site_id: "1",
      source_reference: "synthetic/plan.png", source_sha256: "c".repeat(64), source_width: 1000, source_height: 800,
      source_coordinate_space: "pixel coordinates", working_srid: 32651, output_srid: 4326, method: "polynomial-1",
      processing_parameters: { expected_validation_count: 1 }, processed_at: "2026-09-28T02:00:00.000Z", qgis_version: "3.40",
      output_artifact_reference: "synthetic/georeferenced.tif", output_artifact_sha256: "d".repeat(64) }],
    "georeferencing_run_points.json": [
      { run_code: "RUN-01", point_code: "GCP-01", capture_code: "CAP-GCP-01", role: "FITTING", source_x: 100, source_y: 100, fitting_residual_m: 1 },
      { run_code: "RUN-01", point_code: "VAL-01", capture_code: "CAP-VAL-01", role: "VALIDATION", source_x: 200, source_y: 200 },
    ],
    "georeferencing_validation.json": [{ run_code: "RUN-01", point_code: "VAL-01", transformed_plan_point: { type: "Point", coordinates: [123.00601, 13.00601] }, review_state: "reviewed" }],
  }, manifest: { selected_run_code: "RUN-01", pilot_lot_ids: [lotId], limitations: [] } });
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

async function releaseSnapshot(db, releaseId) {
  await gisLogin(db, gisActors.admin, "postgres");
  const rows = {};
  for (const [key, table, id, geom] of [
    ["boundaries", "mapping_boundary", "boundary_id", "boundary_geom"],
    ["plots", "plot_geometry", "plot_geometry_id", "plot_geom"],
    ["walkways", "mapping_walkway_source", "walkway_source_id", "centerline_geom"],
    ["access", "grave_access_point", "access_point_id", "access_point_geom"],
    ["display", "mapping_display_feature", "display_feature_id", "display_geom"],
  ]) rows[key] = (await db.query(`select ${id}::text id,source_feature_id,extensions.st_asgeojson(${geom}) geom
    from public.${table} where mapping_release_id=$1 order by source_feature_id`, [releaseId])).rows;
  rows.nodes = (await db.query(`select node_id::text id,source_feature_id,extensions.st_asgeojson(location_geom::extensions.geometry) geom
    from public.map_node where mapping_release_id=$1 order by source_feature_id`, [releaseId])).rows;
  rows.edges = (await db.query(`select edge_id::text id,source_feature_id,extensions.st_asgeojson(path_geom::extensions.geometry) geom
    from public.map_edge where mapping_release_id=$1 order by source_feature_id`, [releaseId])).rows;
  await gisLogin(db);
  return rows;
}

async function prepareRelease(db, overrides = {}) {
  const values = releaseValues({ release_code: `transport-${randomUUID()}`, ...overrides });
  const release = await createRelease(db, values);
  return { release, values, fixture: packageFixture(values.release_code) };
}

async function createAcceptedEvidence(db, releaseId) {
  async function savePoint(role, code) {
    const existing = (await db.query("select point_id id from public.survey_point where site_id=1 and point_code=$1", [code])).rows[0];
    if (existing) return existing;
    return (await db.query("select public.staff_save_survey_point(null,null,$1::jsonb,$2::uuid) result", [
      JSON.stringify({ site_id: "1", point_code: code, role, description: "Synthetic Task 10 evidence" }), randomUUID(),
    ])).rows[0].result;
  }
  async function capture(pointId, code) {
    const existing = (await db.query("select capture_id id from public.survey_capture where point_id=$1 and capture_code=$2 and review_state='accepted'", [pointId, code])).rows[0];
    if (existing) return existing;
    const observations = Array.from({ length: 5 }, (_, index) => ({ observation_order: index + 1,
      latitude: 13.006, longitude: 123.006, reported_accuracy_m: 1,
      captured_at: new Date(Date.parse("2026-09-28T01:00:00.000Z") + index * 30_000).toISOString() }));
    const recorded = (await db.query("select public.staff_record_survey_capture($1::uuid,$2,$3::jsonb,$4::jsonb,$5::uuid) result", [
      pointId, code, JSON.stringify({ started_at: "2026-09-28T01:00:00.000Z", ended_at: "2026-09-28T01:05:00.000Z" }), JSON.stringify(observations), randomUUID(),
    ])).rows[0].result;
    return (await db.query("select public.staff_review_survey_capture($1::uuid,1,'accepted','[]'::jsonb,null,$2::uuid) result", [recorded.id, randomUUID()])).rows[0].result;
  }
  const gcp = await savePoint("GCP", "GCP-01");
  const validation = await savePoint("VALIDATION", "VAL-01");
  const gcpCapture = await capture(gcp.id, "CAP-GCP-01");
  const validationCapture = await capture(validation.id, "CAP-VAL-01");
  const values = { release_id: releaseId, run_code: "RUN-01", source_reference: "synthetic/plan.png", source_hash: "c".repeat(64),
    source_width: 1000, source_height: 800, source_coordinate_space: "pixel coordinates", working_srid: 32651, output_srid: 4326,
    method: "polynomial-1", processing_parameters: { expected_validation_count: 1 }, processed_at: "2026-09-28T02:00:00.000Z",
    qgis_version: "3.40", output_artifact_reference: "synthetic/georeferenced.tif", output_artifact_hash: "d".repeat(64) };
  const run = (await db.query("select public.staff_save_georeferencing_run(null,null,$1::jsonb,$2::jsonb,$3::jsonb,$4::uuid) result", [
    JSON.stringify(values), JSON.stringify([
      { point_id: gcp.id, capture_id: gcpCapture.id, role: "FITTING", source_x: 100, source_y: 100, fitting_residual_m: 1 },
      { point_id: validation.id, capture_id: validationCapture.id, role: "VALIDATION", source_x: 200, source_y: 200 },
    ]), JSON.stringify([{ point_id: validation.id, transformed_longitude: 123.00601, transformed_latitude: 13.00601, review_state: "reviewed" }]), randomUUID(),
  ])).rows[0].result;
  await db.query("select public.staff_review_georeferencing_run($1::uuid,1,'accepted',$2::jsonb,null,$3::uuid)", [
    run.id, JSON.stringify(["fitting_count_below_target", "validation_count_below_target"]), randomUUID(),
  ]);
  return { run, gcp, validation, gcpCapture, validationCapture };
}

async function prepareFinalizableRelease(db) {
  await gisLogin(db, gisActors.admin, "postgres");
  await db.exec(`insert into public.sector(sector_id,area_id,sector_code,sector_name) values(1,1,'S1','Synthetic sector') on conflict do nothing;
    insert into public.block(block_id,sector_id,block_number,block_name) values(1,1,1,'Synthetic block') on conflict do nothing;
    insert into public.lot(lot_id,block_id,lot_code,legacy_location_code,area_id) values(1,1,'LOT-1','LEGACY-1',1) on conflict do nothing;`);
  await gisLogin(db);
  const values = releaseValues({ release_code: `finalize-${randomUUID()}` });
  const release = await createRelease(db, values);
  const evidence = await createAcceptedEvidence(db, release.id);
  return { release, values, evidence, fixture: finalizablePackageFixture(values.release_code) };
}

function finalizationAcknowledgements(fixture) {
  return { warnings: [], reviewed_layer_hashes: Object.fromEntries(
    fixture.manifest.files.filter((file) => file.name.endsWith(".geojson")).map((file) => [file.name, file.sha256]),
  ) };
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

test("M07 deterministic validation and atomic finalization contracts", async (t) => {
  const db = await createTestDatabase({ throughMigration: M07 });
  t.after(() => db.close());
  await seedGisFixtures(db);
  await gisLogin(db);

  await t.test("adds only the protected validate/finalize surface with private helpers", async () => {
    const publicFunctions = (await db.query(`select p.proname,pg_get_function_identity_arguments(p.oid) args,
        p.prosecdef,'search_path=pg_catalog, extensions, pg_temp'=any(p.proconfig) pinned
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('staff_validate_mapping_import','staff_finalize_mapping_import')
      order by p.proname`)).rows;
    assert.deepEqual(publicFunctions, [
      { proname: "staff_finalize_mapping_import", args: "p_import_id uuid, p_expected_revision integer, p_report_digest text, p_acknowledgements jsonb, p_request_id uuid, p_operation_id uuid", prosecdef: true, pinned: true },
      { proname: "staff_validate_mapping_import", args: "p_import_id uuid, p_expected_revision integer, p_request_id uuid, p_operation_id uuid", prosecdef: true, pinned: true },
    ]);
    const privateFunctions = (await db.query(`select p.proname,p.prosecdef,
        has_function_privilege('authenticated',p.oid,'EXECUTE') may_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='gis_private' and p.proname in ('validate_import','validate_release','materialize_import')
      order by p.proname`)).rows;
    assert.deepEqual(privateFunctions.map(({ proname, prosecdef, may_execute }) => ({ proname, prosecdef, may_execute })), [
      { proname: "materialize_import", prosecdef: false, may_execute: false },
      { proname: "validate_import", prosecdef: false, may_execute: false },
      { proname: "validate_release", prosecdef: false, may_execute: false },
    ]);
    assert.equal((await db.query("select to_regclass('public.mapping_import_validation') is null absent")).rows[0].absent, true);
  });

  await t.test("complete import transition matrix is encoded and unlisted transitions remain denied", async () => {
    const source = (await readFile(new URL(`../supabase/migrations/${M07}`, import.meta.url), "utf8")).replace(/\s+/g, " ");
    for (const pair of [
      "sealed.*validated", "sealed.*invalid", "invalid.*validated", "invalid.*invalid",
      "validated.*validated", "validated.*invalid", "validated.*finalized",
    ]) assert.match(source, new RegExp(pair, "i"), pair);
    for (const forbidden of ["invalid.*finalized", "abandoned.*receiving", "finalized.*abandoned"])
      assert.match(source, new RegExp(forbidden, "i"), forbidden);
    assert.match(source, /assert_pilot_scope/i);
    assert.match(source, /mapping_publication/i);

    const prepared = await prepareRelease(db);
    const begin = await beginImport(db, prepared.release.id, 1, prepared.fixture);
    const allowed = [
      ["receiving", "sealed", "staff_seal_mapping_import"], ["receiving", "invalid", "staff_seal_mapping_import"],
      ["receiving", "abandoned", "staff_abandon_mapping_import"], ["sealed", "validated", "staff_validate_mapping_import"],
      ["sealed", "invalid", "staff_validate_mapping_import"], ["sealed", "abandoned", "staff_abandon_mapping_import"],
      ["invalid", "validated", "staff_validate_mapping_import"], ["invalid", "invalid", "staff_validate_mapping_import"],
      ["invalid", "abandoned", "staff_abandon_mapping_import"], ["validated", "validated", "staff_validate_mapping_import"],
      ["validated", "invalid", "staff_finalize_mapping_import"], ["validated", "finalized", "staff_finalize_mapping_import"],
      ["validated", "abandoned", "staff_abandon_mapping_import"],
    ];
    for (const [from, to, operation] of allowed) await withOwnerTransaction(db, async () => {
      await db.exec("alter table public.mapping_import disable trigger mapping_import_guard");
      await db.query("update public.mapping_import set state=$2,revision=10,abandon_reason=null where import_id=$1", [begin.importId, from]);
      await db.exec("alter table public.mapping_import enable trigger mapping_import_guard");
      await db.query("insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash) values($1,$2,$3,$4)",
        [randomUUID(), gisActors.admin, operation, "a".repeat(64)]);
      await db.query("update public.mapping_import set state=$2,revision=11,abandon_reason=case when $2='abandoned' then 'matrix fixture' else null end where import_id=$1", [begin.importId, to]);
      assert.deepEqual((await db.query("select state,revision from public.mapping_import where import_id=$1", [begin.importId])).rows[0], { state: to, revision: 11 });
    });
    const states = ["receiving", "sealed", "invalid", "validated", "finalized", "abandoned"];
    const allowedKeys = new Set(allowed.map(([from, to]) => `${from}:${to}`));
    for (const from of states) for (const to of states) {
      if (allowedKeys.has(`${from}:${to}`)) continue;
      const operation = to === "finalized" ? "staff_finalize_mapping_import" : to === "abandoned" ? "staff_abandon_mapping_import" :
        to === "sealed" ? "staff_seal_mapping_import" : "staff_validate_mapping_import";
      await withOwnerTransaction(db, async () => {
        await db.exec("alter table public.mapping_import disable trigger mapping_import_guard");
        await db.query("update public.mapping_import set state=$2,revision=10,abandon_reason=case when $2='abandoned' then 'terminal fixture' else null end where import_id=$1", [begin.importId, from]);
        await db.exec("alter table public.mapping_import enable trigger mapping_import_guard");
        await db.query("insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash) values($1,$2,$3,$4)",
          [randomUUID(), gisActors.admin, operation, "b".repeat(64)]);
        await assert.rejects(db.query("update public.mapping_import set state=$2,revision=11,abandon_reason=case when $2='abandoned' then 'denied fixture' else null end where import_id=$1", [begin.importId, to]), /forbidden|transition|operation/i);
      });
    }
  });

  await t.test("validation reports are deterministic, ordered, bounded, and validation never materializes", async () => {
    const { release, fixture } = await prepareRelease(db);
    const begin = await beginImport(db, release.id, 1, fixture);
    await stagePackage(db, begin, fixture);
    const sealed = await sealImport(db, begin);
    assert.equal(sealed.state, "sealed");
    const baseline = await operationalCounts(db);
    const operation = randomUUID();
    const first = (await db.query(
      "select public.staff_validate_mapping_import($1::uuid,$2::int,$3::uuid,$4::uuid) result",
      [begin.importId, 2, begin.rootRequestId, operation],
    )).rows[0].result;
    const replay = (await db.query(
      "select public.staff_validate_mapping_import($1::uuid,$2::int,$3::uuid,$4::uuid) result",
      [begin.importId, 2, begin.rootRequestId, operation],
    )).rows[0].result;
    assert.deepEqual(replay, first);
    assert.equal(HASH_PATTERN.test(first.digest), true);
    assert.deepEqual(await operationalCounts(db), baseline);
    const report = (await db.query("select entries,summary,report_hash,live_dependency_digest from public.mapping_import_report where report_id=$1", [first.reportId])).rows[0];
    assert.equal(report.report_hash, first.digest);
    assert.equal(HASH_PATTERN.test(report.live_dependency_digest), true);
    assert.ok(report.summary.errorCount > 0);
    const sorted = [...report.entries].sort((left, right) =>
      `${left.severity}\u0000${left.layer}\u0000${left.sourceFeatureId ?? ""}\u0000${left.lotId ?? ""}\u0000${left.code}`.localeCompare(
        `${right.severity}\u0000${right.layer}\u0000${right.sourceFeatureId ?? ""}\u0000${right.lotId ?? ""}\u0000${right.code}`,
      ));
    assert.deepEqual(report.entries, sorted);
    assert.ok(report.entries.some((entry) => entry.code === "missing_independent_validation"));
    assert.equal(first.state, "invalid");
  });

  await t.test("dry-run reports frozen-evidence mismatches and concrete topology categories", async () => {
    const prepared = await prepareFinalizableRelease(db);
    const fixture = finalizablePackageFixture(prepared.values.release_code);
    replaceFixtureFile(fixture, "survey_points.json", fixture.data["survey_points.json"].map((point) =>
      point.point_code === "GCP-01" ? { ...point, role: "VALIDATION" } : point));
    replaceFixtureFile(fixture, "survey_captures.json", fixture.data["survey_captures.json"].map((capture) =>
      capture.point_code === "GCP-01" ? { ...capture, capture_code: "CAP-NOT-FROZEN" } : capture));
    replaceFixtureFile(fixture, "georeferencing_run_points.json", fixture.data["georeferencing_run_points.json"].map((membership) =>
      membership.point_code === "GCP-01" ? { ...membership, capture_code: "CAP-NOT-FROZEN" } : membership));
    replaceFixtureFile(fixture, "georeferencing_runs.json", fixture.data["georeferencing_runs.json"].map((run) =>
      ({ ...run, source_sha256: "a".repeat(64) })));
    replaceFixtureFile(fixture, "route_nodes.geojson", featureCollection([
      ...fixture.data["route_nodes.geojson"].features,
      { type: "Feature", geometry: { type: "Point", coordinates: [123.004, 13.008] }, properties: { ...fixture.data["route_nodes.geojson"].features[0].properties, source_feature_id: "node-cross-a", node_type: "junction" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [123.008, 13.004] }, properties: { ...fixture.data["route_nodes.geojson"].features[0].properties, source_feature_id: "node-cross-b", node_type: "junction" } },
      { type: "Feature", geometry: { type: "Point", coordinates: [123.015, 13.015] }, properties: { ...fixture.data["route_nodes.geojson"].features[0].properties, source_feature_id: "node-isolated", node_type: "junction" } },
    ]));
    replaceFixtureFile(fixture, "route_edges.geojson", featureCollection([
      { ...fixture.data["route_edges.geojson"].features[0], geometry: { type: "LineString", coordinates: [[123.0021, 13.0021], [123.009, 13.009]] } },
      { type: "Feature", geometry: { type: "LineString", coordinates: [[123.004, 13.008], [123.008, 13.004]] }, properties: {
        ...fixture.data["route_edges.geojson"].features[0].properties, source_feature_id: "edge-cross",
        from_source_feature_id: "node-cross-a", to_source_feature_id: "node-cross-b",
      } },
    ]));
    replaceFixtureFile(fixture, "grave_access_points.geojson", featureCollection([
      { ...fixture.data["grave_access_points.geojson"].features[0], properties: { ...fixture.data["grave_access_points.geojson"].features[0].properties, node_source_feature_id: "node-isolated" } },
      { ...fixture.data["grave_access_points.geojson"].features[0], properties: { ...fixture.data["grave_access_points.geojson"].features[0].properties, source_feature_id: "access-orphan", node_source_feature_id: "node-missing" } },
    ]));
    const begin = await beginImport(db, prepared.release.id, 1, fixture);
    await stagePackage(db, begin, fixture);
    await sealImport(db, begin);
    const validation = (await db.query(
      "select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid) result",
      [begin.importId, begin.rootRequestId, randomUUID()],
    )).rows[0].result;
    assert.equal(validation.state, "invalid");
    const report = (await db.query("select entries,summary,failure_classification from public.mapping_import_report where report_id=$1", [validation.reportId])).rows[0];
    const codes = new Set(report.entries.map((entry) => entry.code));
    for (const code of ["survey_point_identity_mismatch", "capture_not_frozen", "accepted_run_evidence_mismatch",
      "run_membership_evidence_mismatch", "edge_endpoint_mismatch", "edge_walkway_lineage_mismatch",
      "unnoded_edge_crossing", "orphan_access_point", "unreachable_access_point"]) assert.equal(codes.has(code), true, code);
    assert.ok(report.summary.disconnectedGraphElements > 0);
    assert.ok(report.summary.orphanAccessPoints > 0);
    assert.ok(report.summary.unreachableDestinations > 0);
    assert.equal(report.failure_classification, "package", "package defects dominate simultaneous live dependency failures");
    await assert.rejects(db.query(
      "select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid)",
      [begin.importId, begin.rootRequestId, randomUUID()],
    ), /package-content defects.*new import|new import.*root request/i);
  });

  await t.test("pilot scope is enforced again by validate and finalize without side effects", async () => {
    const prepared = await prepareRelease(db);
    const begin = await beginImport(db, prepared.release.id, 1, prepared.fixture);
    await stagePackage(db, begin, prepared.fixture);
    await sealImport(db, begin);
    const baseline = await operationalCounts(db);
    await withOwnerTransaction(db, async () => {
      await db.exec("alter table public.mapping_release_area disable trigger user");
      await db.query("insert into public.mapping_release_area(release_id,site_id,area_id) values($1,1,2)", [prepared.release.id]);
      await assert.rejects(db.query(
        "select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid)",
        [begin.importId, begin.rootRequestId, randomUUID()],
      ), /pilot|scope|area/i);
    });
    assert.deepEqual(await operationalCounts(db), baseline);
  });

  await t.test("finalization rejects stale or unacknowledged reports and never creates publication", async () => {
    const prepared = await prepareRelease(db);
    const begin = await beginImport(db, prepared.release.id, 1, prepared.fixture);
    await stagePackage(db, begin, prepared.fixture);
    await sealImport(db, begin);
    const validation = (await db.query(
      "select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid) result",
      [begin.importId, begin.rootRequestId, randomUUID()],
    )).rows[0].result;
    await assert.rejects(db.query(
      "select public.staff_finalize_mapping_import($1::uuid,2,$2,$3::jsonb,$4::uuid,$5::uuid)",
      [begin.importId, "f".repeat(64), "{}", begin.rootRequestId, randomUUID()],
    ), /report|digest|validated|state/i);
    assert.equal((await operationalCounts(db)).publications, 0);
    assert.ok(["invalid", "validated"].includes(validation.state));
  });

  await t.test("successful initial finalization installs one reviewed snapshot and exact retry is duplicate-free", async () => {
    const prepared = await prepareFinalizableRelease(db);
    const begin = await beginImport(db, prepared.release.id, 1, prepared.fixture);
    await stagePackage(db, begin, prepared.fixture);
    await sealImport(db, begin);
    const validationOperation = randomUUID();
    const validation = (await db.query(
      "select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid) result",
      [begin.importId, begin.rootRequestId, validationOperation],
    )).rows[0].result;
    const validationStatus = (await db.query("select public.staff_mapping_import_status($1::uuid,1,200) result", [begin.importId])).rows[0].result;
    assert.equal(validation.state, "validated", JSON.stringify(validationStatus.report));
    const finalizeOperation = randomUUID();
    const args = [begin.importId, validation.reportDigest, JSON.stringify(finalizationAcknowledgements(prepared.fixture)), begin.rootRequestId, finalizeOperation];
    await assert.rejects(db.query(
      "select public.staff_finalize_mapping_import($1::uuid,2,$2,$3::jsonb,$4::uuid,$5::uuid)",
      [begin.importId, validation.reportDigest, JSON.stringify({ warnings: [], reviewed_layer_hashes: {} }), begin.rootRequestId, randomUUID()],
    ), /layer acknowledgement|exact hash/i);
    await assert.rejects(db.query(
      "select public.staff_finalize_mapping_import($1::uuid,2,$2,$3::jsonb,$4::uuid,$5::uuid)",
      [begin.importId, validation.reportDigest, JSON.stringify({ ...finalizationAcknowledgements(prepared.fixture), warnings: ["invented:*"] }), begin.rootRequestId, randomUUID()],
    ), /unknown warning acknowledgement/i);
    const finalized = (await db.query(
      "select public.staff_finalize_mapping_import($1::uuid,2,$2,$3::jsonb,$4::uuid,$5::uuid) result", args,
    )).rows[0].result;
    assert.equal(finalized.state, "finalized");
    const snapshot = await operationalCounts(db);
    assert.deepEqual(snapshot, { mapping_boundary: 2, plot_geometry: 1, mapping_walkway_source: 1,
      grave_access_point: 1, mapping_display_feature: 0, release_nodes: 2, release_edges: 1, publications: 0 });
    assert.deepEqual((await db.query("select status,revision from public.mapping_release where release_id=$1", [prepared.release.id])).rows[0], { status: "validated", revision: 3 });
    assert.equal((await db.query("select state from public.mapping_import where import_id=$1", [begin.importId])).rows[0].state, "finalized");
    assert.deepEqual((await db.query(
      "select public.staff_finalize_mapping_import($1::uuid,2,$2,$3::jsonb,$4::uuid,$5::uuid) result", args,
    )).rows[0].result, finalized);
    assert.deepEqual(await operationalCounts(db), snapshot);
    assert.equal((await db.query("select count(*)::int n from public.mapping_publication where release_id=$1", [prepared.release.id])).rows[0].n, 0);
  });

  await t.test("same bytes revalidate only after a live lot dependency correction with a new operation", async () => {
    const prepared = await prepareFinalizableRelease(db);
    prepared.fixture = finalizablePackageFixture(prepared.values.release_code, "2");
    const begin = await beginImport(db, prepared.release.id, 1, prepared.fixture);
    await stagePackage(db, begin, prepared.fixture);
    await sealImport(db, begin);
    const operationalBefore = await operationalCounts(db);
    const before = (await db.query(`select request_id,release_id,site_id,area_id,package_digest,manifest_sha256,
      base_revision,target_revision from public.mapping_import where import_id=$1`, [begin.importId])).rows[0];
    const chunkHashes = (await db.query("select file_name,chunk_index,chunk_sha256 from public.mapping_import_chunk where import_id=$1 order by file_name,chunk_index", [begin.importId])).rows;
    const oldOperation = randomUUID();
    const failed = (await db.query("select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid) result",
      [begin.importId, begin.rootRequestId, oldOperation])).rows[0].result;
    assert.equal(failed.state, "invalid");
    assert.deepEqual((await db.query("select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid) result",
      [begin.importId, begin.rootRequestId, oldOperation])).rows[0].result, failed);

    const stillBlockedOperation = randomUUID();
    const stillBlocked = (await db.query("select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid) result",
      [begin.importId, begin.rootRequestId, stillBlockedOperation])).rows[0].result;
    assert.equal(stillBlocked.state, "invalid");
    assert.deepEqual((await db.query("select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid) result",
      [begin.importId, begin.rootRequestId, stillBlockedOperation])).rows[0].result, stillBlocked);

    await gisLogin(db, gisActors.admin, "postgres");
    await db.exec("insert into public.lot(lot_id,block_id,lot_code,legacy_location_code,area_id) values(2,1,'LOT-2','LEGACY-2',1)");
    await gisLogin(db);
    const newOperation = randomUUID();
    const validated = (await db.query("select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid) result",
      [begin.importId, begin.rootRequestId, newOperation])).rows[0].result;
    assert.equal(validated.state, "validated");
    assert.deepEqual((await db.query("select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid) result",
      [begin.importId, begin.rootRequestId, newOperation])).rows[0].result, validated);
    assert.notEqual(validated.reportId, failed.reportId);
    assert.deepEqual((await db.query(`select request_id,release_id,site_id,area_id,package_digest,manifest_sha256,
      base_revision,target_revision from public.mapping_import where import_id=$1`, [begin.importId])).rows[0], before);
    assert.deepEqual((await db.query("select file_name,chunk_index,chunk_sha256 from public.mapping_import_chunk where import_id=$1 order by file_name,chunk_index", [begin.importId])).rows, chunkHashes);
    assert.deepEqual(await operationalCounts(db), operationalBefore);
  });

  await t.test("seven replacement cases retain old children on restage/failure and install one corrected snapshot atomically", async () => {
    const prepared = await prepareFinalizableRelease(db);
    await gisLogin(db, gisActors.admin, "postgres");
    await db.query("insert into public.map_node(site_id,node_name,node_type) values(1,'Legacy NULL release node','junction')");
    await gisLogin(db);
    const first = await beginImport(db, prepared.release.id, 1, prepared.fixture);
    await stagePackage(db, first, prepared.fixture); await sealImport(db, first);
    const firstValidation = (await db.query("select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid) result",
      [first.importId, first.rootRequestId, randomUUID()])).rows[0].result;
    const firstFinalized = (await db.query("select public.staff_finalize_mapping_import($1::uuid,2,$2,$3::jsonb,$4::uuid,$5::uuid) result",
      [first.importId, firstValidation.reportDigest, JSON.stringify(finalizationAcknowledgements(prepared.fixture)), first.rootRequestId, randomUUID()])).rows[0].result;
    assert.equal(firstFinalized.state, "finalized", "initial finalization");
    const original = await releaseSnapshot(db, prepared.release.id);

    const other = await prepareFinalizableRelease(db);
    const otherImport = await beginImport(db, other.release.id, 1, other.fixture);
    await stagePackage(db, otherImport, other.fixture); await sealImport(db, otherImport);
    const otherValidation = (await db.query("select public.staff_validate_mapping_import($1::uuid,2,$2::uuid,$3::uuid) result",
      [otherImport.importId, otherImport.rootRequestId, randomUUID()])).rows[0].result;
    const otherFinalized = (await db.query("select public.staff_finalize_mapping_import($1::uuid,2,$2,$3::jsonb,$4::uuid,$5::uuid) result",
      [otherImport.importId, otherValidation.reportDigest, JSON.stringify(finalizationAcknowledgements(other.fixture)), otherImport.rootRequestId, randomUUID()])).rows[0].result;
    assert.equal(otherFinalized.state, "finalized");
    const otherSnapshot = await releaseSnapshot(db, other.release.id);

    const corrected = finalizablePackageFixture(prepared.values.release_code);
    replaceFixtureFile(corrected, "grave_plots.geojson", featureCollection([{ type: "Feature",
      geometry: { type: "Polygon", coordinates: [[[123.0101, 13.0101], [123.0111, 13.0101], [123.0111, 13.0111], [123.0101, 13.0111], [123.0101, 13.0101]]] },
      properties: prepared.fixture.data["grave_plots.geojson"].features[0].properties }]));
    const second = await beginImport(db, prepared.release.id, 3, corrected);
    await stagePackage(db, second, corrected); await sealImport(db, second, 3);
    assert.deepEqual((await db.query("select status,revision from public.mapping_release where release_id=$1", [prepared.release.id])).rows[0], { status: "staged", revision: 4 });
    assert.deepEqual(await releaseSnapshot(db, prepared.release.id), original, "validated -> staged retains old children");
    const secondValidation = (await db.query("select public.staff_validate_mapping_import($1::uuid,4,$2::uuid,$3::uuid) result",
      [second.importId, second.rootRequestId, randomUUID()])).rows[0].result;
    assert.equal(secondValidation.state, "validated");

    await gisLogin(db, gisActors.admin, "postgres");
    await db.exec(`create function public.task10_fail_audit() returns trigger language plpgsql as $$begin raise exception 'injected late audit failure'; end$$;
      create trigger task10_fail_audit before insert on public.audit_log for each row execute function public.task10_fail_audit();`);
    await gisLogin(db);
    const failedOperation = randomUUID();
    const failed = (await db.query("select public.staff_finalize_mapping_import($1::uuid,4,$2,$3::jsonb,$4::uuid,$5::uuid) result",
      [second.importId, secondValidation.reportDigest, JSON.stringify(finalizationAcknowledgements(corrected)), second.rootRequestId, failedOperation])).rows[0].result;
    assert.equal(failed.state, "validated", "pure execution failure keeps import validated");
    assert.deepEqual(await releaseSnapshot(db, prepared.release.id), original, "old IDs/geometries/counts survive halfway replacement failure");
    assert.deepEqual(await releaseSnapshot(db, other.release.id), otherSnapshot, "other release survives halfway replacement failure");
    assert.equal((await db.query("select failure_classification from public.mapping_import_report where report_id=$1", [failed.reportId])).rows[0].failure_classification, "execution");
    assert.deepEqual((await db.query("select public.staff_finalize_mapping_import($1::uuid,4,$2,$3::jsonb,$4::uuid,$5::uuid) result",
      [second.importId, secondValidation.reportDigest, JSON.stringify(finalizationAcknowledgements(corrected)), second.rootRequestId, failedOperation])).rows[0].result, failed);
    await gisLogin(db, gisActors.admin, "postgres");
    await db.exec("drop trigger task10_fail_audit on public.audit_log; drop function public.task10_fail_audit()");
    await gisLogin(db);

    const replaced = (await db.query("select public.staff_finalize_mapping_import($1::uuid,4,$2,$3::jsonb,$4::uuid,$5::uuid) result",
      [second.importId, secondValidation.reportDigest, JSON.stringify(finalizationAcknowledgements(corrected)), second.rootRequestId, randomUUID()])).rows[0].result;
    assert.equal(replaced.state, "finalized", "successful replacement");
    const after = await releaseSnapshot(db, prepared.release.id);
    assert.notDeepEqual(after.plots, original.plots);
    assert.deepEqual(await releaseSnapshot(db, other.release.id), otherSnapshot, "other release is never replaced");
    const sourceKeys = Object.entries(after).flatMap(([layer, values]) => values.map((row) => `${layer}:${row.source_feature_id}`));
    assert.equal(new Set(sourceKeys).size, sourceKeys.length, "no duplicate layer/source identities");
    assert.equal((await db.query("select count(*)::int n from public.plot_geometry where mapping_release_id=$1 and lot_id=1", [prepared.release.id])).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int n from public.grave_access_point where mapping_release_id=$1 and lot_id=1", [prepared.release.id])).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int n from public.map_node where mapping_release_id is null and node_name='Legacy NULL release node'")).rows[0].n, 1);
    assert.equal((await db.query("select count(*)::int n from public.mapping_publication where release_id=$1", [prepared.release.id])).rows[0].n, 0);

    for (const frozenStatus of ["approved", "published", "superseded", "rejected"]) {
      await withOwnerTransaction(db, async () => {
        await db.exec("alter table public.mapping_release disable trigger mapping_release_guard; alter table public.mapping_import disable trigger mapping_import_guard");
        await db.query("update public.mapping_release set status=$2,revision=4 where release_id=$1", [prepared.release.id, frozenStatus]);
        await db.query("update public.mapping_import set state='validated',revision=20 where import_id=$1", [second.importId]);
        await db.exec("alter table public.mapping_release enable trigger mapping_release_guard; alter table public.mapping_import enable trigger mapping_import_guard");
        await gisLogin(db);
        await assert.rejects(db.query("select public.staff_finalize_mapping_import($1::uuid,4,$2,$3::jsonb,$4::uuid,$5::uuid)",
          [second.importId, secondValidation.reportDigest, JSON.stringify(finalizationAcknowledgements(corrected)), second.rootRequestId, randomUUID()]), /staged|frozen|replace|validated/i);
      });
    }
    await gisLogin(db);
  });

  await t.test("manager, inactive, anonymous, direct helper and spoofed context are denied", async () => {
    for (const [actor, role] of [[gisActors.manager, "authenticated"], [gisActors.inactive, "authenticated"], [null, "anon"]]) {
      await gisLogin(db, actor, role);
      await assert.rejects(db.query(
        "select public.staff_validate_mapping_import($1::uuid,1,$2::uuid,$3::uuid)",
        [randomUUID(), randomUUID(), randomUUID()],
      ), /administrator|permission/i);
      await assert.rejects(db.query("select gis_private.validate_import($1::uuid)", [randomUUID()]), /permission denied|schema/i);
    }
    await gisLogin(db);
  });
});

test("Task 10 import CLI uses only normal session auth, redacted resumable state, and bounded transient retries", async (t) => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: "https://fictional-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fictional-publishable-key",
    GRAVENAV_GIS_ACCESS_TOKEN: "fictional-normal-user-jwt",
  };

  await t.test("RPC client retries transient failures without logging or returning credentials", async () => {
    const requests = [];
    const fetchImpl = async (url, options) => {
      requests.push({ url, options });
      if (requests.length === 1) return new Response(JSON.stringify({ message: "temporary" }), { status: 503 });
      return new Response(JSON.stringify({ state: "validated", reportDigest: "a".repeat(64) }), { status: 200 });
    };
    const client = createImportClient({ env, fetchImpl, maxAttempts: 3 });
    const result = await client.validate({ p_import_id: randomUUID() });
    assert.equal(result.state, "validated");
    assert.equal(requests.length, 2);
    assert.equal(requests.every((request) => request.options.headers.Authorization === `Bearer ${env.GRAVENAV_GIS_ACCESS_TOKEN}`), true);
    assert.equal(JSON.stringify(result).includes(env.GRAVENAV_GIS_ACCESS_TOKEN), false);
  });

  await t.test("resume file accepts only UUID/digest/chunk receipt metadata", async () => {
    const directory = await mkdtemp(join(tmpdir(), "gravenav-gis-resume-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const path = join(directory, "resume.json");
    const state = { schemaVersion: 1, rootRequestId: randomUUID(), importId: randomUUID(), releaseId: randomUUID(),
      packageDigest: "b".repeat(64), baseRevision: 1, targetRevision: 2, chunks: { "route_nodes.geojson": [0, 1] } };
    await writeResumeState(path, state);
    assert.deepEqual(await readResumeState(path), state);
    const text = await readFile(path, "utf8");
    assert.equal(/token|jwt|secret|raw_bytes|bytes_base64/i.test(text), false);
    await assert.rejects(writeResumeState(path, { ...state, access_token: "forbidden" }), /invalid|forbidden/i);
  });

  await t.test("CLI supports only stage/resume/validate/finalize/status and has no publish or command-line token", async () => {
    const source = await readFile(new URL("../scripts/import-gis-package.mjs", import.meta.url), "utf8");
    assert.match(source, /stage.*resume.*validate.*finalize.*status/);
    assert.doesNotMatch(source, /["']publish["']/);
    await assert.rejects(runImportCli(["publish"], { env, fetchImpl: async () => new Response("{}", { status: 200 }) }), /usage/i);
    await assert.rejects(runImportCli(["status", "--resume-file", "missing.json", "--token", "forbidden"], { env }), /usage/i);
  });
});
