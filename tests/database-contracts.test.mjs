import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./database-helper.mjs";

test("database migrations and operational contracts", async (t) => {
  const db = await createTestDatabase();
  const admin = "00000000-0000-0000-0000-000000000001";
  const manager = "00000000-0000-0000-0000-000000000002";
  const login = async (id, role = "authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || ""]);
    await db.exec("set role " + role);
  };
  const save = async (entity, id, revision, values, operation = "save", request = randomUUID()) =>
    (await db.query("select public.staff_save_record($1,$2,$3,$4::jsonb,$5,$6) as result",
      [entity, id === null ? null : String(id), revision, JSON.stringify(values), request, operation])).rows[0].result;
  const search = async (query, section = "all", page = 1, year = "any") =>
    (await db.query("select public.search_public_burials($1,$2,$3,'name',$4,2) as result", [query, section, year, page])).rows[0].result;
  const lot = (code, lon = 0.5) => ({ area_id: 1, block_id: null, lot_owner_id: null, lot_code: code, legacy_location_code: null, status: "AVAILABLE", location_geom: { type: "Point", coordinates: [lon, 0.5] }, coordinate_accuracy_m: 5 });
  const burial = (lotId, name = "Maria Santos", visible = true) => ({
    display_name: name, birth_date: "1940-01-01", death_date: "2020-01-01", public_display: visible,
    lot_id: Number(lotId), interment_date: "2020-01-05", record_status: "active", interment_status: "PERMANENT",
    remains_type: "FRESH", reference_no: null, service_provider: null, record_source: null, quality_notes: null,
  });
  try {
    await db.exec(`
      insert into auth.users values ('${admin}'),('${manager}');
      insert into public.account(account_id,role_id,username,is_active,account_status,approved_at)
        select '${admin}',role_id,'admin',true,'ACTIVE',now() from public.role where role_name='ADMIN';
      insert into public.account(account_id,role_id,username,is_active,account_status,approved_at)
        select '${manager}',role_id,'manager',true,'ACTIVE',now() from public.role where role_name='MANAGER';
      insert into public.site(site_name,address) values('Test cemetery','Test address');
      insert into public.area(site_id,area_code,area_name,area_category,boundary_geom)
        values(1,'RPG','Test garden','garden',extensions.st_geogfromtext('POLYGON((0 0,1 0,1 1,0 1,0 0))'));
    `);
    await login(admin);
    let firstLot, firstBurial;
    await t.test("new coordinates are pending and request retries create only one plot", async () => {
      const request = randomUUID();
      firstLot = await save("lot", null, null, lot("RPG-001"), "save", request);
      assert.deepEqual(await save("lot", null, null, lot("RPG-001"), "save", request), firstLot);
      assert.equal((await db.query("select coordinate_status,coordinate_verified from public.lot")).rows[0].coordinate_status, "pending");
      await assert.rejects(save("lot", null, null, lot("RPG-002"), "save", request), /different changes/);
      assert.equal((await db.query("select count(*)::int n from public.lot")).rows[0].n, 1);
    });
    await t.test("out-of-boundary coordinates roll back the entire request", async () => {
      await assert.rejects(save("lot", null, null, lot("BAD", 2)), /outside/);
      assert.equal((await db.query("select count(*)::int n from public.lot")).rows[0].n, 1);
    });
    await t.test("reviews require reasons and reject stale edits", async () => {
      await assert.rejects(save("lot", firstLot.id, firstLot.revision, { status: "rejected" }, "review"), /reason/);
      firstLot = await save("lot", firstLot.id, firstLot.revision, { status: "rejected", reason: "Revisit marker" }, "review");
      assert.equal((await db.query("select coordinate_rejection_reason from public.lot")).rows[0].coordinate_rejection_reason, "Revisit marker");
      await assert.rejects(save("lot", firstLot.id, 1, lot("RPG-001")), /Another staff member/);
      firstLot = await save("lot", firstLot.id, firstLot.revision, { status: "verified" }, "review");
    });
    await t.test("manager cannot approve coordinates, delete, or bypass the safe API", async () => {
      await login(manager);
      await assert.rejects(save("lot", firstLot.id, firstLot.revision, { status: "verified" }, "review"), /Only administrators/);
      await assert.rejects(save("lot", firstLot.id, firstLot.revision, {}, "delete"), /Only administrators/);
      await assert.rejects(db.exec("update public.lot set coordinate_verified=true"), /permission denied/);
      assert.equal((await db.query("select * from public.record_history")).rows.length, 0);
      await login(admin);
    });
    await t.test("burial creation is atomic and double-submission safe", async () => {
      const request = randomUUID();
      firstBurial = await save("burial_record", null, null, burial(firstLot.id), "save", request);
      assert.deepEqual(await save("burial_record", null, null, burial(firstLot.id), "save", request), firstBurial);
      await assert.rejects(save("burial_record", null, null, burial(firstLot.id)), /already has/);
      assert.equal((await db.query("select count(*)::int n from public.deceased")).rows[0].n, 1);
      await assert.rejects(save("burial_record", firstBurial.id, firstBurial.revision, { ...burial(firstLot.id, "Changed"), remains_type: "INVALID" }), /check constraint/);
      assert.equal((await db.query("select display_name from public.deceased")).rows[0].display_name, "Maria Santos");
    });
    await t.test("ranked name and plot search respects public visibility, filters and pagination", async () => {
      const secondLot = await save("lot", null, null, lot("RPG-002"));
      await save("burial_record", null, null, burial(secondLot.id, "Maria Santoso"));
      const privateLot = await save("lot", null, null, lot("RPG-003"));
      await save("burial_record", null, null, burial(privateLot.id, "Maria Private", false));
      const thirdLot = await save("lot", null, null, lot("RPG-004"));
      await save("burial_record", null, null, burial(thirdLot.id, "Jose Santos"));
      await login(null, "anon");
      let result = await search("Santos,   Maria");
      assert.equal(result.items[0].display_name, "Maria Santos");
      assert.equal(result.items[0].match_type, "exact");
      assert.equal(result.items[0].interment_date, "2020-01-05");
      assert.equal((await search("rpg 001")).items[0].match_type, "exact");
      assert.ok((await search("Maria Santso")).items.some((row) => row.match_type === "similar"));
      assert.equal((await search("Private")).total, 0);
      assert.equal((await search("Maria", "Different garden")).total, 0);
      assert.equal((await search("Maria", "all", 1, "1900-1999")).total, 0);
      result = await search("");
      assert.equal(result.total, 3);
      assert.equal(result.items.length, 2);
      const next = await search("", "all", 2);
      assert.equal(next.items.length, 1);
      assert.ok(!result.items.some((r) => r.burial_id === next.items[0].burial_id));
      await assert.rejects(db.exec("select * from public.lot_owner"), /permission denied/);
      await login(admin);
    });
    await t.test("owner edits and removal are recoverable and version checked", async () => {
      const values = { first_name: "Test", last_name: "Owner", address: "Test address" };
      let owner = await save("lot_owner", null, null, values);
      owner = await save("lot_owner", owner.id, owner.revision, { ...values, address: "Changed address" });
      await assert.rejects(save("lot_owner", owner.id, 1, values), /Another staff member/);
      const h = (await db.query("select * from public.record_history where entity='lot_owner' order by history_id desc limit 1")).rows[0];
      owner = await save("lot_owner", owner.id, owner.revision, { history_id: h.history_id }, "revert");
      assert.equal((await db.query("select address from public.lot_owner where lot_owner_id=$1", [owner.id])).rows[0].address, "Test address");
      owner = await save("lot_owner", owner.id, owner.revision, {}, "delete");
      await save("lot_owner", owner.id, owner.revision, {}, "restore");
      assert.equal((await db.query("select deleted_at from public.lot_owner where lot_owner_id=$1", [owner.id])).rows[0].deleted_at, null);
    });
    await t.test("photo uploads cannot self-approve and review is administrator-only", async () => {
      await login(manager);
      await assert.rejects(db.query("insert into public.photo(burial_id,uploaded_by,storage_path,file_name,approval_status,public_display) values($1,$2,'bad','bad.jpg','approved',true)", [firstBurial.id, manager]), /row-level security/);
      const photo = (await db.query("insert into public.photo(burial_id,uploaded_by,storage_path,file_name) values($1,$2,'test/photo','test.jpg') returning photo_id,revision", [firstBurial.id, manager])).rows[0];
      await assert.rejects(save("photo", photo.photo_id, photo.revision, { status: "approved" }, "review"), /Only administrators/);
      await login(admin);
      await save("photo", photo.photo_id, photo.revision, { status: "approved" }, "review");
      assert.equal((await db.query("select count(*)::int n from public.public_burial_photos")).rows[0].n, 1);
      await assert.rejects(save("photo", photo.photo_id, photo.revision, { status: "rejected" }, "review"), /Another staff member/);
    });
    await t.test("account actions preserve administrator-only and stale-session protection", async () => {
      const target = "00000000-0000-0000-0000-000000000003";
      await db.exec("reset role");
      await db.query("insert into auth.users values($1)", [target]);
      await db.query("insert into public.account(account_id,role_id,username) select $1,role_id,'pending-staff' from public.role where role_name='MANAGER'", [target]);
      await login(manager);
      await assert.rejects(save("account", target, 1, {}, "approve"), /Only administrators/);
      await login(admin);
      const approved = await save("account", target, 1, {}, "approve");
      await assert.rejects(save("account", target, 1, {}, "activate"), /Another staff member/);
      await save("account", target, approved.revision, {}, "activate");
      assert.equal((await db.query("select account_status from public.account where account_id=$1", [target])).rows[0].account_status, "ACTIVE");
      await assert.rejects(db.query("select public.admin_change_account_role($1,'ADMIN')", [target]), /permission denied/);
    });
    await t.test("soft deletion hides public records and restores without losing relationships", async () => {
      firstBurial = await save("burial_record", firstBurial.id, firstBurial.revision, {}, "delete");
      assert.equal((await search("rpg001")).total, 0);
      assert.equal((await db.query("select count(*)::int n from public.public_burial_photos")).rows[0].n, 0);
      await assert.rejects(save("lot", firstLot.id, firstLot.revision, {}, "delete"), /burial record/);
      firstBurial = await save("burial_record", firstBurial.id, firstBurial.revision, {}, "restore");
      assert.equal((await search("rpg001")).total, 1);
      assert.equal((await db.query("select count(*)::int n from public.public_burial_photos")).rows[0].n, 1);
    });
    await t.test("undo restores the previous edit and prevents overwriting newer versions", async () => {
      firstBurial = await save("burial_record", firstBurial.id, firstBurial.revision, burial(firstLot.id, "Edited Name"));
      const h = (await db.query("select * from public.record_history where entity='burial_record' order by history_id desc limit 1")).rows[0];
      firstBurial = await save("burial_record", firstBurial.id, firstBurial.revision, { history_id: h.history_id }, "revert");
      assert.equal((await search("rpg001")).items[0].display_name, "Maria Santos");
      await assert.rejects(save("burial_record", firstBurial.id, firstBurial.revision, { history_id: h.history_id }, "revert"), /latest unchanged/);
    });
  } finally { await db.close(); }
});
