import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";

import { createTestDatabase } from "./database-helper.mjs";
import { createRelease, gisActors, gisLogin, seedGisFixtures } from "./gis-fixtures.mjs";

const HASH = "a".repeat(64);
const LARGE_ID = "9007199254740993";
const M08 = "20260928230000_gis_read_contracts.sql";

async function asOwner(db, callback) {
  await gisLogin(db, gisActors.admin, "postgres");
  try { return await callback(); }
  finally { await gisLogin(db); }
}

async function disableUserTriggers(db, tables, callback) {
  for (const table of tables) await db.exec(`alter table public.${table} disable trigger user`);
  try { return await callback(); }
  finally {
    for (const table of [...tables].reverse()) await db.exec(`alter table public.${table} enable trigger user`);
  }
}

async function seedReadFixture(db) {
  await seedGisFixtures(db);
  await gisLogin(db);
  const release = await createRelease(db, {
    site_id: "1", pilot_area_id: "1", scope_kind: "pilot",
    release_code: `read-${randomUUID()}`, title: "Synthetic published read fixture",
    package_reference: "synthetic/package", package_hash: HASH,
    source_plan_reference: "synthetic/plan", source_plan_version: "v1",
    source_plan_hash: HASH, source_coordinate_space: "pixels",
    field_srid: 4326, working_srid: 32651, published_srid: 4326, qgis_version: "3.40",
  });
  const runId = randomUUID();

  await asOwner(db, async () => {
    await disableUserTriggers(db, ["lot", "georeferencing_run", "mapping_release", "mapping_boundary", "plot_geometry",
      "mapping_walkway_source", "map_node", "map_edge", "grave_access_point", "mapping_display_feature"], async () => {
      await db.exec(`
        insert into public.lot(lot_id,area_id,lot_code,status,coordinate_status,coordinate_verified,location_geom)
        values
          (101,1,'READ-101','AVAILABLE','pending',false,null),
          (102,1,'READ-102','BOOKED','verified',true,null),
          (103,1,'READ-103','HOLD','rejected',false,extensions.st_geomfromtext('POINT(123.006 13.006)',4326)::extensions.geography),
          (104,1,'READ-104','AVAILABLE','pending',false,null),
          (${LARGE_ID},${LARGE_ID},'READ-LARGE','AVAILABLE','pending',false,null);
        update public.lot set deleted_at=transaction_timestamp() where lot_id=104;

        insert into public.deceased(deceased_id,display_name,public_display)
        values (101,'Visible Synthetic Person',true),(102,'Hidden Synthetic Person',false),
          (103,'Inactive Synthetic Person',true),(104,'Removed-lot Synthetic Person',true);
        insert into public.burial_record(burial_id,deceased_id,lot_id,record_status,interment_status,remains_type,deleted_at)
        values
          (101,101,101,'active','PERMANENT','FRESH',transaction_timestamp()),
          (102,102,102,'active','PERMANENT','FRESH',null),
          (103,103,103,'pending','PERMANENT','FRESH',null),
          (104,104,104,'active','PERMANENT','FRESH',null);

        insert into public.georeferencing_run(run_id,release_id,site_id,run_code,source_reference,source_hash,
          source_width,source_height,source_coordinate_space,working_srid,output_srid,method,processed_at,qgis_version,
          output_artifact_reference,output_artifact_hash,review_state,created_by,reviewed_at,reviewed_by)
        values ('${runId}', '${release.id}',1,'read-run','synthetic/plan', '${HASH}',1000,1000,'pixels',32651,4326,
          'synthetic',transaction_timestamp(),'3.40','synthetic/output','${HASH}','accepted','${gisActors.admin}',
          transaction_timestamp(),'${gisActors.admin}');

        insert into public.mapping_boundary(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,
          artifact_hash,layer_name,layer_version,kind,boundary_geom,review_state,created_by,reviewed_at,reviewed_by)
        values ('${release.id}',1,'${runId}','cemetery','${HASH}','boundaries','v1','cemetery',
          extensions.st_geomfromtext('POLYGON((123 13,123.02 13,123.02 13.02,123 13.02,123 13))',4326),
          'approved','${gisActors.admin}',transaction_timestamp(),'${gisActors.admin}');
        insert into public.mapping_boundary(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,
          artifact_hash,layer_name,layer_version,kind,area_id,boundary_geom,review_state,created_by,reviewed_at,reviewed_by)
        values ('${release.id}',1,'${runId}','area-1','${HASH}','boundaries','v1','area',1,
          extensions.st_geomfromtext('POLYGON((123.001 13.001,123.019 13.001,123.019 13.019,123.001 13.019,123.001 13.001))',4326),
          'approved','${gisActors.admin}',transaction_timestamp(),'${gisActors.admin}');
        insert into public.plot_geometry(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,
          artifact_hash,layer_name,layer_version,lot_id,area_id,plot_geom,review_state,created_by,reviewed_at,reviewed_by)
        values
          ('${release.id}',1,'${runId}','plot-101','${HASH}','plots','v1',101,1,
            extensions.st_geomfromtext('POLYGON((123.005 13.005,123.0052 13.005,123.0052 13.0052,123.005 13.0052,123.005 13.005))',4326),
            'approved','${gisActors.admin}',transaction_timestamp(),'${gisActors.admin}'),
          ('${release.id}',1,'${runId}','plot-102','${HASH}','plots','v1',102,1,
            extensions.st_geomfromtext('POLYGON((123.006 13.005,123.0062 13.005,123.0062 13.0052,123.006 13.0052,123.006 13.005))',4326),
            'approved','${gisActors.admin}',transaction_timestamp(),'${gisActors.admin}');
        insert into public.mapping_walkway_source(walkway_source_id,mapping_release_id,site_id,georeferencing_run_id,
          source_feature_id,artifact_hash,layer_name,layer_version,area_id,walkway_type,walking_allowed,centerline_geom,
          review_state,created_by,reviewed_at,reviewed_by)
        values ('10000000-0000-0000-0000-000000000101','${release.id}',1,'${runId}','walkway-1','${HASH}',
          'walkways','v1',1,'path',true,extensions.st_geomfromtext('LINESTRING(123.001 13.005,123.018 13.005)',4326),
          'approved','${gisActors.admin}',transaction_timestamp(),'${gisActors.admin}');
        insert into public.map_node(node_id,site_id,node_name,node_type,location_geom,mapping_release_id,source_feature_id,
          artifact_hash,layer_name,layer_version,review_state,revision,imported_at,reviewed_at,reviewed_by)
        values
          (1001,1,'Entrance','entrance',extensions.st_geomfromtext('POINT(123.001 13.005)',4326)::extensions.geography,
            '${release.id}','node-entrance','${HASH}','nodes','v1','approved',1,transaction_timestamp(),transaction_timestamp(),'${gisActors.admin}'),
          (1002,1,'Destination','junction',extensions.st_geomfromtext('POINT(123.005 13.005)',4326)::extensions.geography,
            '${release.id}','node-destination','${HASH}','nodes','v1','approved',1,transaction_timestamp(),transaction_timestamp(),'${gisActors.admin}');
        insert into public.map_edge(edge_id,from_node_id,to_node_id,path_geom,distance_m,edge_type,is_restricted,
          mapping_release_id,site_id,source_feature_id,artifact_hash,layer_name,layer_version,review_state,revision,
          imported_at,source_walkway_id,walking_allowed,direction,forward_cost_m,reverse_cost_m,reviewed_at,reviewed_by)
        values (1001,1001,1002,extensions.st_geomfromtext('LINESTRING(123.001 13.005,123.005 13.005)',4326)::extensions.geography,
          433,'path',false,'${release.id}',1,'edge-1','${HASH}','edges','v1','approved',1,transaction_timestamp(),
          '10000000-0000-0000-0000-000000000101',true,'both',433,433,transaction_timestamp(),'${gisActors.admin}');
        insert into public.grave_access_point(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,
          artifact_hash,layer_name,layer_version,lot_id,area_id,node_id,access_point_geom,review_state,created_by,reviewed_at,reviewed_by)
        values ('${release.id}',1,'${runId}','access-101','${HASH}','access','v1',101,1,1002,
          extensions.st_geomfromtext('POINT(123.005 13.005)',4326),'approved','${gisActors.admin}',transaction_timestamp(),'${gisActors.admin}');
        insert into public.mapping_display_feature(mapping_release_id,site_id,georeferencing_run_id,source_feature_id,
          artifact_hash,layer_name,layer_version,kind,label,route_node_id,display_geom,review_state,created_by,reviewed_at,reviewed_by)
        values ('${release.id}',1,'${runId}','landmark-1','${HASH}','landmarks','v1','landmark','Synthetic Landmark',1002,
          extensions.st_geomfromtext('POINT(123.005 13.005)',4326),'approved','${gisActors.admin}',transaction_timestamp(),'${gisActors.admin}');

        update public.mapping_release set status='published',revision=4,selected_run_id='${runId}',
          validation_report_hash='${HASH}',validation_summary='{"schemaVersion":1,"featureCount":9,"errorCount":0,"warningCount":0,"reportDigest":"${HASH}"}',
          staged_at=transaction_timestamp(),validated_at=transaction_timestamp(),reviewed_at=transaction_timestamp(),
          published_at=transaction_timestamp(),staged_by='${gisActors.admin}',validated_by='${gisActors.admin}',
          reviewed_by='${gisActors.admin}',published_by='${gisActors.admin}' where release_id='${release.id}';
      `);
    });
    await db.query(`insert into public.mapping_publication(site_id,area_id,release_id,published_by)
      values(1,1,$1,$2)`, [release.id, gisActors.admin]);
    await db.exec("alter table public.mapping_publication_event disable trigger user");
    await db.query(`insert into public.mapping_publication_event(site_id,area_id,new_release_id,request_id,kind,actor_account_id)
      values(1,1,$1,$2,'publish',$3)`, [release.id, randomUUID(), gisActors.admin]);
    await db.exec("alter table public.mapping_publication_event enable trigger user");
  });

  await gisLogin(db);
  return { release, runId };
}

