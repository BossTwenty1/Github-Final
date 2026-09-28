import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./database-helper.mjs";
import { gisActors, gisLogin, seedGisFixtures, releaseValues, createRelease, rejectRelease, withOwnerTransaction } from "./gis-fixtures.mjs";

test("M01 protected GIS release foundation", async (t) => {
  const db = await createTestDatabase();
  try {
    await seedGisFixtures(db);
    await gisLogin(db);

    await t.test("active ADMIN creates revision 1 draft with exactly one pilot membership", async () => {
      const request = randomUUID();
      const result = await createRelease(db, releaseValues(), request);
      assert.deepEqual(Object.keys(result).sort(), ["id", "requestId", "revision", "schemaVersion", "state"]);
      assert.equal(result.schemaVersion, 1); assert.equal(result.state, "draft"); assert.equal(result.revision, 1);
      assert.equal(result.requestId, request); assert.match(result.id, /^[0-9a-f-]{36}$/);
      const row = (await db.query("select site_id::text,area_id::text from public.mapping_release_area where release_id=$1", [result.id])).rows;
      assert.deepEqual(row, [{ site_id: "1", area_id: "1" }]);
    });
    await t.test("site/code uniqueness rejects same site but permits another site and case-sensitive code", async () => {
      const code = `unique-${randomUUID()}`;
      await createRelease(db, releaseValues({ release_code: code }));
      await assert.rejects(createRelease(db, releaseValues({ release_code: code })), /duplicate|unique/i);
      assert.equal((await createRelease(db, releaseValues({ site_id: "2", pilot_area_id: "3", release_code: code }))).state, "draft");
      assert.equal((await createRelease(db, releaseValues({ release_code: code.toUpperCase() }))).state, "draft");
    });
    await t.test("MANAGER inactive and anonymous callers cannot create or reject", async () => {
      const release = await createRelease(db);
      for (const [actor, role] of [[gisActors.manager,"authenticated"], [gisActors.inactive,"authenticated"], [null,"anon"], [gisActors.admin,"service_role"]]) {
        await gisLogin(db, actor, role);
        await assert.rejects(createRelease(db), /administrator|permission denied|admin/i);
        await assert.rejects(rejectRelease(db, release.id), /administrator|permission denied|admin/i);
      }
      await gisLogin(db);
    });
    await t.test("ADMIN-only RLS reads hide release data from MANAGER and inactive accounts", async () => {
      await createRelease(db);
      for (const actor of [gisActors.manager, gisActors.inactive]) {
        await gisLogin(db, actor);
        for (const table of ["mapping_release","mapping_release_area","mapping_publication","mapping_publication_event"])
          assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
      }
      await gisLogin(db);
      assert.ok((await db.query("select * from public.mapping_release")).rows.length > 0);
    });
    await t.test("direct writes and client-set GUCs cannot acquire release mutation authority", async () => {
      const release = await createRelease(db);
      for (const setting of ["gis.operation", "gis_private.operation", "app.gis_operation", "app.gis_mutation_authorized"])
        await db.query("select set_config($1,'staff_review_mapping_release',false)", [setting]);
      for (const table of ["mapping_release","mapping_release_area","mapping_publication","mapping_publication_event"]) {
        await assert.rejects(db.exec(`delete from public.${table}`), /permission denied/i);
      }
      await assert.rejects(db.query("update public.mapping_release set status='approved',revision=revision+1 where release_id=$1", [release.id]), /permission denied/i);
      await assert.rejects(db.query("insert into public.mapping_release_area(release_id,site_id,area_id) values($1,1,2)", [release.id]), /permission denied/i);
      // Owner direct writes with identical spoofed settings also lack a private pending receipt.
      await withOwnerTransaction(db, async () => {
        await assert.rejects(db.query("update public.mapping_release set status='staged',revision=2 where release_id=$1", [release.id]), /protected|operation|authority/i);
      });
    });
    await t.test("private helpers and mutation receipts are inaccessible to every application role", async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        await gisLogin(db, gisActors.admin, role);
        for (const sql of [
          "select gis_private.assert_admin()",
          `select gis_private.assert_pilot_scope('${randomUUID()}'::uuid)`,
          `select gis_private.claim_request('${randomUUID()}'::uuid,'create','{}'::jsonb)`,
          `select gis_private.finish_request('${randomUUID()}'::uuid,'{}'::jsonb)`,
          "select gis_private.audit_event('mapping_release','x','insert',null,'{}'::jsonb)",
          "select * from gis_private.gis_mutation_request",
        ]) await assert.rejects(db.exec(sql), /permission denied/i);
      }
      await gisLogin(db);
    });
    await t.test("exact retries return original response before stale revision and conflicts bind actor operation input", async () => {
      const values = releaseValues(); const request = randomUUID();
      const original = await createRelease(db, values, request);
      const reordered = Object.fromEntries(Object.entries(values).reverse());
      assert.deepEqual(await createRelease(db, reordered, request), original);
      await assert.rejects(createRelease(db, { ...values, title: "Changed title" }, request), /conflict|reused/i);
      await gisLogin(db, gisActors.otherAdmin);
      await assert.rejects(createRelease(db, values, request), /conflict|reused/i);
      await gisLogin(db);
      await assert.rejects(rejectRelease(db, original.id, 1, "Reason", request), /conflict|reused/i);
      const rejectionRequest = randomUUID();
      const rejected = await rejectRelease(db, original.id, 1, "Reason", rejectionRequest);
      assert.deepEqual(await rejectRelease(db, original.id, 1, "Reason", rejectionRequest), rejected);
      await assert.rejects(rejectRelease(db, original.id, 2, "Reason", rejectionRequest), /conflict|reused/i);
    });
    await t.test("rejection increments once retains private metadata and is terminal", async () => {
      const release = await createRelease(db);
      await assert.rejects(rejectRelease(db, release.id, 99), /revision|stale/i);
      await assert.rejects(rejectRelease(db, release.id, 1, " "), /reason/i);
      await assert.rejects(rejectRelease(db, release.id, 1, " ".repeat(1048576) + "Reason"), /bound|limit|large/i);
      const result = await rejectRelease(db, release.id);
      assert.equal(result.state, "rejected"); assert.equal(result.revision, 2);
      const row = (await db.query("select notes,rejection_reason,status from public.mapping_release where release_id=$1", [release.id])).rows[0];
      assert.deepEqual(row, { notes: "PRIVATE_SYNTHETIC_NOTE", rejection_reason: "PRIVATE_SYNTHETIC_REJECTION", status: "rejected" });
      await assert.rejects(rejectRelease(db, release.id, 2), /terminal|reject|transition/i);
      assert.equal((await db.query("select count(*)::int n from public.mapping_release_area where release_id=$1", [release.id])).rows[0].n, 1);
    });
    await t.test("pilot_scope_requires_exact_single_existing_area at creation and private gate", async () => {
      for (const changes of [{ pilot_area_id: null }, { pilot_area_id: "999" }, { pilot_area_id: "3" }, { pilot_area_id: "2", site_id: "2" }])
        await assert.rejects(createRelease(db, releaseValues(changes)), /pilot|area|site|foreign key/i);
      const release = await createRelease(db);
      await withOwnerTransaction(db, async () => {
        await db.query("select gis_private.assert_pilot_scope($1)", [release.id]);
        await assert.rejects(db.query("insert into public.mapping_release_area(release_id,site_id,area_id) values($1,1,2)", [release.id]), /scope|pilot|operation|authority/i);
      });
      // Validate helper independently against privileged malformed fixture states.
      for (const corruption of [
        "delete from public.mapping_release_area where release_id=$1",
        "insert into public.mapping_release_area(release_id,site_id,area_id) values($1,1,2)",
        "update public.mapping_release_area set area_id=2 where release_id=$1",
        "update public.area set site_id=2 where area_id=1",
      ]) await withOwnerTransaction(db, async () => {
        await db.exec("alter table public.mapping_release_area disable trigger user");
        await db.query(corruption, corruption.includes("$1") ? [release.id] : []);
        await assert.rejects(db.query("select gis_private.assert_pilot_scope($1)", [release.id]), /pilot|scope|area|site/i);
      });
    });
    await t.test("reserved full scope is draft-only metadata and fails private pilot gate", async () => {
      const result = await createRelease(db, releaseValues({ scope_kind: "full", pilot_area_id: null }));
      assert.equal(result.state, "draft");
      await withOwnerTransaction(db, async () => {
        await assert.rejects(db.query("select gis_private.assert_pilot_scope($1)", [result.id]), /pilot|scope/i);
      });
    });
    await t.test("bounded metadata exact allowlist and string bigint IDs are enforced", async () => {
      for (const changes of [
        { site_id: 1 }, { site_id: "01" }, { site_id: "9223372036854775808" },
        { pilot_area_id: "../1" }, { title: "x".repeat(201) }, { release_code: "bad/code" },
        { release_code: " " }, { package_hash: "A".repeat(64) }, { notes: "x".repeat(2001) },
        { source_plan_reference: "x".repeat(1025) }, { description: { arbitrary: true } },
        { status: "approved" }, { created_by: gisActors.otherAdmin }, { revision: 99 },
        { validation_summary: { arbitrary: true } }, { field_srid: 32651 },
      ]) await assert.rejects(createRelease(db, releaseValues(changes)), /invalid|unsupported|bounded|metadata|SRID|code|hash|text|id|key/i);
      await assert.rejects(createRelease(db, { unknown: "x".repeat(1024 * 1024) }), /bound|limit|large/i);
      const large = await createRelease(db, releaseValues({ site_id: "9007199254740993", pilot_area_id: "9007199254740993" }));
      assert.equal((await db.query("select site_id::text from public.mapping_release where release_id=$1", [large.id])).rows[0].site_id, "9007199254740993");
      const minimal = await createRelease(db, { site_id: "1", pilot_area_id: "1", release_code: `draft-${randomUUID()}`, title: "Draft", scope_kind: "pilot" });
      assert.equal(minimal.state, "draft");
    });
    await t.test("complete lifecycle matrix rejects every skipped or unowned transition", async () => {
      const allowed = new Map([
        ["draft:staged", "staff_seal_mapping_import"], ["staged:staged", "staff_seal_mapping_import"],
        ["validated:staged", "staff_seal_mapping_import"], ["staged:validated", "staff_finalize_mapping_import"],
        ["validated:approved", "staff_review_mapping_release"], ["approved:published", "staff_publish_mapping_release"],
        ["published:superseded", "activate_release"], ["superseded:published", "staff_rollback_mapping_release"],
        ...["draft","staged","validated","approved"].map((state) => [`${state}:rejected`, "staff_reject_mapping_release"]),
      ]);
      const states = ["draft","staged","validated","approved","published","superseded","rejected"];
      const release = await createRelease(db);
      for (const from of states) for (const to of states) {
        if (allowed.has(`${from}:${to}`)) continue;
        await withOwnerTransaction(db, async () => {
          await db.exec("alter table public.mapping_release disable trigger user");
          await db.query("update public.mapping_release set status=$2,revision=1 where release_id=$1", [release.id, from]);
          await db.exec("alter table public.mapping_release enable trigger user");
          await db.query(`insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash)
            values($1,$2,'staff_review_mapping_release',$3)`, [randomUUID(), gisActors.admin, "c".repeat(64)]);
          await assert.rejects(db.query("update public.mapping_release set status=$2,revision=2 where release_id=$1", [release.id, to]), /transition|terminal|frozen|operation/i);
        });
      }
      await withOwnerTransaction(db, async () => {
        await db.query(`insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash)
          values($1,$2,'staff_create_mapping_release',$3)`, [randomUUID(), gisActors.admin, "c".repeat(64)]);
        await assert.rejects(db.query("update public.mapping_release set status='rejected',revision=2 where release_id=$1", [release.id]), /transition|operation/i);
      });
    });
    await t.test("approved snapshots freeze content and membership even when subsequently rejected", async () => {
      const release = await createRelease(db);
      await withOwnerTransaction(db, async () => {
        await db.exec("alter table public.mapping_release disable trigger user");
        await db.query("update public.mapping_release set status='approved',reviewed_at=now(),reviewed_by=$2 where release_id=$1", [release.id, gisActors.admin]);
        await db.exec("alter table public.mapping_release enable trigger user");
        await db.query(`insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash)
          values($1,$2,'staff_reject_mapping_release',$3)`, [randomUUID(), gisActors.admin, "c".repeat(64)]);
        await assert.rejects(db.query("update public.mapping_release set status='rejected',revision=2,title='Changed' where release_id=$1", [release.id]), /frozen|snapshot/i);
      });
      await withOwnerTransaction(db, async () => {
        await assert.rejects(db.query("delete from public.mapping_release_area where release_id=$1", [release.id]), /scope|protected|operation|authority/i);
      });
    });
    await t.test("owning operations support the complete matrix and restage clears validation authority", async () => {
      const release = await createRelease(db);
      const transitions = [
        ["draft","staged","staff_seal_mapping_import"], ["staged","staged","staff_seal_mapping_import"],
        ["validated","staged","staff_seal_mapping_import"], ["staged","validated","staff_finalize_mapping_import"],
        ["validated","approved","staff_review_mapping_release"], ["approved","published","staff_publish_mapping_release"],
        ["published","superseded","staff_publish_mapping_release"], ["published","superseded","staff_rollback_mapping_release"],
        ["superseded","published","staff_rollback_mapping_release"],
        ...["draft","staged","validated","approved"].map((state) => [state,"rejected","staff_reject_mapping_release"]),
      ];
      for (const [from,to,operation] of transitions) await withOwnerTransaction(db, async () => {
        // M03 makes selected_run_id relational. Seed one owner-only synthetic run so
        // this lifecycle-guard fixture keeps exercising restage invalidation with a
        // valid same-release/site reference; restore its guard before assertions.
        const selectedRunId = randomUUID();
        await db.exec("alter table public.georeferencing_run disable trigger user");
        await db.query(`insert into public.georeferencing_run(run_id,release_id,site_id,run_code,source_reference,source_hash,
          source_width,source_height,source_coordinate_space,working_srid,output_srid,method,processed_at,qgis_version,
          output_artifact_reference,output_artifact_hash,created_by)
          values($1,$2,1,$3,'synthetic/plan.png',$4,100,100,'pixels',32651,4326,'synthetic',now(),'3.40',
          'synthetic/output.tif',$5,$6)`, [selectedRunId,release.id,`fixture-${randomUUID()}`,"a".repeat(64),"b".repeat(64),gisActors.admin]);
        await db.exec("alter table public.georeferencing_run enable trigger user");
        await db.exec("alter table public.mapping_release disable trigger user");
        await db.query(`update public.mapping_release set status=$2,revision=1,selected_run_id=$3,validation_report_hash=$4,
          validation_summary='{"schemaVersion":1,"featureCount":2}',validated_at=now(),reviewed_at=now(),published_at=now()
          where release_id=$1`, [release.id,from,selectedRunId,"d".repeat(64)]);
        await db.exec("alter table public.mapping_release enable trigger user");
        await db.query(`insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash)
          values($1,$2,$3,$4)`, [randomUUID(),gisActors.admin,operation,"e".repeat(64)]);
        const row = (await db.query(`update public.mapping_release set status=$2,revision=2,rejection_reason=case when $2='rejected' then 'Reason' else null end
          where release_id=$1 returning status,revision,selected_run_id,validation_report_hash,validation_summary,validated_at,reviewed_at`, [release.id,to])).rows[0];
        assert.equal(row.status,to); assert.equal(row.revision,2);
        if (to==="staged") for (const field of ["selected_run_id","validation_report_hash","validation_summary","validated_at","reviewed_at"])
          assert.equal(row[field],null);
      });
      await withOwnerTransaction(db, async () => {
        await db.exec("alter table public.mapping_release disable trigger user");
        await db.query("update public.mapping_release set status='published',published_at=now() where release_id=$1", [release.id]);
        await db.exec("alter table public.mapping_release enable trigger user");
        await db.query(`insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash)
          values($1,$2,'activate_release',$3)`, [randomUUID(),gisActors.admin,"e".repeat(64)]);
        await assert.rejects(db.query("update public.mapping_release set status='superseded',revision=2 where release_id=$1", [release.id]), /owning operation|transition/i);
      });
    });
    await t.test("rollback requires previously published snapshot and private receipts reject unbounded or raw response payloads", async () => {
      const release = await createRelease(db);
      await withOwnerTransaction(db, async () => {
        await db.exec("alter table public.mapping_release disable trigger user");
        await db.query("update public.mapping_release set status='superseded',published_at=null where release_id=$1", [release.id]);
        await db.exec("alter table public.mapping_release enable trigger user");
        await db.query(`insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash)
          values($1,$2,'staff_rollback_mapping_release',$3)`, [randomUUID(),gisActors.admin,"e".repeat(64)]);
        await assert.rejects(db.query("update public.mapping_release set status='published',revision=2 where release_id=$1", [release.id]), /previously published|snapshot/i);
      });
      const responses = [{}, {schemaVersion:1,id:release.id,revision:1,state:"draft",requestId:randomUUID(),count:{raw:"PRIVATE"}},
        {schemaVersion:1,id:release.id,revision:-1,state:"draft",requestId:randomUUID()}];
      for (const response of responses) await withOwnerTransaction(db, async () => {
        await assert.rejects(db.query(`insert into gis_private.gis_mutation_request(request_id,actor_account_id,operation,input_hash,response)
          values($1,$2,'staff_create_mapping_release',$3,$4::jsonb)`, [randomUUID(),gisActors.admin,"e".repeat(64),JSON.stringify(response)]), /check constraint/i);
      });
    });
    await t.test("GIS audit contains only sanitized metadata and real actor; receipts expose no input notes", async () => {
      const release = await createRelease(db);
      await rejectRelease(db, release.id);
      await gisLogin(db, gisActors.admin, "postgres");
      const rows = (await db.query("select actor_account_id,action,old_values,new_values from public.audit_log where table_name='mapping_release' and record_id=$1 order by audit_id", [release.id])).rows;
      assert.deepEqual(rows.map((r) => r.action), ["insert", "status_change"]);
      for (const row of rows) {
        assert.equal(row.actor_account_id, gisActors.admin);
        assert.doesNotMatch(JSON.stringify(row), /PRIVATE_SYNTHETIC|fictional\/|geometry|operator|device/i);
        for (const meta of [row.old_values,row.new_values].filter(Boolean))
          assert.ok(Object.keys(meta).every((key) => ["schemaVersion","id","revision","state","requestId","siteId","areaId","scopeKind","packageDigest"].includes(key)));
      }
      const receipts = (await db.query("select response from gis_private.gis_mutation_request where response->>'id'=$1", [release.id])).rows;
      assert.equal(receipts.length, 2);
      assert.doesNotMatch(JSON.stringify(receipts), /PRIVATE_SYNTHETIC|fictional\//i);
      await gisLogin(db);
    });
    await t.test("publication history is append-only", async () => {
      const release = await createRelease(db);
      await withOwnerTransaction(db, async () => {
        await db.query(`insert into public.mapping_publication_event(site_id,area_id,new_release_id,request_id,kind,actor_account_id)
          values(1,1,$1,$2,'publish',$3)`, [release.id, randomUUID(), gisActors.admin]);
        await db.exec("savepoint history_write");
        await assert.rejects(db.exec("update public.mapping_publication_event set kind='rollback'"), /append.only|immutable/i);
        await db.exec("rollback to savepoint history_write");
        await assert.rejects(db.exec("delete from public.mapping_publication_event"), /append.only|immutable/i);
      });
    });
    await t.test("later pipeline RPCs are absent at the M01 migration boundary", async () => {
      const m01Db = await createTestDatabase({ throughMigration: "20260928160000_gis_release_foundation.sql" });
      try {
        const later = (await m01Db.query(`select proname from pg_proc where pronamespace='public'::regnamespace
          and proname in ('staff_begin_mapping_import','staff_seal_mapping_import','staff_finalize_mapping_import','staff_review_mapping_release','staff_publish_mapping_release','staff_rollback_mapping_release')`)).rows;
        assert.deepEqual(later, []);
      } finally { await m01Db.close(); }
    });
    await t.test("catalog enforces RLS function profiles pinned search_path and explicit ACLs", async () => {
      await gisLogin(db, gisActors.admin, "postgres");
      assert.equal((await db.query("select to_regclass('public.survey_capture')::text relation")).rows[0].relation, "survey_capture");
      const tables = ["mapping_release","mapping_release_area","mapping_publication","mapping_publication_event"];
      for (const table of tables) {
        const catalog = (await db.query("select relrowsecurity from pg_class where oid=$1::regclass", [`public.${table}`])).rows[0];
        assert.equal(catalog.relrowsecurity, true);
        assert.equal((await db.query("select count(*)::int n from pg_policy where polrelid=$1::regclass and polcmd='r'", [`public.${table}`])).rows[0].n, 1);
        for (const role of ["anon","authenticated","service_role"]) {
          for (const privilege of ["INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER"])
            assert.equal((await db.query("select has_table_privilege($1,$2,$3) ok", [role,`public.${table}`,privilege])).rows[0].ok, false);
          assert.equal((await db.query("select has_table_privilege($1,$2,'SELECT') ok", [role,`public.${table}`])).rows[0].ok, role === "authenticated");
        }
      }
      const functions = (await db.query(`select n.nspname,p.proname,p.prosecdef,p.proconfig,pg_get_function_identity_arguments(p.oid) args,p.oid
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where (n.nspname='gis_private' and p.proname in ('assert_admin','assert_pilot_scope','claim_request',
          'finish_request','audit_event','guard_release','guard_release_area','guard_publication_history'))
          or (n.nspname='public' and p.proname in ('staff_create_mapping_release','staff_reject_mapping_release'))`)).rows;
      assert.equal(functions.length, 10);
      assert.deepEqual(functions.map((fn) => `${fn.nspname}.${fn.proname}`).sort(), [
        'gis_private.assert_admin','gis_private.assert_pilot_scope','gis_private.audit_event',
        'gis_private.claim_request','gis_private.finish_request','gis_private.guard_publication_history',
        'gis_private.guard_release','gis_private.guard_release_area',
        'public.staff_create_mapping_release','public.staff_reject_mapping_release',
      ]);
      for (const fn of functions) {
        assert.equal(fn.prosecdef, fn.nspname === "public");
        assert.deepEqual(fn.proconfig, ["search_path=pg_catalog, extensions, pg_temp"]);
        for (const role of ["anon","authenticated","service_role"])
          assert.equal((await db.query("select has_function_privilege($1,$2::oid,'EXECUTE') ok", [role,fn.oid])).rows[0].ok, role === "authenticated" && fn.nspname === "public");
      }
      for (const role of ["anon","authenticated","service_role"]) {
        assert.equal((await db.query("select has_schema_privilege($1,'gis_private','USAGE') ok", [role])).rows[0].ok, false);
        assert.equal((await db.query("select has_table_privilege($1,'gis_private.gis_mutation_request','SELECT') ok", [role])).rows[0].ok, false);
      }
      await gisLogin(db);
    });
  } finally { await db.close(); }
});
