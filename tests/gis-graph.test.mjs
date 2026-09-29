import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createTestDatabase } from "./database-helper.mjs";
import {
  createRelease,
  gisActors,
  gisLogin,
  releaseValues,
  seedGisFixtures,
} from "./gis-fixtures.mjs";

const HASH = "a".repeat(64);
const START = "2026-09-28T03:00:00Z";
const END = "2026-09-28T03:05:00Z";
const cemeteryPolygon = "POLYGON((123 13,123.02 13,123.02 13.02,123 13.02,123 13))";
const areaPolygon = "POLYGON((123.001 13.001,123.019 13.001,123.019 13.019,123.001 13.019,123.001 13.001))";
const plotPolygon = "POLYGON((123.0098 13.0092,123.0102 13.0092,123.0102 13.0096,123.0098 13.0096,123.0098 13.0092))";
const mainWalkway = "LINESTRING(123.001 13.01,123.019 13.01)";

async function ownerOperation(db, callback, operation = "staff_finalize_mapping_import") {
  await gisLogin(db, gisActors.admin, "postgres");
  await db.exec("begin");
  const requestId = randomUUID();
  try {
    await db.query(`insert into gis_private.gis_mutation_request
      (request_id,actor_account_id,operation,input_hash)
      values($1,$2,$3,$4)`, [requestId, gisActors.admin, operation, HASH]);
    const result = await callback();
    await db.query("delete from gis_private.gis_mutation_request where request_id=$1", [requestId]);
    await db.exec("commit");
    return result;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  } finally {
    await gisLogin(db);
  }
}

async function acceptedRun(db, releaseId, siteId = "1") {
  const point = (await db.query(
    "select public.staff_save_survey_point(null,null,$1::jsonb,$2::uuid) result",
    [JSON.stringify({ site_id: siteId, point_code: `graph-${randomUUID()}`, role: "VALIDATION" }), randomUUID()],
  )).rows[0].result;
  const observations = Array.from({ length: 5 }, (_, index) => ({
    observation_order: index + 1,
    latitude: 13.01,
    longitude: 123.01,
    reported_accuracy_m: 1,
    captured_at: new Date(Date.parse(START) + index * 30_000).toISOString(),
  }));
  const capture = (await db.query(
    "select public.staff_record_survey_capture($1::uuid,$2,$3::jsonb,$4::jsonb,$5::uuid) result",
    [point.id, `graph-${randomUUID()}`, JSON.stringify({ started_at: START, ended_at: END }), JSON.stringify(observations), randomUUID()],
  )).rows[0].result;
  await db.query(
    "select public.staff_review_survey_capture($1::uuid,1,'accepted','[]'::jsonb,null,$2::uuid)",
    [capture.id, randomUUID()],
  );
  const run = (await db.query(
    "select public.staff_save_georeferencing_run(null,null,$1::jsonb,$2::jsonb,$3::jsonb,$4::uuid) result",
    [JSON.stringify({
      release_id: releaseId,
      run_code: `graph-${randomUUID()}`,
      source_reference: "synthetic/plan.png",
      source_hash: "b".repeat(64),
      source_width: 1000,
      source_height: 1000,
      source_coordinate_space: "pixel coordinates",
      working_srid: 32651,
      output_srid: 4326,
      method: "polynomial-1",
      processing_parameters: { expected_validation_count: 1 },
      processed_at: "2026-09-28T04:00:00Z",
      qgis_version: "3.40",
      output_artifact_reference: "synthetic/georeferenced.tif",
      output_artifact_hash: "c".repeat(64),
    }), JSON.stringify([{
      point_id: point.id, capture_id: capture.id, role: "VALIDATION", source_x: 10, source_y: 10,
    }]), JSON.stringify([{
      point_id: point.id, transformed_longitude: 123.01003, transformed_latitude: 13.01004, review_state: "reviewed",
    }]), randomUUID()],
  )).rows[0].result;
  await db.query(
    "select public.staff_review_georeferencing_run($1::uuid,1,'accepted',$2::jsonb,null,$3::uuid)",
    [run.id, JSON.stringify(["fitting_count_below_target", "validation_count_below_target"]), randomUUID()],
  );
  await ownerOperation(db, async () => {
    await db.query(`update public.mapping_release set status='staged',revision=revision+1,
      staged_at=transaction_timestamp(),staged_by=$2 where release_id=$1`, [releaseId, gisActors.admin]);
  }, "staff_seal_mapping_import");
  return run.id;
}

function provenance(releaseId, runId, sourceFeatureId) {
  return [releaseId, "1", runId, sourceFeatureId, HASH, "synthetic-layer", "v1", gisActors.admin];
}

async function seedGeometry(db, releaseId, runId) {
  await gisLogin(db, gisActors.admin, "postgres");
  await db.query("insert into public.lot(lot_id,area_id,lot_code,status) values(7001,1,'GRAPH-01','AVAILABLE')");
  return ownerOperation(db, async () => {
    await db.query(`insert into public.mapping_boundary(
      mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
      created_by,kind,boundary_geom,review_state,reviewed_at,reviewed_by)
      values($1,$2,$3,$4,$5,$6,$7,$8,'cemetery',extensions.st_geomfromtext($9,4326),
        'approved',transaction_timestamp(),$8)`,
    [...provenance(releaseId, runId, "cemetery"), cemeteryPolygon]);
    await db.query(`insert into public.mapping_boundary(
      mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
      created_by,kind,area_id,boundary_geom,review_state,reviewed_at,reviewed_by)
      values($1,$2,$3,$4,$5,$6,$7,$8,'area',1,extensions.st_geomfromtext($9,4326),
        'approved',transaction_timestamp(),$8)`,
    [...provenance(releaseId, runId, "area"), areaPolygon]);
    await db.query(`insert into public.plot_geometry(
      mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
      created_by,lot_id,area_id,plot_geom,review_state,reviewed_at,reviewed_by)
      values($1,$2,$3,$4,$5,$6,$7,$8,7001,1,extensions.st_geomfromtext($9,4326),
        'approved',transaction_timestamp(),$8)`,
    [...provenance(releaseId, runId, "plot"), plotPolygon]);
    return (await db.query(`insert into public.mapping_walkway_source(
      mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
      created_by,area_id,walkway_type,walking_allowed,centerline_geom,review_state,reviewed_at,reviewed_by)
      values($1,$2,$3,$4,$5,$6,$7,$8,1,'path',true,extensions.st_geomfromtext($9,4326),
        'approved',transaction_timestamp(),$8)
      returning walkway_source_id`, [...provenance(releaseId, runId, "walkway"), mainWalkway])).rows[0].walkway_source_id;
  });
}