test("M08 shared readiness and narrow read contracts", async (t) => {
  const db = await createTestDatabase();
  try {
    await t.test("M08 objects and access profiles exist", async () => {
      const functions = (await db.query(`select proname,prosecdef,proconfig from pg_proc p
        join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
        and proname in ('staff_gis_readiness','staff_mapping_release','public_mapping_layer','public_burial_gis')
        order by proname`)).rows;
      assert.deepEqual(functions.map((row) => row.proname),
        ["public_burial_gis","public_mapping_layer","staff_gis_readiness","staff_mapping_release"]);
      assert.ok(functions.every((row) => row.prosecdef && row.proconfig?.some((v) => v.includes("pg_catalog"))));
      assert.equal((await db.query("select count(*)::int n from pg_views where schemaname='gis_private' and viewname='lot_gis_readiness'")).rows[0].n, 1);
      const acl=(await db.query(`select
        has_function_privilege('authenticated','public.staff_gis_readiness(bigint,bigint,integer,integer)','execute') staff_auth,
        has_function_privilege('anon','public.staff_gis_readiness(bigint,bigint,integer,integer)','execute') staff_anon,
        has_function_privilege('authenticated','public.staff_mapping_release(uuid,text,integer,integer)','execute') admin_auth,
        has_function_privilege('anon','public.staff_mapping_release(uuid,text,integer,integer)','execute') admin_anon,
        has_function_privilege('anon','public.public_mapping_layer(bigint,bigint,text,integer,integer,uuid)','execute') public_anon,
        has_function_privilege('authenticated','public.public_mapping_layer(bigint,bigint,text,integer,integer,uuid)','execute') public_auth,
        has_function_privilege('service_role','public.public_mapping_layer(bigint,bigint,text,integer,integer,uuid)','execute') public_service`)).rows[0];
      assert.deepEqual(acl,{staff_auth:true,staff_anon:false,admin_auth:true,admin_anon:false,public_anon:true,public_auth:true,public_service:false});
    });

    const { release } = await seedReadFixture(db);

    await t.test("one readiness definition preserves occupancy, legacy state, and independent GIS states", async () => {
      const result = (await db.query("select public.staff_gis_readiness(1,1,1,20) result")).rows[0].result;
      assert.equal(result.total, 3);
      assert.equal(result.releaseId, release.id);
      const byId = new Map(result.rows.map((row) => [row.lotId,row]));
      assert.deepEqual(byId.get("101"), {
        lotId:"101",lotCode:"READ-101",areaId:"1",occupancy:"occupied",legacyCoordinate:"missing",
        geometryReady:true,routingReady:true,reason:null,
      });
      assert.equal(byId.get("102").occupancy, "occupied");
      assert.equal(byId.get("102").legacyCoordinate, "missing");
      assert.equal(byId.get("102").geometryReady, true);
      assert.equal(byId.get("102").routingReady, false);
      assert.equal(byId.get("102").reason, "no_access_point");
      assert.equal(byId.get("103").occupancy, "occupied");
      assert.equal(byId.get("103").legacyCoordinate, "rejected");
      assert.equal(byId.get("103").reason, "no_approved_polygon");
      assert.deepEqual(result.counts, { geometryReady:2, routingReady:1, legacyMissing:2 });
      const removed = await asOwner(db, async () =>
        (await db.query("select * from gis_private.lot_gis_readiness where lot_id=104")).rows[0]);
      assert.equal(removed.reason, "lot_removed");
    });

    await t.test("counts and stable pages are bounded and derived from the full filtered source", async () => {
      const page1 = (await db.query("select public.staff_gis_readiness(1,1,1,1) result")).rows[0].result;
      const page2 = (await db.query("select public.staff_gis_readiness(1,1,2,1) result")).rows[0].result;
      assert.equal(page1.total, 3); assert.equal(page2.total, 3);
      assert.equal(page1.totalPages, 3); assert.equal(page2.totalPages, 3);
      assert.notEqual(page1.rows[0].lotId, page2.rows[0].lotId);
      assert.equal((await db.query("select count(*)::int n from public.lot where area_id=1 and deleted_at is null")).rows[0].n, page1.total);
      for (const [page,size] of [[0,20],[1,0],[100001,20],[1,51]])
        await assert.rejects(db.query("select public.staff_gis_readiness(1,1,$1,$2)",[page,size]), /page|size|bound/i);
    });

    await t.test("maximum-pilot readiness, public/admin pages, and counts keep set-based query shapes", async (st) => {
      await asOwner(db, async () => {
        await db.exec(`insert into public.lot(lot_id,area_id,lot_code,status)
          select value,1,'READ-'||value::text,'AVAILABLE' from generate_series(200,246) value;
          analyze public.lot; analyze public.plot_geometry; analyze public.grave_access_point;
          analyze public.map_node; analyze public.map_edge;`);
        const queries = {
          readiness: "select lot_id from gis_private.lot_gis_readiness where site_id=1 and area_id=1 and deleted_at is null order by lot_id limit 50",
          publicPage: `select sort_key from gis_private.public_layer_features('${release.id}'::uuid,'plots') order by sort_key limit 50`,
          adminPage: `select sort_key from gis_private.admin_layer_rows('${release.id}'::uuid,'plots',true) order by sort_key limit 50`,
          counts: "select count(*) from gis_private.lot_gis_readiness where site_id=1 and area_id=1 and deleted_at is null",
        };
        for (const [name,query] of Object.entries(queries)) {
          const plan=(await db.query(`explain (analyze,costs off,format json) ${query}`)).rows[0]["QUERY PLAN"];
          const rendered=JSON.stringify(plan);
          assert.doesNotMatch(rendered,/mapping_import_chunk|chunk_bytes|Seq Scan.*mapping_import/i);
          assert.ok((rendered.match(/reachable_nodes/g)??[]).length<=1,"reachable set must not be invoked per lot");
          const root=Array.isArray(plan)?plan[0]:plan;
          if(name==="readiness" || name==="counts") {
            assert.match(rendered,/mapping_publication_release_scope_idx/);
            assert.match(rendered,/mapping_publication_event_scope_time_idx/);
          }
          st.diagnostic(`${name}: root=${root.Plan?.["Node Type"]}; executionMs=${root["Execution Time"]}; reachableFunctionScans=${(rendered.match(/\"Function Name\":\"reachable_nodes\"/g)??[]).length}`);
        }
        const migration=await readFile(new URL(`../supabase/migrations/${M08}`,import.meta.url),"utf8");
        assert.match(migration,/from gis_private\.lot_gis_readiness r[\s\S]+where r\.site_id=p_site_id/);
        assert.match(migration,/from gis_private\.public_layer_features\(release_id,p_layer\)/);
        assert.match(migration,/from gis_private\.admin_layer_rows\(r\.release_id,p_layer,authoritative\)/);
      });
      const maximum=(await db.query("select public.staff_gis_readiness(1,1,1,50) result")).rows[0].result;
      assert.equal(maximum.total,50); assert.equal(maximum.rows.length,50);
    });

    await t.test("MANAGER gets sanitized readiness while protected release detail stays ADMIN-only", async () => {
      await gisLogin(db, gisActors.manager);
      const result = (await db.query("select public.staff_gis_readiness(1,1,1,20) result")).rows[0].result;
      assert.equal(result.total, 50);
      assert.doesNotMatch(JSON.stringify(result), /artifact|hash|notes|owner|deceased|package|private/i);
      await assert.rejects(db.query("select public.staff_mapping_release($1,'metadata',1,50)",[release.id]), /administrator|permission/i);
      for (const actor of [gisActors.inactive,null]) {
        await gisLogin(db, actor, actor ? "authenticated" : "anon");
        await assert.rejects(db.query("select public.staff_gis_readiness(1,1,1,20)"), /staff|permission/i);
      }
      await gisLogin(db);
    });

    await t.test("public reads expose only the selected published snapshot and prevent mixed-release pages", async () => {
      await gisLogin(db, null, "anon");
      const plots = (await db.query("select public.public_mapping_layer(1,1,'plots',1,1,null) result")).rows[0].result;
      assert.equal(plots.releaseId, release.id); assert.equal(plots.total, 2); assert.equal(plots.features.length, 1);
      assert.equal(plots.features[0].type, "Feature");
      assert.doesNotMatch(JSON.stringify(plots), /artifact|hash|notes|actor|import|package|private/i);
      await assert.rejects(db.query("select public.public_mapping_layer(1,1,'plots',2,1,$1)",[randomUUID()]), /release_changed/i);
      const empty = (await db.query("select public.public_mapping_layer(2,3,'plots',1,20,null) result")).rows[0].result;
      assert.equal(empty.releaseId,null); assert.deepEqual(empty.features,[]);
      await assert.rejects(db.query("select public.public_mapping_layer(2,3,'plots',2,20,$1)",[release.id]), /release_changed/i);
      await gisLogin(db);
    });

    await t.test("hidden and deleted burials are null; visible mapped burial uses approved public GIS only", async () => {
      await gisLogin(db, null, "anon");
      // The soft-deleted assignment still drives occupancy, but is not publicly visible.
      assert.equal((await db.query("select public.public_burial_gis(101) result")).rows[0].result,null);
      assert.equal((await db.query("select public.public_burial_gis(102) result")).rows[0].result,null);
      assert.equal((await db.query("select public.public_burial_gis(103) result")).rows[0].result,null);
      assert.equal((await db.query("select public.public_burial_gis(104) result")).rows[0].result,null);
      await gisLogin(db, gisActors.admin, "postgres");
      await db.query("update public.burial_record set deleted_at=null where burial_id=101");
      await gisLogin(db, null, "anon");
      const visible = (await db.query("select public.public_burial_gis(101) result")).rows[0].result;
      assert.equal(visible.burialId,"101"); assert.equal(visible.releaseId,release.id);
      assert.equal(visible.geometryReady,true); assert.equal(visible.routingReady,true);
      assert.equal(visible.plotGeometry.type,"Polygon"); assert.equal(visible.accessPoint.type,"Point");
      assert.doesNotMatch(JSON.stringify(visible), /name|occupancy|owner|artifact|notes|hash/i);
      await gisLogin(db);
    });

    await t.test("approved-but-unpublished and superseded selectors never become public", async () => {
      for (const state of ["approved","superseded"]) {
        await gisLogin(db,gisActors.admin,"postgres");
        await db.exec("begin; alter table public.mapping_release disable trigger user");
        try {
          await db.query("update public.mapping_release set status=$2 where release_id=$1",[release.id,state]);
          await db.exec("alter table public.mapping_release enable trigger user");
          await gisLogin(db,null,"anon");
          const result=(await db.query("select public.public_mapping_layer(1,1,'plots',1,20,null) result")).rows[0].result;
          assert.equal(result.releaseId,null); assert.deepEqual(result.features,[]);
        } finally {
          await gisLogin(db,gisActors.admin,"postgres");
          await db.exec("rollback");
          await gisLogin(db);
        }
      }
    });

    await t.test("unpublished, superseded, and staged retained snapshots are non-public and non-authoritative", async () => {
      await asOwner(db, async () => {
        await db.exec("alter table public.mapping_release disable trigger user");
        await db.query("update public.mapping_release set status='staged',revision=5 where release_id=$1",[release.id]);
        await db.exec("alter table public.mapping_release enable trigger user");
      });
      await gisLogin(db, null, "anon");
      const publicResult = (await db.query("select public.public_mapping_layer(1,1,'plots',1,20,null) result")).rows[0].result;
      assert.equal(publicResult.releaseId,null); assert.deepEqual(publicResult.features,[]);
      await gisLogin(db);
      const readiness = (await db.query("select public.staff_gis_readiness(1,1,1,20) result")).rows[0].result;
      assert.ok(readiness.rows.every((row) => !row.geometryReady && !row.routingReady));
      const admin = (await db.query("select public.staff_mapping_release($1,'plots',1,50) result",[release.id])).rows[0].result;
      assert.equal(admin.contentAuthority,"retained_unapproved"); assert.equal(admin.total,2);
      assert.ok(admin.rows.every((row) => row.authoritative === false));
    });

    await t.test("area reassignment loses readiness without rewriting the retained snapshot", async () => {
      await asOwner(db, async () => db.query("update public.lot set area_id=2 where lot_id=101"));
      const row = await asOwner(db, async () =>
        (await db.query("select * from gis_private.lot_gis_readiness where lot_id=101")).rows[0]);
      assert.equal(row.geometry_ready,false); assert.equal(row.routing_ready,false);
      assert.equal(row.reason,"no_published_release");
      assert.equal((await db.query("select count(*)::int n from public.plot_geometry where lot_id=101")).rows[0].n,1);
    });

    await t.test("decimal bigint IDs remain strings through wrappers and invalid IDs are rejected before RPC", async () => {
      const types = await import("../src/lib/supabase/gis-types.ts");
      const data = await import("../src/lib/supabase/gis-data.ts");
      assert.equal(types.parseGisBigintId(LARGE_ID,"siteId"),LARGE_ID);
      for (const invalid of [9007199254740993,"01","0","-1","1.5","9223372036854775808","x"])
        assert.throws(() => types.parseGisBigintId(invalid,"siteId"), /siteId|decimal|range/i);
      const source = await readFile(new URL("../src/lib/supabase/gis-data.ts",import.meta.url),"utf8");
      assert.doesNotMatch(source,/Number\s*\(|parseInt\s*\(|parseFloat\s*\(/);
      assert.match(source,/SupabaseClient<Database>/);
      assert.doesNotMatch(source,/createClient|SUPABASE_SECRET|service_role|process\.env/);

      const calls=[];
      const client={rpc:async(name,args)=>{
        calls.push({name,args});
        return {error:null,data:{schemaVersion:1,siteId:LARGE_ID,areaId:LARGE_ID,releaseId:null,scopeRevision:0,
          page:1,pageSize:20,total:1,totalPages:1,counts:{geometryReady:0,routingReady:0,legacyMissing:1},
          rows:[{lotId:LARGE_ID,lotCode:"READ-LARGE",areaId:LARGE_ID,occupancy:"available",legacyCoordinate:"missing",
            geometryReady:false,routingReady:false,reason:"no_published_release"}]}};
      }};
      const decoded=await data.getStaffGisReadiness(client,{siteId:LARGE_ID,areaId:LARGE_ID});
      assert.equal(decoded.siteId,LARGE_ID); assert.equal(decoded.rows[0].lotId,LARGE_ID);
      assert.deepEqual(calls,[{name:"staff_gis_readiness",args:{p_site_id:LARGE_ID,p_area_id:LARGE_ID,p_page:1,p_page_size:20}}]);
      for(const invalid of ["01","0","9223372036854775808",9007199254740993]) {
        await assert.rejects(data.getStaffGisReadiness(client,{siteId:invalid,areaId:LARGE_ID}),/siteId|decimal|range/i);
      }
      assert.equal(calls.length,1,"invalid IDs must be rejected before RPC invocation");
    });

    await t.test("runtime DTO decoders reject typed field confusion and private/raw additions", async () => {
      const types=await import("../src/lib/supabase/gis-types.ts");
      const publicPage={schemaVersion:1,releaseId:release.id,scopeRevision:1,layer:"plots",page:1,pageSize:20,total:1,totalPages:1,
        features:[{type:"Feature",id:"plot-101",geometry:{type:"Polygon",coordinates:[]},
          properties:{sourceFeatureId:"plot-101",lotId:"101",lotCode:"READ-101",areaId:"1"}}]};
      assert.equal(types.decodePublicMappingPage(publicPage).features[0].properties.lotId,"101");
      assert.throws(()=>types.decodePublicMappingPage({...publicPage,features:[{...publicPage.features[0],
        properties:{...publicPage.features[0].properties,lotId:101}}]}),/lotId|decimal|string/i);
      assert.throws(()=>types.decodePublicMappingPage({...publicPage,features:[{...publicPage.features[0],
        properties:{...publicPage.features[0].properties,chunkBytes:"PRIVATE_RAW"}}]}),/unsupported field/i);

      const adminPage={schemaVersion:1,release:{id:release.id,siteId:"1",releaseCode:"read",title:"Read",description:null,
        scopeKind:"pilot",pilotAreaId:"1",status:"published",revision:4,packageReference:"synthetic/package",packageHash:HASH,
        sourcePlanReference:"synthetic/plan",sourcePlanVersion:"v1",sourcePlanHash:HASH,sourceCoordinateSpace:"pixels",
        fieldSrid:4326,workingSrid:32651,publishedSrid:4326,qgisVersion:"3.40",selectedRunId:null,
        validationReportHash:HASH,validationSummary:{schemaVersion:1,featureCount:2,errorCount:0,warningCount:0,reportDigest:HASH},
        notes:"ADMIN_ONLY",rejectionReason:null},contentAuthority:"frozen",layer:"plots",page:1,pageSize:50,total:1,totalPages:1,
        rows:[{id:randomUUID(),sourceFeatureId:"plot-101",lotId:"101",areaId:"1",geometry:{type:"Polygon",coordinates:[]},
          reviewState:"approved",revision:1,artifactHash:HASH,layerName:"plots",layerVersion:"v1",privateNotes:"ADMIN_ONLY",authoritative:true}]};
      assert.equal(types.decodeAdminMappingReleasePage(adminPage).rows[0].lotId,"101");
      assert.throws(()=>types.decodeAdminMappingReleasePage({...adminPage,release:{...adminPage.release,chunkBytes:"PRIVATE_RAW"}}),/unsupported field/i);
      assert.throws(()=>types.decodeAdminMappingReleasePage({...adminPage,rows:[{...adminPage.rows[0],lotId:101}]}),/lotId|decimal|string/i);
      assert.throws(()=>types.decodeAdminMappingReleasePage({...adminPage,rows:[{...adminPage.rows[0],rawImport:{bytes:"PRIVATE_RAW"}}]}),/unsupported field/i);
    });

    await t.test("private helpers are denied and public/admin projections omit raw import bytes", async () => {
      for (const role of ["anon","authenticated","service_role"]) {
        await gisLogin(db,gisActors.admin,role);
        await assert.rejects(db.exec("select * from gis_private.lot_gis_readiness"),/permission denied/i);
        await assert.rejects(db.exec(`select * from gis_private.reachable_nodes('${release.id}'::uuid)`),/permission denied/i);
      }
      await gisLogin(db);
      const migration = await readFile(new URL(`../supabase/migrations/${M08}`,import.meta.url),"utf8");
      assert.doesNotMatch(migration,/mapping_import_chunk\s*\.\s*chunk_bytes|select\s+\*/i);
      assert.match(migration,/revoke all on function public\.staff_mapping_release/i);
      assert.match(migration,/grant execute on function public\.public_mapping_layer/i);
    });
  } finally { await db.close(); }
});
