import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./database-helper.mjs";
import {
  createRelease,
  gisActors,
  gisLogin,
  releaseValues,
  seedGisFixtures,
} from "./gis-fixtures.mjs";

const HASH = "e".repeat(64);
const START = "2026-09-28T03:00:00Z";
const END = "2026-09-28T03:05:00Z";

const cemeteryPolygon = "POLYGON((123 13,123.02 13,123.02 13.02,123 13.02,123 13))";
const areaPolygon = "POLYGON((123.001 13.001,123.019 13.001,123.019 13.019,123.001 13.019,123.001 13.001))";

function square(x, y, size = 0.0002) {
  return `POLYGON((${x} ${y},${x + size} ${y},${x + size} ${y + size},${x} ${y + size},${x} ${y}))`;
}

async function seedLots(db) {
  const values = [];
  for (let index = 0; index < 30; index += 1) {
    values.push(`(${1001 + index},1,'P-${String(index + 1).padStart(2, "0")}',null,'AVAILABLE')`);
  }
  values.push("(1900,1,'REMOVED',null,'AVAILABLE')");
  values.push("(2001,2,'OTHER-AREA',null,'AVAILABLE')");
  values.push("(3001,3,'OTHER-SITE',null,'AVAILABLE')");
  await db.exec(`insert into public.lot(lot_id,area_id,lot_code,legacy_location_code,status) values ${values.join(",")};
    update public.lot set deleted_at=now() where lot_id=1900;`);
}

async function surveyPoint(db, siteId = "1") {
  return (await db.query(
    "select public.staff_save_survey_point(null,null,$1::jsonb,$2::uuid) result",
    [JSON.stringify({ site_id: siteId, point_code: `validation-${randomUUID()}`, role: "VALIDATION" }), randomUUID()],
  )).rows[0].result;
}

async function acceptedCapture(db, pointId, longitude = 123.01, latitude = 13.01) {
  const observations = Array.from({ length: 5 }, (_, index) => ({
    observation_order: index + 1,
    latitude,
    longitude,
    reported_accuracy_m: 1,
    captured_at: new Date(Date.parse(START) + index * 30_000).toISOString(),
  }));
  const captured = (await db.query(
    "select public.staff_record_survey_capture($1::uuid,$2,$3::jsonb,$4::jsonb,$5::uuid) result",
    [pointId, `capture-${randomUUID()}`, JSON.stringify({ started_at: START, ended_at: END }), JSON.stringify(observations), randomUUID()],
  )).rows[0].result;
  return (await db.query(
    "select public.staff_review_survey_capture($1::uuid,1,'accepted','[]'::jsonb,null,$2::uuid) result",
    [captured.id, randomUUID()],
  )).rows[0].result;
}

async function acceptedRun(db, releaseId, siteId = "1") {
  const point = await surveyPoint(db, siteId);
  const capture = await acceptedCapture(db, point.id);
  const values = {
    release_id: releaseId,
    run_code: `geometry-${randomUUID()}`,
    source_reference: "synthetic/plan.png",
    source_hash: "c".repeat(64),
    source_width: 1000,
    source_height: 1000,
    source_coordinate_space: "pixel coordinates, top-left origin",
    working_srid: 32651,
    output_srid: 4326,
    method: "polynomial-1",
    processing_parameters: { expected_validation_count: 1 },
    processed_at: "2026-09-28T04:00:00Z",
    qgis_version: "3.40",
    output_artifact_reference: "synthetic/georeferenced.tif",
    output_artifact_hash: "d".repeat(64),
  };
  const saved = (await db.query(
    "select public.staff_save_georeferencing_run(null,null,$1::jsonb,$2::jsonb,$3::jsonb,$4::uuid) result",
    [
      JSON.stringify(values),
      JSON.stringify([{ point_id: point.id, capture_id: capture.id, role: "VALIDATION", source_x: 10, source_y: 10 }]),
      JSON.stringify([{ point_id: point.id, transformed_longitude: 123.01003, transformed_latitude: 13.01004, review_state: "reviewed" }]),
      randomUUID(),
    ],
  )).rows[0].result;
  const reviewed = (await db.query(
    "select public.staff_review_georeferencing_run($1::uuid,1,'accepted',$2::jsonb,null,$3::uuid) result",
    [saved.id, JSON.stringify(["fitting_count_below_target", "validation_count_below_target"]), randomUUID()],
  )).rows[0].result;
  assert.equal(reviewed.state, "accepted");
  assert.equal((await db.query("select selected_run_id from public.mapping_release where release_id=$1", [releaseId])).rows[0].selected_run_id, saved.id);
  return saved.id;
}

