import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createTestDatabase } from "./database-helper.mjs";
import { gisActors, gisLogin, seedGisFixtures, withOwnerTransaction } from "./gis-fixtures.mjs";

const readings = [
  [13, 123, 9], [13.1, 123.1, 7], [13.2, 123.2, 5],
  [13.3, 123.3, 3], [14, 124, 1],
];
const start = "2026-09-28T01:00:00Z";
const end = "2026-09-28T01:10:00Z";
function observations(data = readings) {
  return data.map(([latitude, longitude, reported_accuracy_m], i) => ({
    observation_order: i + 1, latitude, longitude, reported_accuracy_m,
    captured_at: new Date(Date.parse(start) + (i + 1) * 60_000).toISOString(),
  }));
}
async function point(db, values = {}, requestId = randomUUID()) {
  const payload = { site_id: "1", point_code: `fictional-${randomUUID()}`, role: "GCP", description: "Synthetic point", ...values };
  const result = (await db.query("select public.staff_save_survey_point(null,null,$1::jsonb,$2::uuid) result", [JSON.stringify(payload), requestId])).rows[0].result;
  return { ...result, values: payload };
}
async function savePoint(db, id, revision, values, requestId = randomUUID()) {
  return (await db.query("select public.staff_save_survey_point($1::uuid,$2::integer,$3::jsonb,$4::uuid) result", [id, revision, JSON.stringify(values), requestId])).rows[0].result;
}
async function capture(db, pointId, data = observations(), meta = {}, requestId = randomUUID(), captureCode = `session-${randomUUID()}`) {
  const payload = { started_at: start, ended_at: end, device_reference: "PRIVATE_DEVICE", operator_reference: "PRIVATE_OPERATOR", notes: "PRIVATE_CAPTURE_NOTE", ...meta };
  const result = (await db.query("select public.staff_record_survey_capture($1::uuid,$2::text,$3::jsonb,$4::jsonb,$5::uuid) result", [pointId, captureCode, JSON.stringify(payload), JSON.stringify(data), requestId])).rows[0].result;
  return { ...result, meta: payload, data, captureCode };
}
async function review(db, id, revision, decision, acknowledgements = [], notes = "PRIVATE_REVIEW_NOTE", requestId = randomUUID()) {
  return (await db.query("select public.staff_review_survey_capture($1::uuid,$2::integer,$3::text,$4::jsonb,$5::text,$6::uuid) result", [id, revision, decision, JSON.stringify(acknowledgements), notes, requestId])).rows[0].result;
}
async function summary(db, id) {
  return (await db.query("select observation_count,median_latitude,median_longitude,average_reported_accuracy_m,best_reported_accuracy_m,st_astext(representative_point) representative_point,protocol_flags,remeasures_capture_id,review_state from gis_private.survey_capture_summary where capture_id=$1", [id])).rows[0];
}
async function raw(db, id) {
  return (await db.query("select observation_order,latitude,longitude,reported_accuracy_m,captured_at from public.survey_observation where capture_id=$1 order by observation_order", [id])).rows;
}