async function insertWalkway(db, releaseId, runId, sourceFeatureId, wkt, overrides = {}) {
  const reviewState = overrides.reviewState ?? "approved";
  return (await db.query(`insert into public.mapping_walkway_source(
    mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
    created_by,area_id,walkway_type,walking_allowed,centerline_geom,review_state,reviewed_at,reviewed_by)
    values($1,1,$2,$3,$4,'synthetic-layer','v1',$5,1,'path',$6,extensions.st_geomfromtext($7,4326),$8,
      case when $8='pending' then null else transaction_timestamp() end,
      case when $8='pending' then null else $5::uuid end) returning walkway_source_id`,
  [releaseId, runId, sourceFeatureId, HASH, gisActors.admin, overrides.walkingAllowed ?? true, wkt, reviewState])).rows[0].walkway_source_id;
}

function nodeArgs(releaseId, sourceFeatureId, longitude, latitude, overrides = {}) {
  return {
    releaseId, siteId: "1", sourceFeatureId, longitude, latitude,
    nodeName: sourceFeatureId, nodeType: "junction", artifactHash: HASH,
    layerName: "synthetic-nodes", layerVersion: "v1", reviewState: "approved", ...overrides,
  };
}

async function insertNode(db, values) {
  return (await db.query(`insert into public.map_node(
    site_id,node_name,node_type,location_geom,mapping_release_id,source_feature_id,artifact_hash,
    layer_name,layer_version,review_state,revision,imported_at,review_notes,reviewed_at,reviewed_by)
    values($2,$5,$6,extensions.st_setsrid(extensions.st_makepoint($3,$4),4326)::extensions.geography,
      $1,$7,$8,$9,$10,$11,1,transaction_timestamp(),$12,
      case when $11='pending' then null else transaction_timestamp() end,
      case when $11='pending' then null else $13::uuid end) returning node_id`, [
    values.releaseId, values.siteId, values.longitude, values.latitude, values.nodeName, values.nodeType,
    values.sourceFeatureId, values.artifactHash, values.layerName, values.layerVersion,
    values.reviewState, values.reviewNotes ?? "PRIVATE_NODE_NOTE", gisActors.admin,
  ])).rows[0].node_id;
}

async function insertEdge(db, values) {
  return (await db.query(`insert into public.map_edge(
    from_node_id,to_node_id,path_geom,distance_m,edge_type,is_restricted,mapping_release_id,site_id,
    source_feature_id,artifact_hash,layer_name,layer_version,review_state,revision,imported_at,
    source_walkway_id,walking_allowed,direction,forward_cost_m,reverse_cost_m,review_notes,reviewed_at,reviewed_by)
    values($1,$2,extensions.st_geomfromtext($3,4326)::extensions.geography,999,'path',$4,$5,$6,
      $7,$8,$9,$10,$15,1,transaction_timestamp(),$11,$12,$13,999,999,$14,
      case when $15='pending' then null else transaction_timestamp() end,
      case when $15='pending' then null else $16::uuid end) returning *`, [
    values.from, values.to, values.wkt, values.restricted ?? false, values.releaseId, values.siteId ?? "1",
    values.sourceFeatureId, HASH, "synthetic-edges", "v1", values.walkwayId,
    values.walkingAllowed ?? true, values.direction ?? "both", values.reviewNotes ?? "PRIVATE_EDGE_NOTE",
    values.reviewState ?? "approved", gisActors.admin,
  ])).rows[0];
}

async function insertAccess(db, values) {
  return (await db.query(`insert into public.grave_access_point(
    mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
    created_by,lot_id,area_id,node_id,access_point_geom,review_state,reviewed_at,reviewed_by)
    values($1,1,$2,$3,$4,'synthetic-access','v1',$5,7001,1,$6,
      extensions.st_setsrid(extensions.st_makepoint($7,$8),4326),$9,
      case when $9='pending' then null else transaction_timestamp() end,
      case when $9='pending' then null else $5::uuid end) returning access_point_id`, [
    values.releaseId, values.runId, values.sourceFeatureId, HASH, gisActors.admin,
    values.nodeId, values.longitude, values.latitude, values.reviewState ?? "approved",
  ])).rows[0].access_point_id;
}

async function graphDigest(db) {
  return (await db.query(`select
    md5(coalesce((select jsonb_agg(to_jsonb(n) order by node_id)::text from public.map_node n
      where mapping_release_id is null),'[]')) node_hash,
    md5(coalesce((select jsonb_agg(to_jsonb(e) order by edge_id)::text from public.map_edge e
      where mapping_release_id is null),'[]')) edge_hash`)).rows[0];
}