async function ownerOperation(db, operation, callback) {
  await gisLogin(db, gisActors.admin, "postgres");
  await db.exec("begin");
  const requestId = randomUUID();
  try {
    await db.query(
      "insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash) values($1,$2,$3,$4)",
      [requestId, gisActors.admin, operation, "f".repeat(64)],
    );
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

async function stageRelease(db, releaseId) {
  await ownerOperation(db, "staff_seal_mapping_import", async () => {
    await db.query(`update public.mapping_release set status='staged',revision=revision+1,
      staged_at=transaction_timestamp(),staged_by=$2 where release_id=$1`, [releaseId, gisActors.admin]);
  });
}

function common(releaseId, runId, sourceFeatureId, overrides = {}) {
  return {
    releaseId,
    siteId: "1",
    runId,
    sourceFeatureId,
    artifactHash: HASH,
    layerName: "synthetic-layer",
    layerVersion: "v1",
    reviewState: "approved",
    ...overrides,
  };
}

async function insertBoundary(db, values, kind, areaId, wkt) {
  return (await db.query(`insert into public.mapping_boundary(
      mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
      review_state,created_by,reviewed_at,reviewed_by,kind,area_id,boundary_geom)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,transaction_timestamp(),$9,$10,$11,
      extensions.st_geomfromtext($12,4326)) returning boundary_id`,
  [values.releaseId, values.siteId, values.runId, values.sourceFeatureId, values.artifactHash,
    values.layerName, values.layerVersion, values.reviewState, gisActors.admin, kind, areaId, wkt])).rows[0].boundary_id;
}

async function insertPlot(db, values, lotId, areaId, wkt, geometrySql = "extensions.st_geomfromtext($12,4326)") {
  return (await db.query(`insert into public.plot_geometry(
      mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
      review_state,created_by,reviewed_at,reviewed_by,lot_id,area_id,plot_geom)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,transaction_timestamp(),$9,$10,$11,${geometrySql}) returning plot_geometry_id`,
  [values.releaseId, values.siteId, values.runId, values.sourceFeatureId, values.artifactHash,
    values.layerName, values.layerVersion, values.reviewState, gisActors.admin, lotId, areaId, wkt])).rows[0].plot_geometry_id;
}

function nonfinitePolygonSql(numberToken) {
  return `extensions.st_setsrid(extensions.st_makepolygon(extensions.st_makeline(array[
    extensions.st_makepoint('${numberToken}'::double precision,13.002),
    extensions.st_makepoint(123.004,13.002),extensions.st_makepoint(123.004,13.004),
    extensions.st_makepoint(123.002,13.004),
    extensions.st_makepoint('${numberToken}'::double precision,13.002)
  ])),4326)`;
}

async function insertNonfinitePlot(db, values, lotId, areaId, numberToken) {
  return db.query(`insert into public.plot_geometry(
      mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
      review_state,created_by,reviewed_at,reviewed_by,lot_id,area_id,plot_geom)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,transaction_timestamp(),$9,$10,$11,
      ${nonfinitePolygonSql(numberToken)}) returning plot_geometry_id`,
  [values.releaseId, values.siteId, values.runId, values.sourceFeatureId, values.artifactHash,
    values.layerName, values.layerVersion, values.reviewState, gisActors.admin, lotId, areaId]);
}

async function insertWalkway(db, values, areaId, wkt) {
  return (await db.query(`insert into public.mapping_walkway_source(
      mapping_release_id,site_id,georeferencing_run_id,source_feature_id,artifact_hash,layer_name,layer_version,
      review_state,created_by,reviewed_at,reviewed_by,area_id,walkway_type,walking_allowed,restriction_context,centerline_geom)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,transaction_timestamp(),$9,$10,'path',true,'Synthetic restriction context',
      extensions.st_geomfromtext($11,4326)) returning walkway_source_id`,
  [values.releaseId, values.siteId, values.runId, values.sourceFeatureId, values.artifactHash,
    values.layerName, values.layerVersion, values.reviewState, gisActors.admin, areaId, wkt])).rows[0].walkway_source_id;
}

async function legacyDigest(db) {
  return (await db.query(`select
    (select md5(coalesce(jsonb_agg(to_jsonb(s) order by site_id)::text,'[]')) from public.site s) site_hash,
    (select md5(coalesce(jsonb_agg(to_jsonb(a) order by area_id)::text,'[]')) from public.area a) area_hash,
    (select md5(coalesce(jsonb_agg(to_jsonb(l) order by lot_id)::text,'[]')) from public.lot l) lot_hash,
    (select count(*)::int from public.lot) lot_count`)).rows[0];
}

test("M04 versioned geometry preserves operational identity and validates topology", async (t) => {
  const db = await createTestDatabase();
  try {
    await seedGisFixtures(db);
    await seedLots(db);
    await gisLogin(db);

    await t.test("M04 objects and private helpers exist", async () => {
      await gisLogin(db, gisActors.admin, "postgres");
      for (const table of ["mapping_boundary", "plot_geometry", "mapping_walkway_source"])
        assert.equal((await db.query("select to_regclass($1) name", [`public.${table}`])).rows[0].name, table);
      for (const fn of ["guard_gis_content", "validate_plot_identity", "validate_geometry_core"])
        assert.equal((await db.query("select to_regprocedure($1) name", [`gis_private.${fn}${fn === "validate_geometry_core" ? "(uuid)" : "()"}`])).rows[0].name !== null, true);
      await gisLogin(db);
    });

    const release = await createRelease(db);
    const runId = await acceptedRun(db, release.id);
    await stageRelease(db, release.id);
    const selectedRun = (await db.query(`select r.selected_run_id,r.status,
      (select g.review_state from public.georeferencing_run g where g.run_id=r.selected_run_id) review_state
      from public.mapping_release r where r.release_id=$1`, [release.id])).rows[0];
    assert.equal(selectedRun.selected_run_id, null);
    assert.equal((await db.query("select review_state from public.georeferencing_run where run_id=$1", [runId])).rows[0].review_state, "accepted");
    assert.equal(selectedRun.status, "staged");
    const baseline = await legacyDigest(db);

    await t.test("requires versioned cemetery and area boundaries, accepted same-release run provenance, and valid provenance", async () => {
      await ownerOperation(db, "staff_finalize_mapping_import", async () => {
        await insertBoundary(db, common(release.id, runId, "cemetery"), "cemetery", null, cemeteryPolygon);
        await insertBoundary(db, common(release.id, runId, "area-1"), "area", "1", areaPolygon);
        await insertWalkway(db, common(release.id, runId, "walkway-1"), "1", "LINESTRING(123.001 13.01,123.019 13.01)");
        const result = (await db.query("select gis_private.validate_geometry_core($1::uuid) result", [release.id])).rows[0].result;
        assert.equal(result.errorCount, 0);
        assert.deepEqual({ boundaryCount: result.boundaryCount, plotCount: result.plotCount, walkwayCount: result.walkwayCount },
          { boundaryCount: 2, plotCount: 0, walkwayCount: 1 });
      });

      const otherRelease = await createRelease(db, releaseValues({ release_code: `other-${randomUUID()}` }));
      const otherRun = await acceptedRun(db, otherRelease.id);
      await stageRelease(db, otherRelease.id);
      await ownerOperation(db, "staff_finalize_mapping_import", async () => {
        for (const [label, values, error] of [
          ["wrong run", common(release.id, otherRun, "wrong-run"), /run|selected|release/i],
          ["bad hash", common(release.id, runId, "bad-hash", { artifactHash: "not-a-hash" }), /hash|check/i],
          ["blank layer", common(release.id, runId, "blank-layer", { layerName: "" }), /layer|text|check/i],
        ]) {
          await db.exec(`savepoint "${label.replace(" ", "_")}"`);
          await assert.rejects(insertWalkway(db, values, "1", "LINESTRING(123.001 13.011,123.019 13.011)"), error);
          await db.exec(`rollback to savepoint "${label.replace(" ", "_")}"`);
        }
      });
    });

    await t.test("rejects invalid, empty, Z, and wrong-SRID polygons", async () => {
      await ownerOperation(db, "staff_finalize_mapping_import", async () => {
        const cases = [
          ["invalid", "POLYGON((123.002 13.002,123.004 13.004,123.004 13.002,123.002 13.004,123.002 13.002))", "extensions.st_geomfromtext($12,4326)"],
          ["empty", "POLYGON EMPTY", "extensions.st_geomfromtext($12,4326)"],
          ["z", "POLYGON Z((123.002 13.002 1,123.004 13.002 1,123.004 13.004 1,123.002 13.002 1))", "extensions.st_geomfromtext($12,4326)"],
          ["wrong-srid", square(123.002, 13.002), "extensions.st_geomfromtext($12,3857)"],
        ];
        for (const [label, wkt, sql] of cases) {
          await db.exec(`savepoint "${label}"`);
          await assert.rejects(insertPlot(db, common(release.id, runId, `bad-${label}`), 1001, "1", wkt, sql), /geometry|valid|empty|dimension|srid|typmod|check/i);
          await db.exec(`rollback to savepoint "${label}"`);
        }
      });
    });

    await t.test("rejects constructed NaN and Infinity polygon coordinates through the explicit geometry guard", async () => {
      const cases = [
        ["nan", "NaN"],
        ["infinity", "Infinity"],
      ];
      for (const [label, numberToken] of cases) {
        await gisLogin(db, gisActors.admin, "postgres");
        const constructed = (await db.query(
          `select ${nonfinitePolygonSql(numberToken)} is not null constructed`,
        )).rows[0].constructed;
        await gisLogin(db);
        assert.equal(constructed, true, `${label} fixture must reach the database geometry check`);
        await assert.rejects(ownerOperation(db, "staff_finalize_mapping_import", async () => {
          await insertNonfinitePlot(db, common(release.id, runId, `nonfinite-${label}`), 1002, "1", numberToken);
        }), (error) => {
          assert.equal(error.code, "P0001", `${label} must be rejected by the explicit geometry guard`);
          assert.match(error.message, /plot geometry must be a valid finite nonempty 2D EPSG:4326 polygon/i);
          assert.match(error.where ?? "", /gis_private\.validate_plot_identity\(\)/i);
          return true;
        });
      }
    });

    await t.test("rejects unknown, removed, wrong-area, and wrong-site lots", async () => {
      await ownerOperation(db, "staff_finalize_mapping_import", async () => {
        const cases = [
          ["unknown", 999999, "1", /lot|exist|foreign key/i],
          ["removed", 1900, "1", /removed|current|lot/i],
          ["wrong-area", 2001, "1", /area|lot|mismatch/i],
          ["wrong-site", 3001, "3", /site|scope|release|area/i],
        ];
        for (const [label, lotId, areaId, error] of cases) {
          await db.exec(`savepoint "${label}"`);
          await assert.rejects(insertPlot(db, common(release.id, runId, `identity-${label}`), lotId, areaId, square(123.002, 13.002)), error);
          await db.exec(`rollback to savepoint "${label}"`);
        }
      });
    });

    await t.test("rejects duplicate, contained, and partial interior overlap while allowing shared edges and vertices", async () => {
      await ownerOperation(db, "staff_finalize_mapping_import", async () => {
        await insertPlot(db, common(release.id, runId, "plot-1"), 1001, "1", square(123.002, 13.002));
        for (const [label, lotId, wkt] of [
          ["duplicate", 1002, square(123.002, 13.002)],
          ["contained", 1003, square(123.00205, 13.00205, 0.00005)],
          ["partial", 1004, square(123.0021, 13.0021)],
        ]) {
          await db.exec(`savepoint "${label}"`);
          await assert.rejects(insertPlot(db, common(release.id, runId, `plot-${label}`), lotId, "1", wkt), /overlap|interior|duplicate|conflict/i);
          await db.exec(`rollback to savepoint "${label}"`);
        }
        await insertPlot(db, common(release.id, runId, "plot-edge-touch"), 1005, "1", square(123.0022, 13.002));
        await insertPlot(db, common(release.id, runId, "plot-vertex-touch"), 1006, "1", square(123.0022, 13.0022));
      });
    });

    await t.test("requires plot coverage by both versioned area and cemetery boundaries", async () => {
      await ownerOperation(db, "staff_finalize_mapping_import", async () => {
        await db.exec("savepoint outside_area");
        await assert.rejects(insertPlot(db, common(release.id, runId, "outside-area"), 1007, "1", square(123.0191, 13.01)), /boundary|contain|covered/i);
        await db.exec("rollback to savepoint outside_area");
        await db.exec("savepoint outside_cemetery");
        await assert.rejects(insertPlot(db, common(release.id, runId, "outside-cemetery"), 1007, "1", square(124, 14)), /boundary|contain|covered/i);
        await db.exec("rollback to savepoint outside_cemetery");
      });
    });

    await t.test("legacy null point coordinates remain compatible and omitted GIS features never mutate operational lots", async () => {
      assert.equal((await db.query("select location_geom is null and px_loc_x is null and px_loc_y is null ok from public.lot where lot_id=1001")).rows[0].ok, true);
      assert.deepEqual(await legacyDigest(db), baseline);
      const plotId = (await db.query("select plot_geometry_id from public.plot_geometry where lot_id=1001 and mapping_release_id=$1", [release.id])).rows[0].plot_geometry_id;
      await ownerOperation(db, "staff_finalize_mapping_import", async () => {
        await db.query("delete from public.plot_geometry where plot_geometry_id=$1", [plotId]);
      });
      assert.deepEqual(await legacyDigest(db), baseline);
      assert.equal((await db.query("select count(*)::int n from public.lot where lot_id between 1001 and 1030")).rows[0].n, 30);
    });

    await t.test("GiST candidate filtering is present and used for the fictional 30-plot pilot", async (t) => {
      await ownerOperation(db, "staff_finalize_mapping_import", async () => {
        for (let index = 0; index < 24; index += 1) {
          const column = index % 8;
          const row = Math.floor(index / 8);
          await insertPlot(db, common(release.id, runId, `perf-${index}`), 1007 + index, "1",
            square(123.003 + column * 0.001, 13.004 + row * 0.001, 0.0004));
        }
      });
      await gisLogin(db, gisActors.admin, "postgres");
      await db.exec("set enable_seqscan=off");
      const plan = (await db.query(`explain select plot_geometry_id from public.plot_geometry
        where mapping_release_id=$1 and plot_geom && extensions.st_geomfromtext($2,4326)
          and extensions.st_relate(plot_geom,extensions.st_geomfromtext($2,4326),'2********')`,
      [release.id, square(123.0031, 13.0041)])).rows.map(row => row["QUERY PLAN"]).join("\n");
      t.diagnostic(plan);
      assert.match(plan, /plot_geometry_geom_gist|bitmap index scan|index scan/i);
      const source = (await db.query("select pg_get_functiondef('gis_private.validate_plot_identity()'::regprocedure) source")).rows[0].source;
      assert.match(source, /&&/);
      assert.match(source, /st_relate/i);
      await db.exec("reset enable_seqscan");
      await gisLogin(db);
    });

    await t.test("protected boundary updates cannot shrink outside existing versioned children", async () => {
      const before = (await db.query(`select boundary_id,kind,revision,boundary_geom::text geometry
        from public.mapping_boundary where mapping_release_id=$1 order by kind`, [release.id])).rows;
      assert.deepEqual(before.map(row => [row.kind, row.revision]), [["area", 1], ["cemetery", 1]]);

      const areaBoundary = before.find(row => row.kind === "area");
      await assert.rejects(ownerOperation(db, "staff_finalize_mapping_import", async () => {
        await db.query(`update public.mapping_boundary set
          boundary_geom=extensions.st_geomfromtext($2,4326),revision=revision+1
          where boundary_id=$1`, [areaBoundary.boundary_id,
          "POLYGON((123.001 13.001,123.0015 13.001,123.0015 13.0015,123.001 13.0015,123.001 13.001))"]);
      }), /area boundary must cover every existing plot/i);

      const cemeteryBoundary = before.find(row => row.kind === "cemetery");
      await assert.rejects(ownerOperation(db, "staff_finalize_mapping_import", async () => {
        await db.query(`update public.mapping_boundary set
          boundary_geom=extensions.st_geomfromtext($2,4326),revision=revision+1
          where boundary_id=$1`, [cemeteryBoundary.boundary_id,
          "POLYGON((123.001 13.001,123.01 13.001,123.01 13.01,123.001 13.01,123.001 13.001))"]);
      }), /cemetery boundary must cover every existing versioned area boundary/i);

      const after = (await db.query(`select boundary_id,kind,revision,boundary_geom::text geometry
        from public.mapping_boundary where mapping_release_id=$1 order by kind`, [release.id])).rows;
      assert.deepEqual(after, before);
    });

    await t.test("RLS, ACLs, private helpers, indexes, constraints, and guarded writes are protected", async () => {
      await gisLogin(db);
      for (const table of ["mapping_boundary", "plot_geometry", "mapping_walkway_source"])
        await assert.rejects(db.exec(`delete from public.${table}`), /permission denied/i);
      await assert.rejects(db.query("select gis_private.validate_geometry_core($1::uuid)", [release.id]), /permission denied/i);
      await gisLogin(db, gisActors.manager);
      for (const table of ["mapping_boundary", "plot_geometry", "mapping_walkway_source"])
        assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);

      await gisLogin(db, gisActors.admin, "postgres");
      const triggerNames = (await db.query(`select tgname from pg_trigger where not tgisinternal
        and tgrelid in ('public.mapping_boundary'::regclass,'public.plot_geometry'::regclass,
          'public.mapping_walkway_source'::regclass) order by tgname`)).rows.map(row => row.tgname);
      assert.deepEqual(triggerNames, [
        "mapping_boundary_content_guard",
        "mapping_walkway_source_content_guard",
        "plot_geometry_10_content_guard",
        "plot_geometry_20_identity_guard",
      ]);
      const constraints = new Set((await db.query(`select conname from pg_constraint where conrelid in
        ('public.mapping_boundary'::regclass,'public.plot_geometry'::regclass,'public.mapping_walkway_source'::regclass)`)).rows.map(row => row.conname));
      for (const name of [
        "mapping_boundary_release_site_fkey", "mapping_boundary_run_scope_fkey", "mapping_boundary_area_scope_fkey",
        "mapping_boundary_geometry_check", "plot_geometry_release_lot_key", "plot_geometry_release_site_fkey",
        "plot_geometry_run_scope_fkey", "plot_geometry_area_scope_fkey", "plot_geometry_geometry_check",
        "mapping_walkway_source_release_site_fkey", "mapping_walkway_source_run_scope_fkey",
        "mapping_walkway_source_area_scope_fkey", "mapping_walkway_source_geometry_check",
      ]) assert.ok(constraints.has(name), `missing ${name}`);
      for (const table of ["mapping_boundary", "plot_geometry", "mapping_walkway_source"]) {
        assert.equal((await db.query("select relrowsecurity from pg_class where oid=$1::regclass", [`public.${table}`])).rows[0].relrowsecurity, true);
        assert.ok((await db.query("select count(*)::int n from pg_indexes where schemaname='public' and tablename=$1", [table])).rows[0].n >= 4);
        for (const role of ["anon", "authenticated", "service_role"]) {
          for (const privilege of ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"])
            assert.equal((await db.query("select has_table_privilege($1,$2,$3) ok", [role, `public.${table}`, privilege])).rows[0].ok, false);
          assert.equal((await db.query("select has_table_privilege($1,$2,'SELECT') ok", [role, `public.${table}`])).rows[0].ok, role === "authenticated");
        }
      }
      const helpers = (await db.query(`select p.oid,p.proname,p.prosecdef,p.proconfig from pg_proc p
        where p.pronamespace='gis_private'::regnamespace
          and p.proname in ('guard_gis_content','validate_plot_identity','validate_geometry_core') order by p.proname`)).rows;
      assert.deepEqual(helpers.map(row => row.proname), ["guard_gis_content", "validate_geometry_core", "validate_plot_identity"]);
      for (const fn of helpers) {
        assert.equal(fn.prosecdef, false);
        assert.deepEqual(fn.proconfig, ["search_path=pg_catalog, extensions, pg_temp"]);
        for (const role of ["anon", "authenticated", "service_role"])
          assert.equal((await db.query("select has_function_privilege($1,$2::oid,'EXECUTE') ok", [role, fn.oid])).rows[0].ok, false);
      }
      await gisLogin(db);
    });

    await t.test("a feature approval flag cannot bypass frozen-parent immutability", async () => {
      await ownerOperation(db, "staff_finalize_mapping_import", async () => {
        await db.query(`update public.mapping_release set status='validated',revision=revision+1,
          validated_at=transaction_timestamp(),validated_by=$2 where release_id=$1`, [release.id, gisActors.admin]);
      });
      const walkwayId = (await db.query("select walkway_source_id from public.mapping_walkway_source where mapping_release_id=$1", [release.id])).rows[0].walkway_source_id;
      await assert.rejects(ownerOperation(db, "staff_finalize_mapping_import", async () => {
        await db.query("delete from public.mapping_walkway_source where walkway_source_id=$1", [walkwayId]);
      }), /never-frozen|staged|frozen/i);
      assert.equal((await db.query("select review_state from public.mapping_walkway_source where walkway_source_id=$1", [walkwayId])).rows[0].review_state, "approved");
    });
  } finally {
    await db.close();
  }
});
