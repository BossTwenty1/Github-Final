import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createTestDatabase } from "./database-helper.mjs";
import { createRelease, gisActors, gisLogin, releaseValues, seedGisFixtures, withOwnerTransaction } from "./gis-fixtures.mjs";

const start = "2026-09-28T01:00:00Z";
const end = "2026-09-28T01:05:00Z";

async function point(db, role, code = `${role.toLowerCase()}-${randomUUID()}`, siteId = "1") {
  const values = { site_id: siteId, point_code: code, role, description: "Synthetic georeferencing evidence" };
  return (await db.query(
    "select public.staff_save_survey_point(null,null,$1::jsonb,$2::uuid) result",
    [JSON.stringify(values), randomUUID()],
  )).rows[0].result;
}

async function recordedCapture(db, pointId, longitude, latitude) {
  const observations = Array.from({ length: 5 }, (_, index) => ({
    observation_order: index + 1,
    latitude,
    longitude,
    reported_accuracy_m: 1,
    captured_at: new Date(Date.parse(start) + index * 30_000).toISOString(),
  }));
  return (await db.query(
    "select public.staff_record_survey_capture($1::uuid,$2,$3::jsonb,$4::jsonb,$5::uuid) result",
    [pointId, `capture-${randomUUID()}`, JSON.stringify({ started_at: start, ended_at: end }), JSON.stringify(observations), randomUUID()],
  )).rows[0].result;
}

async function acceptedCapture(db, pointId, longitude, latitude) {
  const captured = await recordedCapture(db, pointId, longitude, latitude);
  return (await db.query(
    "select public.staff_review_survey_capture($1::uuid,1,'accepted','[]'::jsonb,null,$2::uuid) result",
    [captured.id, randomUUID()],
  )).rows[0].result;
}

function runValues(releaseId, overrides = {}) {
  return {
    release_id: releaseId,
    run_code: `run-${randomUUID()}`,
    source_reference: "synthetic/plan.png",
    source_hash: "c".repeat(64),
    source_width: 1000,
    source_height: 800,
    source_coordinate_space: "pixel coordinates, top-left origin",
    working_srid: 32651,
    output_srid: 4326,
    method: "polynomial-1",
    processing_parameters: { resampling: "nearest", expected_validation_count: 1 },
    processed_at: "2026-09-28T02:00:00Z",
    qgis_version: "3.40",
    operator_reference: "synthetic operator",
    output_artifact_reference: "synthetic/georeferenced.tif",
    output_artifact_hash: "d".repeat(64),
    notes: "PRIVATE_RUN_NOTE",
    ...overrides,
  };
}

async function saveRun(db, runId, expectedRevision, values, memberships, results, requestId = randomUUID()) {
  return (await db.query(
    "select public.staff_save_georeferencing_run($1::uuid,$2::int,$3::jsonb,$4::jsonb,$5::jsonb,$6::uuid) result",
    [runId, expectedRevision, JSON.stringify(values), JSON.stringify(memberships), JSON.stringify(results), requestId],
  )).rows[0].result;
}

async function reviewRun(db, runId, revision, decision, acknowledgements = [], notes = null, requestId = randomUUID()) {
  return (await db.query(
    "select public.staff_review_georeferencing_run($1::uuid,$2::int,$3,$4::jsonb,$5,$6::uuid) result",
    [runId, revision, decision, JSON.stringify(acknowledgements), notes, requestId],
  )).rows[0].result;
}

async function transformed4326(db, x, y) {
  const row = await withOwnerTransaction(db, async () => (await db.query(`select
      extensions.st_x(extensions.st_transform(extensions.st_setsrid(extensions.st_makepoint($1,$2),32651),4326)) longitude,
      extensions.st_y(extensions.st_transform(extensions.st_setsrid(extensions.st_makepoint($1,$2),32651),4326)) latitude`, [x, y])).rows[0]);
  return { longitude: Number(row.longitude), latitude: Number(row.latitude) };
}