test("M05 migrates existing legacy graph rows without backfill or behavior drift", async () => {
  const db = await createTestDatabase({ throughMigration: "20260928190000_gis_versioned_geometry.sql" });
  try {
    await seedGisFixtures(db);
    await gisLogin(db, gisActors.admin, "postgres");
    await db.exec(`insert into public.map_node(node_id,site_id,node_name,node_type,px_loc_x,px_loc_y,location_geom)
      values(8101,1,'Pre-M05 entrance','entrance',10,20,
        extensions.st_geomfromtext('POINT(123.001 13.01)',4326)::extensions.geography),
        (8102,1,'Pre-M05 junction','junction',30,40,
        extensions.st_geomfromtext('POINT(123.002 13.01)',4326)::extensions.geography);
      insert into public.map_edge(edge_id,from_node_id,to_node_id,path_geom,distance_m,edge_type,is_restricted)
      values(8201,8101,8102,extensions.st_geomfromtext('LINESTRING(123.001 13.01,123.002 13.01)',4326)::extensions.geography,
        108.4,'path',false);`);
    const before = (await db.query(`select
      (select jsonb_agg(jsonb_build_object('node_id',node_id,'site_id',site_id,'node_name',node_name,
        'node_type',node_type,'px_loc_x',px_loc_x,'px_loc_y',px_loc_y,'location_geom',location_geom::text) order by node_id)
        from public.map_node where node_id in (8101,8102)) nodes,
      (select jsonb_agg(jsonb_build_object('edge_id',edge_id,'from_node_id',from_node_id,'to_node_id',to_node_id,
        'path_geom',path_geom::text,'distance_m',distance_m,'edge_type',edge_type,'is_restricted',is_restricted) order by edge_id)
        from public.map_edge where edge_id=8201) edges`)).rows[0];
    await db.exec(await readFile(new URL("../supabase/migrations/20260928200000_gis_graph_access.sql", import.meta.url), "utf8"));
    const after = (await db.query(`select
      (select jsonb_agg(jsonb_build_object('node_id',node_id,'site_id',site_id,'node_name',node_name,
        'node_type',node_type,'px_loc_x',px_loc_x,'px_loc_y',px_loc_y,'location_geom',location_geom::text) order by node_id)
        from public.map_node where node_id in (8101,8102)) nodes,
      (select jsonb_agg(jsonb_build_object('edge_id',edge_id,'from_node_id',from_node_id,'to_node_id',to_node_id,
        'path_geom',path_geom::text,'distance_m',distance_m,'edge_type',edge_type,'is_restricted',is_restricted) order by edge_id)
        from public.map_edge where edge_id=8201) edges`)).rows[0];
    assert.deepEqual(after, before);
    assert.equal((await db.query(`select count(*)::int n from public.map_node where node_id in (8101,8102)
      and mapping_release_id is null and source_feature_id is null and review_state is null`)).rows[0].n, 2);
    assert.equal((await db.query(`select count(*)::int n from public.map_edge where edge_id=8201
      and mapping_release_id is null and site_id is null and source_walkway_id is null and direction is null`)).rows[0].n, 1);
    await gisLogin(db, gisActors.manager);
    await db.query("update public.map_node set node_name='Legacy update remains allowed' where node_id=8102");
    await db.query("insert into public.map_node(site_id,node_name,node_type) values(1,'','junction')");
    assert.equal((await db.query("select node_name from public.map_node where node_id=8102")).rows[0].node_name,
      "Legacy update remains allowed");
  } finally {
    await db.close();
  }
});