test("M02 immutable field evidence and SQL summaries", async (t) => {
  const db = await createTestDatabase();
  try {
    await seedGisFixtures(db);
    await gisLogin(db);
    await t.test("five independent readings yield exact SQL medians, accuracy summaries, and Point4326", async () => {
      const p = await point(db); const c = await capture(db, p.id);
      await gisLogin(db, gisActors.admin, "postgres");
      const s = await summary(db, c.id);
      assert.equal(s.observation_count, 5);
      assert.ok(Math.abs(Number(s.median_latitude) - 13.2) < 1e-12);
      assert.ok(Math.abs(Number(s.median_longitude) - 123.2) < 1e-12);
      assert.equal(Number(s.average_reported_accuracy_m), 5);
      assert.equal(Number(s.best_reported_accuracy_m), 1);
      assert.equal(s.representative_point, "POINT(123.2 13.2)");
      assert.deepEqual(s.protocol_flags, ["review_pending"]);
      assert.equal((await raw(db, c.id)).length, 5);
      await gisLogin(db);
    });
    await t.test("four, six, and zero observations are all retained and summarized", async () => {
      const p = await point(db);
      const four = await capture(db, p.id, observations(readings.slice(0, 4)));
      const six = await capture(db, p.id, observations([...readings, [14.2, 124.2, 1000000000]]));
      const zero = await capture(db, p.id, []);
      await gisLogin(db, gisActors.admin, "postgres");
      const a = await summary(db, four.id); const b = await summary(db, six.id); const c = await summary(db, zero.id);
      assert.equal(a.observation_count, 4);
      assert.ok(Math.abs(Number(a.median_latitude) - 13.15) < 1e-12);
      assert.ok(Math.abs(Number(a.median_longitude) - 123.15) < 1e-12);
      assert.ok(a.protocol_flags.includes("fewer_than_five"));
      assert.equal(b.observation_count, 6); assert.equal((await raw(db, six.id)).length, 6);
      assert.ok(b.protocol_flags.includes("more_than_five"));
      assert.equal(Number(b.best_reported_accuracy_m), 1);
      assert.ok(Number(b.average_reported_accuracy_m) > 100000000);
      assert.equal(c.observation_count, 0);
      for (const key of ["median_latitude", "median_longitude", "average_reported_accuracy_m", "best_reported_accuracy_m", "representative_point"])
        assert.equal(c[key], null);
      assert.ok(c.protocol_flags.includes("fewer_than_five"));
      const hundred = await capture(db, p.id, observations(Array.from({ length: 100 }, (_, i) => [13 + i / 10000, 123, 1])));
      assert.equal((await summary(db, hundred.id)).observation_count, 100);
      assert.equal((await raw(db, hundred.id)).length, 100);
      await gisLogin(db);
      await assert.rejects(review(db, zero.id, 1, "accepted", ["fewer_than_five"]), /representative|observation|empty/i);
    });
    await t.test("timestamp deviations and incomplete sessions return flags without discarding readings", async () => {
      const p = await point(db);
      const data = observations();
      data[1].captured_at = data[0].captured_at;
      data[2].captured_at = "2026-09-28T00:59:00Z";
      const c = await capture(db, p.id, data, { ended_at: null });
      await gisLogin(db, gisActors.admin, "postgres");
      const s = await summary(db, c.id);
      for (const flag of ["repeated_timestamp", "non_increasing_timestamp", "outside_session", "incomplete_capture"])
        assert.ok(s.protocol_flags.includes(flag), `${flag}: ${JSON.stringify(s.protocol_flags)}`);
      assert.equal((await raw(db, c.id)).length, 5);
      await gisLogin(db);
      await assert.rejects(review(db, c.id, 1, "accepted"), /acknowledge|protocol/i);
      const accepted = await review(db, c.id, 1, "accepted", s.protocol_flags);
      assert.equal(accepted.state, "accepted");
    });
    await t.test("non-adjacent duplicate timestamps are flagged independently of order", async () => {
      const p = await point(db); const data = observations();
      data[2].captured_at = data[0].captured_at; // t1, t2, t1
      const c = await capture(db, p.id, data);
      await gisLogin(db, gisActors.admin, "postgres");
      const s = await summary(db, c.id);
      assert.equal(s.observation_count, 5);
      assert.ok(s.protocol_flags.includes("repeated_timestamp"));
      assert.ok(s.protocol_flags.includes("non_increasing_timestamp"));
      assert.equal((await raw(db, c.id)).length, 5);
      await gisLogin(db);
    });
    await t.test("point identity, role, site, lineage, and retirement remain protected", async () => {
      const pointRequest = randomUUID(); const pointValues = { site_id: "1", point_code: `retry-${randomUUID()}`, role: "GCP", description: "Synthetic point" };
      const first = (await db.query("select public.staff_save_survey_point(null,null,$1::jsonb,$2::uuid) result", [JSON.stringify(pointValues), pointRequest])).rows[0].result;
      assert.deepEqual((await db.query("select public.staff_save_survey_point(null,null,$1::jsonb,$2::uuid) result", [JSON.stringify(pointValues), pointRequest])).rows[0].result, first);
      await assert.rejects(db.query("select public.staff_save_survey_point(null,null,$1::jsonb,$2::uuid)", [JSON.stringify({ ...pointValues, description: "changed" }), pointRequest]), /conflict|reused/i);
      assert.equal((await db.query("select count(*)::int n from public.survey_point where point_id=$1", [first.id])).rows[0].n, 1);
      const p = await point(db); const other = await point(db, { role: "VALIDATION" });
      await assert.rejects(savePoint(db, p.id, 1, { role: "VALIDATION" }), /immutable|role|identity/i);
      await assert.rejects(savePoint(db, p.id, 1, { site_id: "2" }), /immutable|site|identity/i);
      await assert.rejects(savePoint(db, p.id, 1, { point_code: "changed" }), /immutable|code|identity/i);
      await assert.rejects(point(db, { point_code: p.values.point_code }), /duplicate|unique/i);
      await assert.rejects(point(db, { role: "GCP", predecessor_point_id: other.id }), /role|lineage|predecessor/i);
      const retired = await savePoint(db, p.id, 1, { review_state: "retired" });
      assert.equal(retired.state, "retired");
      await assert.rejects(savePoint(db, p.id, 2, { review_state: "draft" }), /retired|terminal/i);
    });
    await t.test("capture retry is idempotent, conflict-safe, and raw receipt is bounded", async () => {
      const p = await point(db); const request = randomUUID(); const code = `session-${randomUUID()}`;
      const data = observations(); const meta = { started_at: start, ended_at: end, notes: "PRIVATE_CAPTURE_NOTE" };
      const c = await capture(db, p.id, data, meta, request, code);
      assert.deepEqual((await capture(db, p.id, data, meta, request, code)).id, c.id);
      await assert.rejects(capture(db, p.id, [...data, data[0]], meta, request, code), /conflict|reused/i);
      await gisLogin(db, gisActors.admin, "postgres");
      assert.equal((await raw(db, c.id)).length, 5);
      const receipt = (await db.query("select response from gis_private.gis_mutation_request where request_id=$1", [request])).rows[0].response;
      assert.deepEqual(Object.keys(receipt).sort(), ["id", "requestId", "revision", "schemaVersion", "state"]);
      assert.doesNotMatch(JSON.stringify(receipt), /PRIVATE_|latitude|longitude|accuracy|device|operator/i);
      await gisLogin(db);
    });
    await t.test("remeasurement makes a new same-point capture without reopening accepted original", async () => {
      const p = await point(db); const other = await point(db);
      const first = await capture(db, p.id);
      await review(db, first.id, 1, "accepted");
      const second = await capture(db, p.id, observations(readings.slice(0, 4)), { remeasures_capture_id: first.id, remeasure_required: true });
      assert.notEqual(first.id, second.id);
      await assert.rejects(capture(db, other.id, observations(), { remeasures_capture_id: first.id }), /same point|parent|remeasure|site/i);
      await assert.rejects(capture(db, p.id, observations(), { remeasures_capture_id: randomUUID() }), /parent|foreign key|remeasure/i);
      const third = await capture(db, p.id, observations(), { remeasures_capture_id: second.id });
      await gisLogin(db, gisActors.admin, "postgres");
      assert.equal((await summary(db, second.id)).remeasures_capture_id, first.id);
      assert.ok((await summary(db, second.id)).protocol_flags.includes("remeasurement"));
      assert.ok((await summary(db, second.id)).protocol_flags.includes("remeasure_required"));
      assert.equal((await summary(db, first.id)).review_state, "accepted");
      assert.equal((await raw(db, first.id)).length, 5);
      await withOwnerTransaction(db, async () => {
        await assert.rejects(db.query("update public.survey_capture set remeasures_capture_id=$2 where capture_id=$1", [first.id, second.id]), /freeze|immutable|parent|cycle|protected/i);
      });
      assert.equal((await db.query("select remeasures_capture_id from public.survey_capture where capture_id=$1", [third.id])).rows[0].remeasures_capture_id, second.id);
      await gisLogin(db);
    });
    await t.test("owner receipt fixtures reject equal-time parent, self-parent, and cyclic lineage changes", async () => {
      const p = await point(db);
      const first = await capture(db, p.id);
      const parentAt = (await db.query("select created_at from public.survey_capture where capture_id=$1", [first.id])).rows[0].created_at;
      await withOwnerTransaction(db, async () => {
        await db.query("insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash) values($1,$2,'staff_record_survey_capture',$3)", [randomUUID(),gisActors.admin,"f".repeat(64)]);
        const child = randomUUID();
        await db.exec("savepoint equal_parent_time");
        await assert.rejects(db.query(`insert into public.survey_capture(capture_id,point_id,site_id,capture_code,started_at,remeasures_capture_id,created_at,created_by)
          values($1,$2,1,$3,$4,$5,$6,$7)`, [child,p.id,`equal-${randomUUID()}`,start,first.id,parentAt,gisActors.admin]), /parent.*older/i);
        await db.exec("rollback to savepoint equal_parent_time");
        await db.exec("savepoint self_parent");
        await assert.rejects(db.query(`insert into public.survey_capture(capture_id,point_id,site_id,capture_code,started_at,remeasures_capture_id,created_by)
          values($1,$2,1,$3,$4,$1,$5)`, [child,p.id,`self-${randomUUID()}`,start,gisActors.admin]), /self|itself|parent/i);
        await db.exec("rollback to savepoint self_parent");
      });
      let parent; let child;
      await db.exec("begin");
      try {
        parent = await capture(db, p.id);
        child = await capture(db, p.id, observations(), { remeasures_capture_id: parent.id });
        await db.exec("commit");
      } catch (error) { await db.exec("rollback"); throw error; }
      const ordered = (await db.query("select capture_id,created_at from public.survey_capture where capture_id in ($1,$2) order by created_at", [parent.id,child.id])).rows;
      assert.deepEqual(ordered.map(row => row.capture_id), [parent.id, child.id]);
      assert.equal((await db.query(`select child.created_at > parent.created_at strictly_older
        from public.survey_capture parent cross join public.survey_capture child
        where parent.capture_id=$1 and child.capture_id=$2`, [parent.id,child.id])).rows[0].strictly_older, true);
      await withOwnerTransaction(db, async () => {
        await db.query("insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash) values($1,$2,'staff_review_survey_capture',$3)", [randomUUID(),gisActors.admin,"f".repeat(64)]);
        await assert.rejects(db.query(`update public.survey_capture set remeasures_capture_id=$2,review_state='accepted',revision=2,
          reviewed_at=now(),reviewed_by=$3 where capture_id=$1`, [parent.id,child.id,gisActors.admin]), /parent lineage is immutable; cyclic changes are rejected/i);
      });
      assert.equal((await db.query("select remeasures_capture_id from public.survey_capture where capture_id=$1", [parent.id])).rows[0].remeasures_capture_id, null);
    });
    await t.test("raw constraints, app direct writes, accepted freeze, and rejected retention", async () => {
      const p = await point(db); const c = await capture(db, p.id);
      for (const bad of [[91, 123, 1], [13, 181, 1], [13, 123, -1], [13, 123, "Infinity"]])
        await assert.rejects(capture(db, p.id, observations([bad])), /invalid|finite|bound|accuracy|latitude|longitude/i);
      await assert.rejects(capture(db, p.id, observations(), {}, randomUUID(), c.captureCode), /duplicate|unique/i);
      await assert.rejects(capture(db, p.id, observations(Array.from({ length: 101 }, (_, i) => [13 + i / 10000, 123, 1]))), /bound|100/i);
      for (const sql of ["delete from public.survey_observation", "update public.survey_observation set latitude=0", "delete from public.survey_capture", "update public.survey_capture set notes='x'", "insert into public.survey_observation(capture_id,observation_order,latitude,longitude,reported_accuracy_m,captured_at) values(gen_random_uuid(),1,13,123,1,now())", "insert into public.survey_capture(point_id,site_id,capture_code,started_at) values(gen_random_uuid(),1,'x',now())", "insert into public.survey_point(site_id,point_code,role) values(1,'x','GCP')"])
        await assert.rejects(db.exec(sql), /permission denied/i);
      await review(db, c.id, 1, "accepted");
      await withOwnerTransaction(db, async () => {
        for (const [sql, params, error] of [
          ["update public.survey_observation set latitude=0 where capture_id=$1", [c.id], /immutable|append.only|protected/i],
          ["delete from public.survey_observation where capture_id=$1", [c.id], /immutable|append.only|protected/i],
          ["insert into public.survey_observation(capture_id,observation_order,latitude,longitude,reported_accuracy_m,captured_at) values($1,6,13,123,1,now())", [c.id], /accepted|frozen|protected/i],
          ["update public.survey_capture set notes='changed' where capture_id=$1", [c.id], /accepted|frozen|protected/i],
        ]) {
          await db.exec("savepoint evidence_denial");
          await assert.rejects(db.query(sql, params), error);
          await db.exec("rollback to savepoint evidence_denial");
        }
      });
      await gisLogin(db);
      const rejected = await capture(db, p.id);
      await review(db, rejected.id, 1, "rejected", [], "PRIVATE_REJECTION");
      assert.equal((await db.query("select count(*)::int n from public.survey_capture where capture_id=$1", [rejected.id])).rows[0].n, 1);
    });
    await t.test("authorization, RLS, ACL, private summary, and audit privacy", async () => {
      const p = await point(db); const c = await capture(db, p.id);
      await review(db, c.id, 1, "accepted");
      for (const [actor, role] of [[gisActors.manager,"authenticated"], [gisActors.inactive,"authenticated"], [null,"anon"], [gisActors.admin,"service_role"]]) {
        await gisLogin(db, actor, role);
        await assert.rejects(point(db), /administrator|permission denied/i);
        await assert.rejects(capture(db, p.id), /administrator|permission denied/i);
        await assert.rejects(review(db, c.id, 1, "rejected"), /administrator|permission denied/i);
        for (const table of ["survey_point", "survey_capture", "survey_observation"])
          if (role === "authenticated") assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
          else await assert.rejects(db.exec(`select * from public.${table}`), /permission denied/i);
        await assert.rejects(db.exec("select * from gis_private.survey_capture_summary"), /permission denied/i);
      }
      await gisLogin(db, gisActors.admin, "postgres");
      for (const table of ["survey_point", "survey_capture", "survey_observation"]) {
        assert.equal((await db.query("select relrowsecurity from pg_class where oid=$1::regclass", [`public.${table}`])).rows[0].relrowsecurity, true);
        assert.equal((await db.query("select count(*)::int n from pg_policy where polrelid=$1::regclass and polcmd='r'", [`public.${table}`])).rows[0].n, 1);
        for (const role of ["anon","authenticated","service_role"]) {
          for (const privilege of ["INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER"])
            assert.equal((await db.query("select has_table_privilege($1,$2,$3) ok", [role,`public.${table}`,privilege])).rows[0].ok, false);
          assert.equal((await db.query("select has_table_privilege($1,$2,'SELECT') ok", [role,`public.${table}`])).rows[0].ok, role === "authenticated");
        }
      }
      const fns = (await db.query(`select n.nspname,p.proname,p.prosecdef,p.proconfig,p.oid,pg_get_function_identity_arguments(p.oid) args from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where (n.nspname='public' and p.proname like 'staff_%survey_%') or (n.nspname='gis_private' and p.proname in ('evidence_operation','guard_survey_point','guard_survey_capture','guard_survey_observation','audit_evidence'))`)).rows;
      assert.deepEqual(fns.filter(x => x.nspname === "public").map(x => x.proname).sort(), ["staff_record_survey_capture", "staff_review_survey_capture", "staff_save_survey_point"]);
      assert.deepEqual(fns.filter(x => x.nspname === "gis_private").map(x => x.proname).sort(), ["audit_evidence","evidence_operation","guard_survey_capture","guard_survey_observation","guard_survey_point"]);
      const expectedArgs = {
        staff_save_survey_point: "p_point_id uuid, p_expected_revision integer, p_values jsonb, p_request_id uuid",
        staff_record_survey_capture: "p_point_id uuid, p_capture_code text, p_meta jsonb, p_observations jsonb, p_request_id uuid",
        staff_review_survey_capture: "p_capture_id uuid, p_expected_revision integer, p_decision text, p_acknowledgements jsonb, p_notes text, p_request_id uuid",
      };
      for (const f of fns) {
        if (f.nspname === "public") assert.equal(f.args, expectedArgs[f.proname]);
        assert.equal(f.prosecdef, f.nspname === "public");
        assert.deepEqual(f.proconfig, ["search_path=pg_catalog, extensions, pg_temp"]);
        for (const role of ["anon","authenticated","service_role"])
          assert.equal((await db.query("select has_function_privilege($1,$2::oid,'EXECUTE') ok", [role,f.oid])).rows[0].ok, role === "authenticated" && f.nspname === "public");
      }
      assert.equal((await db.query("select has_table_privilege('authenticated','gis_private.survey_capture_summary','SELECT') ok")).rows[0].ok, false);
      assert.ok((await db.query("select reloptions from pg_class where oid='gis_private.survey_capture_summary'::regclass")).rows[0].reloptions.includes("security_invoker=true"));
      for (const role of ["anon","authenticated","service_role"])
        assert.equal((await db.query("select has_schema_privilege($1,'gis_private','USAGE') ok", [role])).rows[0].ok, false);
      const logs = (await db.query("select table_name,old_values,new_values from public.audit_log where record_id in ($1,$2)", [p.id,c.id])).rows;
      assert.ok(logs.length >= 3);
      assert.doesNotMatch(JSON.stringify(logs), /PRIVATE_|latitude|longitude|accuracy|device|operator/i);
      await gisLogin(db);
    });
    await t.test("point actor FKs are indexed and all four account relationships are typed", async () => {
      await gisLogin(db, gisActors.admin, "postgres");
      const indexes = (await db.query("select indexname,indexdef from pg_indexes where schemaname='public' and tablename='survey_point'")).rows;
      for (const column of ["created_by", "updated_by"])
        assert.ok(indexes.some(row => row.indexdef.includes(`(${column})`)), `missing ${column} index`);
      const types = await readFile(new URL("../src/lib/supabase/database.types.ts", import.meta.url), "utf8");
      for (const [table, column] of [["survey_point","created_by"],["survey_point","updated_by"],["survey_capture","created_by"],["survey_capture","reviewed_by"]]) {
        assert.ok(types.includes(`foreignKeyName: "${table}_${column}_fkey"; columns: ["${column}"]; isOneToOne: false; referencedRelation: "account"; referencedColumns: ["account_id"]`), `${table}.${column} account relationship`);
      }
      await gisLogin(db);
    });
  } finally { await db.close(); }
});