test("M03 protected georeferencing evidence and working-CRS validation", async (t) => {
  const db = await createTestDatabase();
  try {
    await seedGisFixtures(db);
    await gisLogin(db);

    await t.test("M03 objects and exact RPCs exist", async () => {
      const functions = await withOwnerTransaction(db, async () => {
        for (const relation of ["georeferencing_run", "georeferencing_run_point", "georeferencing_validation"])
          assert.equal((await db.query("select to_regclass($1) name", [`public.${relation}`])).rows[0].name, relation);
        for (const name of ["georeferencing_validation_result", "georeferencing_validation_summary"])
          assert.equal((await db.query("select to_regclass($1) name", [`gis_private.${name}`])).rows[0].name, `gis_private.${name}`);
        return (await db.query(`select proname,pg_get_function_identity_arguments(oid) args from pg_proc
          where pronamespace='public'::regnamespace and proname like 'staff_%georeferencing_run' order by proname`)).rows;
      });
      assert.deepEqual(functions, [
        { proname: "staff_review_georeferencing_run", args: "p_run_id uuid, p_expected_revision integer, p_decision text, p_acknowledgements jsonb, p_notes text, p_request_id uuid" },
        { proname: "staff_save_georeferencing_run", args: "p_run_id uuid, p_expected_revision integer, p_values jsonb, p_memberships jsonb, p_results jsonb, p_request_id uuid" },
      ]);
    });

    await t.test("canonical SQL preserves both 4326 inputs and returns the exact five-metre working-CRS distance", async () => {
      const release = await createRelease(db);
      const observed = await transformed4326(db, 500000, 1437000);
      const transformed = await transformed4326(db, 500003, 1437004);
      const gcp = await point(db, "GCP");
      const validation = await point(db, "VALIDATION");
      const gcpCapture = await acceptedCapture(db, gcp.id, observed.longitude, observed.latitude);
      const validationCapture = await acceptedCapture(db, validation.id, observed.longitude, observed.latitude);
      const saved = await saveRun(db, null, null, runValues(release.id), [
        { point_id: gcp.id, capture_id: gcpCapture.id, role: "FITTING", source_x: 100, source_y: 100, fitting_residual_m: 999 },
        { point_id: validation.id, capture_id: validationCapture.id, role: "VALIDATION", source_x: 200, source_y: 200 },
      ], [{ point_id: validation.id, transformed_longitude: transformed.longitude, transformed_latitude: transformed.latitude, review_state: "reviewed" }]);
      const result = await withOwnerTransaction(db, async () =>
        (await db.query("select * from gis_private.georeferencing_validation_result where run_id=$1", [saved.id])).rows[0]);
      assert.equal(result.working_srid, 32651);
      assert.equal(result.observed_srid, 4326);
      assert.equal(result.transformed_plan_srid, 4326);
      assert.ok(Math.abs(Number(result.validation_error_m) - 5) <= 1e-6, result.validation_error_m);
      assert.notEqual(Number(result.validation_error_m), 999);
    });

    await t.test("membership roles, accepted captures, coordinate bounds, and metric pilot CRS are database-enforced", async () => {
      const release = await createRelease(db);
      const gcp = await point(db, "GCP");
      const validation = await point(db, "VALIDATION");
      const observed = await transformed4326(db, 500000, 1437000);
      const gcpCapture = await acceptedCapture(db, gcp.id, observed.longitude, observed.latitude);
      const validationCapture = await acceptedCapture(db, validation.id, observed.longitude, observed.latitude);
      const base = runValues(release.id);
      await assert.rejects(saveRun(db, null, null, base,
        [{ point_id: validation.id, capture_id: validationCapture.id, role: "FITTING", source_x: 1, source_y: 1 }], []), /role|validation|fitting/i);
      await assert.rejects(saveRun(db, null, null, { ...base, run_code: `bad-${randomUUID()}` },
        [{ point_id: gcp.id, capture_id: gcpCapture.id, role: "VALIDATION", source_x: 1, source_y: 1 }], []), /role|gcp|validation/i);
      await assert.rejects(saveRun(db, null, null, { ...base, run_code: `duplicate-${randomUUID()}` }, [
        { point_id: gcp.id, capture_id: gcpCapture.id, role: "FITTING", source_x: 1, source_y: 1 },
        { point_id: gcp.id, capture_id: gcpCapture.id, role: "VALIDATION", source_x: 2, source_y: 2 },
      ], []), /duplicate|once|role|unique/i);
      for (const [changes, error] of [
        [{ working_srid: 4326 }, /working|metric|32651|srid/i],
        [{ working_srid: 999999 }, /working|metric|spatial|srid/i],
        [{ output_srid: 32651 }, /output|4326|srid/i],
      ]) await assert.rejects(saveRun(db, null, null, { ...base, run_code: `crs-${randomUUID()}`, ...changes },
        [{ point_id: gcp.id, capture_id: gcpCapture.id, role: "FITTING", source_x: 1, source_y: 1 }], []), error);
      const fullRelease = await createRelease(db, releaseValues({ scope_kind: "full", pilot_area_id: null }));
      await assert.rejects(saveRun(db, null, null, runValues(fullRelease.id, { working_srid: 4978 }),
        [{ point_id: gcp.id, capture_id: gcpCapture.id, role: "FITTING", source_x: 1, source_y: 1 }], []),
      /projected|metric|working|srid/i);
      const syntheticFootSrid = 990001;
      const syntheticFootWkt = `PROJCRS["Synthetic foot grid",BASEGEOGCRS["WGS 84",
        DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563,
        LENGTHUNIT["metre",1]]]],CONVERSION["Synthetic",METHOD["Transverse Mercator"]],
        CS[Cartesian,2],AXIS["easting",east],AXIS["northing",north],
        LENGTHUNIT["US survey foot",0.3048006096012192]]`;
      await gisLogin(db, gisActors.admin, "postgres");
      await db.query(`insert into extensions.spatial_ref_sys(srid,auth_name,auth_srid,srtext,proj4text)
        values($1,'SYNTHETIC',$1,$2,$3)`, [syntheticFootSrid, syntheticFootWkt,
        "+proj=tmerc +lat_0=0 +lon_0=123 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=us-ft +no_defs"]);
      const installedFoot = (await db.query("select srtext from extensions.spatial_ref_sys where srid=$1", [syntheticFootSrid])).rows[0].srtext;
      assert.match(installedFoot, /^PROJCRS\[/);
      assert.match(installedFoot, /LENGTHUNIT\["metre",1\]/);
      assert.match(installedFoot, /LENGTHUNIT\["US survey foot",0\.3048006096012192\]/);
      await gisLogin(db);
      await assert.rejects(saveRun(db, null, null, runValues(fullRelease.id, { run_code: `foot-${randomUUID()}`, working_srid: syntheticFootSrid }),
        [{ point_id: gcp.id, capture_id: gcpCapture.id, role: "FITTING", source_x: 1, source_y: 1 }], []),
      /allowlist|projected|metric|working|srid/i);
      for (const badCoordinate of [-1, 1001, "NaN", "Infinity"])
        await assert.rejects(saveRun(db, null, null, { ...base, run_code: `pixel-${randomUUID()}` },
          [{ point_id: gcp.id, capture_id: gcpCapture.id, role: "FITTING", source_x: badCoordinate, source_y: 1 }], []), /source|coordinate|finite|dimension|range/i);

      const draftCapture = await recordedCapture(db, gcp.id, observed.longitude, observed.latitude);
      await assert.rejects(saveRun(db, null, null, { ...base, run_code: `draft-${randomUUID()}` },
        [{ point_id: gcp.id, capture_id: draftCapture.id, role: "FITTING", source_x: 1, source_y: 1 }], []), /accepted|frozen|capture/i);
      const rejectedCapture = await recordedCapture(db, gcp.id, observed.longitude, observed.latitude);
      await db.query("select public.staff_review_survey_capture($1::uuid,1,'rejected','[]'::jsonb,'synthetic rejection',$2::uuid)", [rejectedCapture.id, randomUUID()]);
      await assert.rejects(saveRun(db, null, null, { ...base, run_code: `rejected-${randomUUID()}` },
        [{ point_id: gcp.id, capture_id: rejectedCapture.id, role: "FITTING", source_x: 1, source_y: 1 }], []), /accepted|frozen|capture/i);
      const otherGcp = await point(db, "GCP");
      await assert.rejects(saveRun(db, null, null, { ...base, run_code: `wrong-point-${randomUUID()}` },
        [{ point_id: otherGcp.id, capture_id: gcpCapture.id, role: "FITTING", source_x: 1, source_y: 1 }], []), /point|capture|foreign key|mismatch/i);
      const otherSiteGcp = await point(db, "GCP", `other-${randomUUID()}`, "2");
      const otherSiteCapture = await acceptedCapture(db, otherSiteGcp.id, observed.longitude, observed.latitude);
      await assert.rejects(saveRun(db, null, null, { ...base, run_code: `wrong-site-${randomUUID()}` },
        [{ point_id: otherSiteGcp.id, capture_id: otherSiteCapture.id, role: "FITTING", source_x: 1, source_y: 1 }], []), /site|foreign key|mismatch/i);
    });

    await t.test("independent validation aggregates exclude fitting residuals and zero results remain null", async () => {
      const release = await createRelease(db);
      const origin = await transformed4326(db, 500000, 1437000);
      const gcp = await point(db, "GCP");
      const gcpCapture = await acceptedCapture(db, gcp.id, origin.longitude, origin.latitude);
      const memberships = [{ point_id: gcp.id, capture_id: gcpCapture.id, role: "FITTING", source_x: 1, source_y: 1, fitting_residual_m: 1000 }];
      const results = [];
      for (const [index, metres] of [3, 5, 10].entries()) {
        const validation = await point(db, "VALIDATION");
        const capture = await acceptedCapture(db, validation.id, origin.longitude, origin.latitude);
        const transformed = await transformed4326(db, 500000 + metres, 1437000);
        memberships.push({ point_id: validation.id, capture_id: capture.id, role: "VALIDATION", source_x: 10 + index, source_y: 10 + index });
        results.push({ point_id: validation.id, transformed_longitude: transformed.longitude, transformed_latitude: transformed.latitude, review_state: "reviewed" });
      }
      const run = await saveRun(db, null, null, runValues(release.id, { processing_parameters: { expected_validation_count: 3 } }), memberships, results);
      const summary = await withOwnerTransaction(db, async () =>
        (await db.query("select * from gis_private.georeferencing_validation_summary where run_id=$1", [run.id])).rows[0]);
      assert.equal(summary.fitting_point_count, 1);
      assert.equal(summary.validation_point_count, 3);
      assert.equal(summary.expected_validation_count, 3);
      assert.equal(summary.measured_validation_count, 3);
      assert.equal(summary.missing_validation_result_count, 0);
      assert.ok(Math.abs(Number(summary.average_validation_error_m) - 6) <= 1e-6);
      assert.ok(Math.abs(Number(summary.median_validation_error_m) - 5) <= 1e-6);
      assert.ok(Math.abs(Number(summary.maximum_validation_error_m) - 10) <= 1e-6);

      const emptyRelease = await createRelease(db);
      const emptyRun = await saveRun(db, null, null, runValues(emptyRelease.id, { processing_parameters: {} }), memberships.slice(0, 1), []);
      const empty = await withOwnerTransaction(db, async () =>
        (await db.query("select * from gis_private.georeferencing_validation_summary where run_id=$1", [emptyRun.id])).rows[0]);
      assert.equal(empty.measured_validation_count, 0);
      assert.equal(empty.average_validation_error_m, null);
      assert.equal(empty.median_validation_error_m, null);
      assert.equal(empty.maximum_validation_error_m, null);
      await assert.rejects(reviewRun(db, emptyRun.id, 1, "accepted", ["fitting_count_below_target", "validation_count_below_target"]), /independent|validation|result/i);
    });

    await t.test("review requires complete reviewed independent results and acknowledgements then freezes and selects the accepted run", async () => {
      const release = await createRelease(db);
      const origin = await transformed4326(db, 500000, 1437000);
      const transformed = await transformed4326(db, 500003, 1437004);
      const validation = await point(db, "VALIDATION");
      const capture = await acceptedCapture(db, validation.id, origin.longitude, origin.latitude);
      const unreviewedRelease = await createRelease(db);
      const unreviewed = await saveRun(db, null, null, runValues(unreviewedRelease.id),
        [{ point_id: validation.id, capture_id: capture.id, role: "VALIDATION", source_x: 1, source_y: 1 }],
        [{ point_id: validation.id, transformed_longitude: transformed.longitude, transformed_latitude: transformed.latitude, review_state: "draft" }]);
      await assert.rejects(reviewRun(db, unreviewed.id, 1, "accepted", ["fitting_count_below_target", "validation_count_below_target"]), /independent|validation|result/i);
      const run = await saveRun(db, null, null, runValues(release.id),
        [{ point_id: validation.id, capture_id: capture.id, role: "VALIDATION", source_x: 1, source_y: 1 }],
        [{ point_id: validation.id, transformed_longitude: transformed.longitude, transformed_latitude: transformed.latitude, review_state: "reviewed" }]);
      await assert.rejects(reviewRun(db, run.id, 1, "accepted"), /acknowledge|protocol|target/i);
      const accepted = await reviewRun(db, run.id, 1, "accepted", ["fitting_count_below_target", "validation_count_below_target"]);
      assert.equal(accepted.state, "accepted");
      assert.equal(accepted.revision, 2);
      assert.equal((await db.query("select selected_run_id from public.mapping_release where release_id=$1", [release.id])).rows[0].selected_run_id, run.id);
      await assert.rejects(saveRun(db, run.id, 2, { notes: "changed" }, [], []), /accepted|frozen/i);
      await assert.rejects(reviewRun(db, run.id, 2, "rejected"), /accepted|frozen|terminal/i);
    });

    await t.test("save/review retries are idempotent conflict-safe and receipt/audit payloads are private", async () => {
      const release = await createRelease(db);
      const request = randomUUID();
      const values = runValues(release.id);
      const origin = await transformed4326(db, 500000, 1437000);
      const transformed = await transformed4326(db, 500003, 1437004);
      const validation = await point(db, "VALIDATION");
      const capture = await acceptedCapture(db, validation.id, origin.longitude, origin.latitude);
      const memberships = [{ point_id: validation.id, capture_id: capture.id, role: "VALIDATION", source_x: 1, source_y: 1 }];
      const results = [{ point_id: validation.id, transformed_longitude: transformed.longitude, transformed_latitude: transformed.latitude, review_state: "reviewed" }];
      const first = await saveRun(db, null, null, values, memberships, results, request);
      assert.deepEqual(await saveRun(db, null, null, values, memberships, results, request), first);
      await assert.rejects(saveRun(db, null, null, { ...values, notes: "changed" }, memberships, results, request), /conflict|reused/i);
      assert.equal((await db.query("select count(*)::int n from public.georeferencing_run where run_id=$1", [first.id])).rows[0].n, 1);
      assert.equal((await db.query("select count(*)::int n from public.georeferencing_run_point where run_id=$1", [first.id])).rows[0].n, 1);
      assert.equal((await db.query(`select count(*)::int n from public.georeferencing_validation v
        join public.georeferencing_run_point rp using(run_point_id) where rp.run_id=$1`, [first.id])).rows[0].n, 1);
      const reviewRequest = randomUUID();
      const rejected = await reviewRun(db, first.id, 1, "rejected", [], "PRIVATE_REVIEW_NOTE", reviewRequest);
      assert.deepEqual(await reviewRun(db, first.id, 1, "rejected", [], "PRIVATE_REVIEW_NOTE", reviewRequest), rejected);
      await assert.rejects(reviewRun(db, first.id, 2, "rejected", [], "changed", reviewRequest), /conflict|reused/i);
      await gisLogin(db, gisActors.admin, "postgres");
      const receipt = (await db.query("select response from gis_private.gis_mutation_request where request_id=$1", [request])).rows[0].response;
      assert.deepEqual(Object.keys(receipt).sort(), ["id", "requestId", "revision", "schemaVersion", "state"]);
      const audit = (await db.query("select old_values,new_values from public.audit_log where table_name='georeferencing_run' and record_id=$1", [first.id])).rows;
      assert.doesNotMatch(JSON.stringify({ receipt, audit }), /PRIVATE_|source_x|longitude|latitude|artifact|operator|processing/i);
      await gisLogin(db);
    });

    await t.test("authorization RLS ACL direct-write denial private-helper denial and catalog contracts", async () => {
      for (const [actor, role] of [[gisActors.manager, "authenticated"], [gisActors.inactive, "authenticated"], [null, "anon"], [gisActors.admin, "service_role"]]) {
        await gisLogin(db, actor, role);
        await assert.rejects(saveRun(db, null, null, {}, [], []), /administrator|permission denied|admin/i);
        await assert.rejects(reviewRun(db, randomUUID(), 1, "accepted"), /administrator|permission denied|admin/i);
        for (const table of ["georeferencing_run", "georeferencing_run_point", "georeferencing_validation"])
          if (role === "authenticated") assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
          else await assert.rejects(db.exec(`select * from public.${table}`), /permission denied/i);
        for (const view of ["georeferencing_validation_result", "georeferencing_validation_summary"])
          await assert.rejects(db.exec(`select * from gis_private.${view}`), /permission denied/i);
      }
      await gisLogin(db, gisActors.admin, "postgres");
      for (const table of ["georeferencing_run", "georeferencing_run_point", "georeferencing_validation"]) {
        assert.equal((await db.query("select relrowsecurity from pg_class where oid=$1::regclass", [`public.${table}`])).rows[0].relrowsecurity, true);
        for (const role of ["anon", "authenticated", "service_role"])
          for (const privilege of ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"])
            assert.equal((await db.query("select has_table_privilege($1,$2,$3) ok", [role, `public.${table}`, privilege])).rows[0].ok, false);
      }
      const constraints = (await db.query(`select conname from pg_constraint where conname in (
        'georeferencing_run_release_site_fkey','georeferencing_run_point_run_scope_fkey',
        'georeferencing_run_point_point_site_fkey','georeferencing_run_point_capture_fkey',
        'georeferencing_run_point_once_key','georeferencing_validation_run_point_id_fkey',
        'mapping_release_selected_run_fkey') order by conname`)).rows.map(row => row.conname);
      assert.deepEqual(constraints, [
        "georeferencing_run_point_capture_fkey", "georeferencing_run_point_once_key",
        "georeferencing_run_point_point_site_fkey", "georeferencing_run_point_run_scope_fkey",
        "georeferencing_run_release_site_fkey", "georeferencing_validation_run_point_id_fkey",
        "mapping_release_selected_run_fkey",
      ]);
      const indexes = (await db.query(`select schemaname,tablename,indexname from pg_indexes
        where indexname in ('georeferencing_run_release_site_idx','georeferencing_run_point_run_role_idx',
          'georeferencing_run_point_point_idx','georeferencing_run_point_capture_idx','mapping_release_selected_run_idx')`)).rows;
      assert.equal(indexes.length, 5);
      for (const view of ["georeferencing_validation_result", "georeferencing_validation_summary"])
        assert.ok((await db.query("select reloptions from pg_class where oid=$1::regclass", [`gis_private.${view}`])).rows[0].reloptions.includes("security_invoker=true"));
      await gisLogin(db);
      for (const sql of [
        "insert into public.georeferencing_run(release_id,site_id,run_code,source_reference,source_hash,source_coordinate_space,working_srid,output_srid,method,processed_at,qgis_version,output_artifact_reference,output_artifact_hash) values(gen_random_uuid(),1,'x','x',repeat('a',64),'pixels',32651,4326,'x',now(),'x','x',repeat('b',64))",
        "update public.georeferencing_run set notes='forged'",
        "delete from public.georeferencing_run_point",
        "delete from public.georeferencing_validation",
      ]) await assert.rejects(db.exec(sql), /permission denied/i);
      await gisLogin(db, gisActors.admin, "postgres");
      const fns = (await db.query(`select n.nspname,p.proname,p.prosecdef,p.proconfig,p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where (n.nspname='public' and p.proname like 'staff_%georeferencing_run') or
          (n.nspname='gis_private' and p.proname like '%georeferencing%')`)).rows;
      for (const fn of fns) {
        assert.equal(fn.prosecdef, fn.nspname === "public");
        assert.deepEqual(fn.proconfig, ["search_path=pg_catalog, extensions, pg_temp"]);
        for (const role of ["anon", "authenticated", "service_role"])
          assert.equal((await db.query("select has_function_privilege($1,$2::oid,'EXECUTE') ok", [role, fn.oid])).rows[0].ok, role === "authenticated" && fn.nspname === "public");
      }
      const types = await readFile(new URL("../src/lib/supabase/database.types.ts", import.meta.url), "utf8");
      for (const token of ["georeferencing_run:", "georeferencing_run_point:", "georeferencing_validation:", "staff_save_georeferencing_run:", "staff_review_georeferencing_run:"])
        assert.ok(types.includes(token), `missing generated type: ${token}`);
      await gisLogin(db);
    });
  } finally {
    await db.close();
  }
});