test("M05 release-safe graph, grave access, display, and legacy audit containment", async (t) => {
  const db = await createTestDatabase();
  try {
    await seedGisFixtures(db);
    await gisLogin(db, gisActors.admin, "postgres");

    await t.test("M05 tables, release columns, helpers, constraints, and indexes exist", async () => {
      for (const table of ["grave_access_point", "mapping_display_feature"])
        assert.equal((await db.query("select to_regclass($1) name", [`public.${table}`])).rows[0].name, table);
      for (const column of ["mapping_release_id", "source_feature_id", "review_state"])
        assert.equal((await db.query(`select exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='map_node' and column_name=$1) ok`, [column])).rows[0].ok, true);
      for (const column of ["mapping_release_id", "site_id", "source_walkway_id", "direction", "forward_cost_m", "reverse_cost_m"])
        assert.equal((await db.query(`select exists(select 1 from information_schema.columns
          where table_schema='public' and table_name='map_edge' and column_name=$1) ok`, [column])).rows[0].ok, true);
      for (const fn of ["validate_graph(uuid)", "reachable_nodes(uuid)", "guard_release_graph()", "guard_access_point()"])
        assert.notEqual((await db.query("select to_regprocedure($1) name", [`gis_private.${fn}`])).rows[0].name, null);
      const constraints = (await db.query(`select conname from pg_constraint where conname=any($1::text[])`, [[
        "map_node_release_site_fkey", "map_node_release_profile_check",
        "map_edge_from_release_node_fkey", "map_edge_to_release_node_fkey", "map_edge_source_walkway_fkey",
        "map_edge_release_profile_check", "grave_access_point_plot_fkey", "grave_access_point_node_fkey",
        "mapping_display_feature_node_fkey",
      ]])).rows.map(row => row.conname).sort();
      assert.equal(constraints.length, 9);
      const indexes = (await db.query(`select indexrelid::regclass::text name from pg_index
        where indexrelid::regclass::text=any($1::text[])`, [[
        "map_node_release_source_key", "map_edge_release_source_key", "map_edge_release_from_idx",
        "map_edge_release_to_idx", "grave_access_point_geom_gist", "mapping_display_feature_geom_gist",
      ]])).rows.map(row => row.name).sort();
      assert.equal(indexes.length, 6);
      const triggers = (await db.query(`select tgname from pg_trigger where not tgisinternal and tgname=any($1::text[])`, [[
        "map_node_release_guard", "map_edge_release_guard", "grave_access_point_10_release_guard",
        "grave_access_point_20_identity_guard", "mapping_display_feature_release_guard",
      ]])).rows.map(row => row.tgname).sort();
      assert.equal(triggers.length, 5);
      for (const table of ["map_node", "map_edge", "grave_access_point", "mapping_display_feature"])
        assert.equal((await db.query(`select relrowsecurity ok from pg_class
          where oid=$1::regclass`, [`public.${table}`])).rows[0].ok, true);
      const helpers = (await db.query(`select p.proname,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) source
        from pg_proc p where p.pronamespace='gis_private'::regnamespace
          and p.proname in ('validate_graph','reachable_nodes','guard_release_graph','guard_access_point')`)).rows;
      assert.equal(helpers.length, 4);
      for (const helper of helpers) {
        assert.equal(helper.prosecdef, false);
        assert.deepEqual(helper.proconfig, ["search_path=pg_catalog, extensions, pg_temp"]);
      }
      const reachabilitySource = helpers.find(helper => helper.proname === "reachable_nodes").source;
      assert.match(reachabilitySource, /with recursive/i);
      assert.match(reachabilitySource, /union\s+select d\.dst/i);
      assert.equal((await db.query(`select count(*)::int n from pg_policies
        where schemaname='public' and tablename in ('map_node','map_edge') and cmd='ALL'`)).rows[0].n, 0);
    });

    await db.exec(`insert into public.map_node(site_id,node_name,node_type,location_geom)
      values(1,'Legacy entrance','entrance',extensions.st_geomfromtext('POINT(123.001 13.01)',4326)::extensions.geography),
            (1,'Legacy junction','junction',extensions.st_geomfromtext('POINT(123.002 13.01)',4326)::extensions.geography);
      insert into public.map_edge(from_node_id,to_node_id,path_geom,distance_m,edge_type)
      values(1,2,extensions.st_geomfromtext('LINESTRING(123.001 13.01,123.002 13.01)',4326)::extensions.geography,100,'path');`);
    const legacyBaseline = await graphDigest(db);
    const release = await createRelease(db);
    const runId = await acceptedRun(db, release.id);
    const walkwayId = await seedGeometry(db, release.id, runId);
    const secondRelease = await createRelease(db, releaseValues({ release_code: `graph-other-${randomUUID()}` }));

    let entrance;
    let junction;
    let isolated;
    await ownerOperation(db, async () => {
      entrance = await insertNode(db, nodeArgs(release.id, "entrance", 123.001, 13.01, { nodeType: "entrance" }));
      junction = await insertNode(db, nodeArgs(release.id, "junction", 123.01, 13.01));
      isolated = await insertNode(db, nodeArgs(release.id, "isolated", 123.015, 13.01));
      const edge = await insertEdge(db, {
        from: entrance, to: junction, wkt: "LINESTRING(123.001 13.01,123.01 13.01)",
        releaseId: release.id, sourceFeatureId: "edge-main", walkwayId, direction: "forward",
      });
      assert.ok(edge.distance_m > 0);
      assert.equal(edge.forward_cost_m, edge.distance_m);
      assert.equal(edge.reverse_cost_m, null);
    });

    await t.test("legacy rows stay NULL-release with unchanged behavior and no membership upgrade or downgrade", async () => {
      assert.deepEqual(await graphDigest(db), legacyBaseline);
      assert.equal((await db.query(`select count(*)::int n from public.map_node
        where node_id in (1,2) and mapping_release_id is null`)).rows[0].n, 2);
      assert.equal((await db.query(`select count(*)::int n from public.map_edge
        where edge_id=1 and mapping_release_id is null and site_id is null`)).rows[0].n, 1);
      await gisLogin(db, gisActors.manager);
      await db.exec("begin");
      await db.query("update public.map_node set node_name='Legacy entrance retained' where node_id=1");
      await assert.rejects(db.query("update public.map_node set mapping_release_id=$1 where node_id=1", [release.id]), /membership|release|protected|policy/i);
      await db.exec("rollback");
      await gisLogin(db, gisActors.admin, "postgres");
      await assert.rejects(db.query("update public.map_node set mapping_release_id=null where node_id=$1", [entrance]), /membership|release|protected/i);
    });

    await t.test("cross-site, cross-release, NULL-bypass, exact endpoints, bad lines, and wrong lineage are rejected", async () => {
      await ownerOperation(db, async () => {
        const cases = [
          ["cross-release", { from: entrance, to: junction, wkt: "LINESTRING(123.001 13.01,123.01 13.01)", releaseId: secondRelease.id, sourceFeatureId: "bad-release", walkwayId }, /release|scope|foreign key/i],
          ["cross-site", { from: entrance, to: junction, wkt: "LINESTRING(123.001 13.01,123.01 13.01)", releaseId: release.id, siteId: "2", sourceFeatureId: "bad-site", walkwayId }, /site|scope|foreign key/i],
          ["wrong-end", { from: entrance, to: junction, wkt: "LINESTRING(123.0011 13.01,123.01 13.01)", releaseId: release.id, sourceFeatureId: "bad-end", walkwayId }, /endpoint/i],
          ["wrong-lineage", { from: entrance, to: junction, wkt: "LINESTRING(123.001 13.01,123.005 13.011,123.01 13.01)", releaseId: release.id, sourceFeatureId: "bad-lineage", walkwayId }, /walkway|lineage|covered/i],
          ["zero", { from: entrance, to: junction, wkt: "LINESTRING(123.001 13.01,123.001 13.01)", releaseId: release.id, sourceFeatureId: "zero", walkwayId }, /zero|simple|line/i],
          ["nonsimple", { from: entrance, to: junction, wkt: "LINESTRING(123.001 13.01,123.006 13.01,123.003 13.01,123.01 13.01)", releaseId: release.id, sourceFeatureId: "nonsimple", walkwayId }, /simple|line/i],
        ];
        for (const [label, values, error] of cases) {
          await db.exec(`savepoint "${label}"`);
          await assert.rejects(insertEdge(db, values), error);
          await db.exec(`rollback to savepoint "${label}"`);
        }
        await db.exec("savepoint null_bypass");
        await assert.rejects(db.query(`insert into public.map_edge(from_node_id,to_node_id,path_geom,edge_type,
          mapping_release_id,source_feature_id) values($1,$2,extensions.st_geomfromtext($3,4326)::extensions.geography,
          'path',$4,'null-bypass')`, [entrance, junction, "LINESTRING(123.001 13.01,123.01 13.01)", release.id]), /null|release|site|attributes|check/i);
        await db.exec("rollback to savepoint null_bypass");
        for (const [label, nodeName] of [["blank", ""], ["overlength", "x".repeat(201)]]) {
          await db.exec(`savepoint "node_name_${label}"`);
          await assert.rejects(insertNode(db, nodeArgs(release.id, `bad-name-${label}`, 123.012, 13.012, { nodeName })), /name|check/i);
          await db.exec(`rollback to savepoint "node_name_${label}"`);
        }
      });
    });

    await t.test("indexed candidates reject un-noded crossings, positive overlap, and plot-interior routes while split endpoints remain valid", async () => {
      await ownerOperation(db, async () => {
        await db.exec("savepoint topology_cases");

        const crossingWalkway = await insertWalkway(db, release.id, runId, "crossing-source",
          "LINESTRING(123.006 13.008,123.006 13.012)");
        const crossingFrom = await insertNode(db, nodeArgs(release.id, "crossing-from", 123.006, 13.008));
        const crossingTo = await insertNode(db, nodeArgs(release.id, "crossing-to", 123.006, 13.012));
        await db.exec("savepoint crossing_edge");
        await assert.rejects(insertEdge(db, {
          from: crossingFrom, to: crossingTo, wkt: "LINESTRING(123.006 13.008,123.006 13.012)",
          releaseId: release.id, sourceFeatureId: "crossing-edge", walkwayId: crossingWalkway,
        }), /cross|shared node/i);
        await db.exec("rollback to savepoint crossing_edge");

        const touchingNode = await insertNode(db, nodeArgs(release.id, "touching-node", 123.006, 13.01));
        await db.exec("savepoint touching_edge");
        await assert.rejects(insertEdge(db, {
          from: crossingFrom, to: touchingNode, wkt: "LINESTRING(123.006 13.008,123.006 13.01)",
          releaseId: release.id, sourceFeatureId: "touching-edge", walkwayId: crossingWalkway,
        }), /touch|shared node/i);
        await db.exec("rollback to savepoint touching_edge");

        const sharedStart = await insertNode(db, nodeArgs(release.id, "multi-touch-start", 123.012, 13.016));
        const firstEnd = await insertNode(db, nodeArgs(release.id, "multi-touch-first-end", 123.016, 13.016));
        const coincidentEnd = await insertNode(db, nodeArgs(release.id, "multi-touch-second-end", 123.016, 13.016));
        const firstTouchWalkway = await insertWalkway(db, release.id, runId, "multi-touch-first-source",
          "LINESTRING(123.012 13.016,123.014 13.017,123.016 13.016)");
        const secondTouchWalkway = await insertWalkway(db, release.id, runId, "multi-touch-second-source",
          "LINESTRING(123.012 13.016,123.014 13.015,123.016 13.016)");
        await insertEdge(db, {
          from: sharedStart, to: firstEnd,
          wkt: "LINESTRING(123.012 13.016,123.014 13.017,123.016 13.016)",
          releaseId: release.id, sourceFeatureId: "multi-touch-first-edge", walkwayId: firstTouchWalkway,
        });
        await db.exec("savepoint multi_touch_edge");
        await assert.rejects(insertEdge(db, {
          from: sharedStart, to: coincidentEnd,
          wkt: "LINESTRING(123.012 13.016,123.014 13.015,123.016 13.016)",
          releaseId: release.id, sourceFeatureId: "multi-touch-second-edge", walkwayId: secondTouchWalkway,
        }), /touch|shared node/i);
        await db.exec("rollback to savepoint multi_touch_edge");

        await db.exec("savepoint overlap_edge");
        await assert.rejects(insertEdge(db, {
          from: entrance, to: junction, wkt: "LINESTRING(123.001 13.01,123.01 13.01)",
          releaseId: release.id, sourceFeatureId: "overlap-edge", walkwayId,
        }), /overlap/i);
        await db.exec("rollback to savepoint overlap_edge");

        const plotWalkway = await insertWalkway(db, release.id, runId, "plot-cross-source",
          "LINESTRING(123.009 13.0094,123.011 13.0094)");
        const plotFrom = await insertNode(db, nodeArgs(release.id, "plot-cross-from", 123.009, 13.0094));
        const plotTo = await insertNode(db, nodeArgs(release.id, "plot-cross-to", 123.011, 13.0094));
        await db.exec("savepoint plot_edge");
        await assert.rejects(insertEdge(db, {
          from: plotFrom, to: plotTo, wkt: "LINESTRING(123.009 13.0094,123.011 13.0094)",
          releaseId: release.id, sourceFeatureId: "plot-cross-edge", walkwayId: plotWalkway,
        }), /plot interior/i);
        await db.exec("rollback to savepoint plot_edge");

        const splitWalkway = await insertWalkway(db, release.id, runId, "split-source",
          "LINESTRING(123.003 13.014,123.006 13.014,123.009 13.014)");
        const splitFrom = await insertNode(db, nodeArgs(release.id, "split-from", 123.003, 13.014));
        const splitMiddle = await insertNode(db, nodeArgs(release.id, "split-middle", 123.006, 13.014));
        const splitTo = await insertNode(db, nodeArgs(release.id, "split-to", 123.009, 13.014));
        await insertEdge(db, {
          from: splitFrom, to: splitMiddle, wkt: "LINESTRING(123.003 13.014,123.006 13.014)",
          releaseId: release.id, sourceFeatureId: "split-a", walkwayId: splitWalkway,
        });
        await insertEdge(db, {
          from: splitMiddle, to: splitTo, wkt: "LINESTRING(123.006 13.014,123.009 13.014)",
          releaseId: release.id, sourceFeatureId: "split-b", walkwayId: splitWalkway,
        });
        await db.exec("rollback to savepoint topology_cases");
      });

      await gisLogin(db, gisActors.admin, "postgres");
      const source = (await db.query("select pg_get_functiondef('gis_private.guard_release_graph()'::regprocedure) source")).rows[0].source;
      assert.match(source, /e\.path_geom\s*&&\s*new\.path_geom/i);
      assert.match(source, /p\.plot_geom\s*&&\s*new\.path_geom/i);
      for (const index of ["map_edge_path_geom_gix", "plot_geometry_geom_gist"])
        assert.notEqual((await db.query("select to_regclass($1) name", [`public.${index}`])).rows[0].name, null);
      await db.exec("set enable_seqscan=off");
      const plan = (await db.query(`explain select edge_id from public.map_edge
        where mapping_release_id=$1 and path_geom &&
          extensions.st_geomfromtext('LINESTRING(123.001 13.01,123.01 13.01)',4326)::extensions.geography`,
      [release.id])).rows.map(row => row["QUERY PLAN"]).join("\n");
      assert.match(plan, /map_edge_path_geom_gix|bitmap index scan|index scan/i);
      await db.exec("reset enable_seqscan");
    });

    await t.test("directionality, restrictions, nonwalking edges, isolation, and bounded set reachability are authoritative", async () => {
      await gisLogin(db, gisActors.admin, "postgres");
      const reachable = (await db.query("select r as node_id from gis_private.reachable_nodes($1::uuid) r order by r", [release.id])).rows.map(row => String(row.node_id));
      assert.deepEqual(reachable, [String(entrance), String(junction)]);
      const validation = (await db.query("select gis_private.validate_graph($1::uuid) result", [release.id])).rows[0].result;
      assert.equal(validation.isolatedNodeCount, 1);
      assert.ok(validation.reachableNodeCount <= validation.nodeCount);
      await ownerOperation(db, async () => {
        await db.exec("savepoint review_gates");
        const pendingWalkway = await insertWalkway(db, release.id, runId, "pending-source",
          "LINESTRING(123.01 13.01,123.012 13.013)", { reviewState: "pending" });
        const pendingNode = await insertNode(db, nodeArgs(release.id, "pending-node", 123.012, 13.013, { reviewState: "pending" }));
        await db.exec("savepoint approved_pending_refs");
        await assert.rejects(insertEdge(db, {
          from: junction, to: pendingNode, wkt: "LINESTRING(123.01 13.01,123.012 13.013)",
          releaseId: release.id, sourceFeatureId: "approved-with-pending-refs", walkwayId: pendingWalkway,
          reviewState: "approved",
        }), /approved endpoint|source walkway/i);
        await db.exec("rollback to savepoint approved_pending_refs");
        await insertEdge(db, {
          from: junction, to: pendingNode, wkt: "LINESTRING(123.01 13.01,123.012 13.013)",
          releaseId: release.id, sourceFeatureId: "pending-edge", walkwayId: pendingWalkway, reviewState: "pending",
        });

        const rejectedWalkway = await insertWalkway(db, release.id, runId, "rejected-source",
          "LINESTRING(123.01 13.01,123.013 13.013)", { reviewState: "rejected" });
        const rejectedNode = await insertNode(db, nodeArgs(release.id, "rejected-node", 123.013, 13.013, { reviewState: "rejected" }));
        await insertEdge(db, {
          from: junction, to: rejectedNode, wkt: "LINESTRING(123.01 13.01,123.013 13.013)",
          releaseId: release.id, sourceFeatureId: "rejected-edge", walkwayId: rejectedWalkway, reviewState: "rejected",
        });

        assert.deepEqual((await db.query("select r as node_id from gis_private.reachable_nodes($1::uuid) r order by r", [release.id])).rows.map(row => String(row.node_id)),
          [String(entrance), String(junction)]);
        const gated = (await db.query("select gis_private.validate_graph($1::uuid) result", [release.id])).rows[0].result;
        assert.equal(gated.unreviewedNodeCount, 2);
        assert.equal(gated.unreviewedEdgeCount, 2);
        assert.equal(gated.unreviewedWalkwayReferenceCount, 2);

        await db.query(`update public.map_node set review_state='rejected',revision=revision+1,
          reviewed_at=transaction_timestamp(),reviewed_by=$2 where node_id=$1`, [entrance, gisActors.admin]);
        assert.equal((await db.query("select count(*)::int n from gis_private.reachable_nodes($1::uuid)", [release.id])).rows[0].n, 0);
        const noEntrance = (await db.query("select gis_private.validate_graph($1::uuid) result", [release.id])).rows[0].result;
        assert.equal(noEntrance.missingEntranceCount, 1);
        await db.exec("rollback to savepoint review_gates");
      });
      await ownerOperation(db, async () => {
        const restricted = await insertEdge(db, {
          from: junction, to: isolated, wkt: "LINESTRING(123.01 13.01,123.015 13.01)", releaseId: release.id,
          sourceFeatureId: "restricted", walkwayId, restricted: true, direction: "both",
        });
        assert.equal(restricted.forward_cost_m, null);
        assert.equal(restricted.reverse_cost_m, null);

        const reverseWalkway = (await db.query(`insert into public.mapping_walkway_source(
          mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
          created_by,area_id,walkway_type,walking_allowed,centerline_geom,review_state,reviewed_at,reviewed_by)
          values($1,1,$2,'reverse-source',$3,'synthetic-layer','v1',$4,1,'path',true,
            extensions.st_geomfromtext('LINESTRING(123.001 13.01,123.005 13.012)',4326),
            'approved',transaction_timestamp(),$4) returning walkway_source_id`,
        [release.id, runId, HASH, gisActors.admin])).rows[0].walkway_source_id;
        const reverseOnly = await insertNode(db, nodeArgs(release.id, "reverse-only", 123.005, 13.012));
        const reverse = await insertEdge(db, {
          from: entrance, to: reverseOnly, wkt: "LINESTRING(123.001 13.01,123.005 13.012)", releaseId: release.id,
          sourceFeatureId: "reverse", walkwayId: reverseWalkway, direction: "reverse",
        });
        assert.equal(reverse.forward_cost_m, null);
        assert.ok(reverse.reverse_cost_m > 0);

        const nonwalkingWalkway = (await db.query(`insert into public.mapping_walkway_source(
          mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
          created_by,area_id,walkway_type,walking_allowed,centerline_geom,review_state,reviewed_at,reviewed_by)
          values($1,1,$2,'nonwalking-source',$3,'synthetic-layer','v1',$4,1,'path',false,
            extensions.st_geomfromtext('LINESTRING(123.01 13.01,123.018 13.012)',4326),
            'approved',transaction_timestamp(),$4) returning walkway_source_id`,
        [release.id, runId, HASH, gisActors.admin])).rows[0].walkway_source_id;
        const nonwalkingNode = await insertNode(db, nodeArgs(release.id, "nonwalking-node", 123.018, 13.012));
        const nonwalking = await insertEdge(db, {
          from: junction, to: nonwalkingNode, wkt: "LINESTRING(123.01 13.01,123.018 13.012)", releaseId: release.id,
          sourceFeatureId: "nonwalking", walkwayId: nonwalkingWalkway, direction: "both", walkingAllowed: true,
        });
        assert.equal(nonwalking.walking_allowed, false);
        assert.equal(nonwalking.forward_cost_m, null);
        assert.equal(nonwalking.reverse_cost_m, null);
      });
      await gisLogin(db, gisActors.admin, "postgres");
      assert.deepEqual((await db.query("select r as node_id from gis_private.reachable_nodes($1::uuid) r order by r", [release.id])).rows.map(row => String(row.node_id)),
        [String(entrance), String(junction)]);
    });

    await t.test("grave access is same-release, reachable, inside cemetery, node-connected, and need not be inside the plot", async () => {
      const besidePlotLongitude = 123.01;
      const besidePlotLatitude = 13.01;
      await ownerOperation(db, async () => {
        const pendingId = await insertAccess(db, {
          releaseId: release.id, runId, sourceFeatureId: "access-pending-unreachable", nodeId: isolated,
          longitude: 123.015, latitude: 13.01, reviewState: "pending",
        });
        const pendingReport = (await db.query("select gis_private.validate_graph($1::uuid) result", [release.id])).rows[0].result;
        assert.equal(pendingReport.unreviewedAccessPointCount, 1);
        assert.equal(pendingReport.unreachableAccessPointCount, 1);
        await db.exec("savepoint approve_unreachable_access");
        await assert.rejects(db.query(`update public.grave_access_point set review_state='approved',revision=revision+1,
          reviewed_at=transaction_timestamp(),reviewed_by=$2 where access_point_id=$1`,
        [pendingId, gisActors.admin]), /reachable|approved release entrance/i);
        await db.exec("rollback to savepoint approve_unreachable_access");
        await db.query("delete from public.grave_access_point where access_point_id=$1", [pendingId]);
      });
      const accessId = await ownerOperation(db, () => insertAccess(db, {
        releaseId: release.id, runId, sourceFeatureId: "access-1", nodeId: junction,
        longitude: besidePlotLongitude, latitude: besidePlotLatitude,
      }));
      await gisLogin(db, gisActors.admin, "postgres");
      const access = (await db.query(`select extensions.st_coveredby(a.access_point_geom,p.plot_geom) inside_plot,
        extensions.st_coveredby(a.access_point_geom,b.boundary_geom) inside_cemetery
        from public.grave_access_point a join public.plot_geometry p using(mapping_release_id,lot_id)
        join public.mapping_boundary b on b.mapping_release_id=a.mapping_release_id and b.kind='cemetery'
        where a.access_point_id=$1`, [accessId])).rows[0];
      assert.equal(access.inside_plot, false);
      assert.equal(access.inside_cemetery, true);
      const acceptedReport = (await db.query("select gis_private.validate_graph($1::uuid) result", [release.id])).rows[0].result;
      assert.equal(acceptedReport.unreviewedAccessPointCount, 0);
      assert.equal(acceptedReport.unreachableAccessPointCount, 0);
      await ownerOperation(db, async () => {
        for (const [label, nodeId, lon, lat, error] of [
          ["isolated", isolated, 123.015, 13.01, /reachable|connected/i],
          ["orphan", 999999, 123.01, 13.01, /node|foreign key|orphan/i],
          ["mismatch", junction, 123.0101, 13.01, /node|connect|equal/i],
          ["outside", junction, 124, 14, /cemetery|boundary|node|connect/i],
        ]) {
          await db.exec(`savepoint "access_${label}"`);
          await assert.rejects(insertAccess(db, { releaseId: release.id, runId, sourceFeatureId: `access-${label}`, nodeId, longitude: lon, latitude: lat }), error);
          await db.exec(`rollback to savepoint "access_${label}"`);
        }
      });
    });

    await t.test("display features are visual-only and never become graph nodes or destinations", async () => {
      const before = (await db.query("select count(*)::int n from public.map_node where mapping_release_id=$1", [release.id])).rows[0].n;
      const displayId = await ownerOperation(db, async () => {
        for (const [label, value] of [["empty", ""], ["overlength", "x".repeat(201)]]) {
          await db.exec(`savepoint "display_${label}"`);
          await assert.rejects(db.query(`insert into public.mapping_display_feature(
            mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
            created_by,kind,label,display_geom) values($1,1,$2,$3,$4,'display','v1',$5,'landmark',$6,
            extensions.st_geomfromtext('POINT(123.012 13.012)',4326))`,
          [release.id, runId, `visual-${label}`, HASH, gisActors.admin, value]), /label|check/i);
          await db.exec(`rollback to savepoint "display_${label}"`);
        }
        return (await db.query(`insert into public.mapping_display_feature(
          mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
          created_by,kind,label,display_geom) values($1,1,$2,'visual-landmark',$3,'display','v1',$4,'landmark','Garden marker',
          extensions.st_geomfromtext('POINT(123.012 13.012)',4326)) returning display_feature_id`,
        [release.id, runId, HASH, gisActors.admin])).rows[0].display_feature_id;
      });
      assert.equal((await db.query("select count(*)::int n from public.map_node where mapping_release_id=$1", [release.id])).rows[0].n, before);
      assert.equal((await db.query("select route_node_id is null ok from public.mapping_display_feature where source_feature_id='visual-landmark'")).rows[0].ok, true);
      await gisLogin(db, gisActors.admin);
      await assert.rejects(db.query("delete from public.mapping_display_feature where display_feature_id=$1 returning display_feature_id", [displayId]), /permission|policy/i);
      await ownerOperation(db, () => db.query("delete from public.mapping_display_feature where display_feature_id=$1", [displayId]));
      await gisLogin(db, gisActors.admin, "postgres");
      assert.equal((await db.query("select count(*)::int n from public.mapping_display_feature where display_feature_id=$1", [displayId])).rows[0].n, 0);
    });

    await t.test("direct writes, review flags, frozen parents, RLS, ACLs, and private helpers remain protected", async () => {
      await gisLogin(db, gisActors.admin);
      assert.equal((await db.query("delete from public.map_node where node_id=$1 returning node_id", [entrance])).rows.length, 0);
      assert.equal((await db.query("select count(*)::int n from public.map_node where node_id=$1", [entrance])).rows[0].n, 1);
      await gisLogin(db, gisActors.manager);
      assert.equal((await db.query("select count(*)::int n from public.map_node where mapping_release_id=$1", [release.id])).rows[0].n, 0);
      await gisLogin(db, gisActors.admin, "postgres");
      for (const table of ["grave_access_point", "mapping_display_feature"])
        for (const role of ["anon", "authenticated", "service_role"])
          assert.equal((await db.query("select has_table_privilege($1,$2,'INSERT,UPDATE,DELETE') ok", [role, `public.${table}`])).rows[0].ok, false);
      for (const fn of ["validate_graph(uuid)", "reachable_nodes(uuid)", "guard_release_graph()", "guard_access_point()"])
        for (const role of ["anon", "authenticated", "service_role"])
          assert.equal((await db.query("select has_function_privilege($1,$2,'EXECUTE') ok", [role, `gis_private.${fn}`])).rows[0].ok, false);
      await ownerOperation(db, async () => {
        await db.query("update public.mapping_release set status='validated',revision=revision+1 where release_id=$1", [release.id]);
      });
      await assert.rejects(ownerOperation(db, () => db.query("delete from public.map_node where node_id=$1", [entrance])), /frozen|staged|immutable/i);
    });

    await t.test("release graph audits redact geometry, costs, and private notes while every earlier branch is preserved", async () => {
      await gisLogin(db, gisActors.admin, "postgres");
      const row = (await db.query("select to_jsonb(n) value from public.map_node n where node_id=$1", [entrance])).rows[0].value;
      const safe = (await db.query("select public.audit_safe_row('map_node',$1::jsonb) value", [JSON.stringify(row)])).rows[0].value;
      assert.equal(safe.mapping_release_id, release.id);
      for (const privateKey of ["location_geom", "review_notes", "node_name", "px_loc_x", "px_loc_y"])
        assert.equal(Object.hasOwn(safe, privateKey), false);
      const legacy = { node_id: 1, node_name: "legacy", mapping_release_id: null, location_geom: "legacy-point" };
      assert.deepEqual((await db.query("select public.audit_safe_row('map_node',$1::jsonb) value", [JSON.stringify(legacy)])).rows[0].value, legacy);
      const cases = [
        ["lot_owner", { first_name: "Private", lot_owner_id: 1 }, "first_name"],
        ["deceased", { deceased_id: 1, cause_of_death: "Private" }, "cause_of_death"],
        ["burial_record", { burial_id: 1, quality_notes: "Private" }, "quality_notes"],
        ["account", { account_id: gisActors.admin, username: "Private" }, "username"],
      ];
      for (const [table, value, redacted] of cases)
        assert.equal(Object.hasOwn((await db.query("select public.audit_safe_row($1,$2::jsonb) value", [table, JSON.stringify(value)])).rows[0].value, redacted), false);

      const audit = (await db.query(`select coalesce(old_values,'{}'::jsonb)||coalesce(new_values,'{}'::jsonb) value
        from public.audit_log where table_name='map_edge' and record_id<> '1' order by audit_id desc limit 1`)).rows[0].value;
      for (const privateKey of ["path_geom","distance_m","forward_cost_m","reverse_cost_m","review_notes"])
        assert.equal(Object.hasOwn(audit, privateKey), false);
      assert.doesNotMatch(JSON.stringify(audit), /PRIVATE_EDGE_NOTE/);
      await gisLogin(db, gisActors.manager);
      assert.equal((await db.query(`select count(*)::int n from public.audit_log
        where table_name in ('map_node','map_edge') and
          coalesce(new_values->>'mapping_release_id',old_values->>'mapping_release_id') is not null`)).rows[0].n, 0);
      assert.ok((await db.query(`select count(*)::int n from public.audit_log
        where table_name in ('map_node','map_edge') and record_id in ('1','2')`)).rows[0].n > 0);
      await gisLogin(db, gisActors.admin, "postgres");
    });

    assert.deepEqual(await graphDigest(db), legacyBaseline);
  } finally {
    await db.close();
  }
});
