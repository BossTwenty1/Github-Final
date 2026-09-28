import { randomUUID } from "node:crypto";

// Fictional accounts and areas only; no field readings or real cemetery records.
export const gisActors = {
  admin: "10000000-0000-0000-0000-000000000001",
  manager: "10000000-0000-0000-0000-000000000002",
  inactive: "10000000-0000-0000-0000-000000000003",
  otherAdmin: "10000000-0000-0000-0000-000000000004",
};

export async function seedGisFixtures(db) {
  for (const [name, id] of Object.entries(gisActors)) {
    await db.query("insert into auth.users values ($1)", [id]);
    await db.query(`insert into public.account(account_id,role_id,username,is_active,account_status,approved_at)
      select $1,role_id,$2,$3,$4,case when $3 then now() else null end
      from public.role where role_name=$5`,
    [id, `fictional-gis-${name}`, name !== "inactive", name === "inactive" ? "PENDING" : "ACTIVE", name === "manager" ? "MANAGER" : "ADMIN"]);
  }
  await db.exec(`
    insert into public.site(site_id,site_name,address) values
      (1,'Fictional GIS Site A','Synthetic address A'),(2,'Fictional GIS Site B','Synthetic address B'),
      (9007199254740993,'Fictional Large ID Site','Synthetic address C');
    insert into public.area(area_id,site_id,area_code,area_name,area_category) values
      (1,1,'PILOT-A','Fictional pilot A','garden'),(2,1,'EXTRA-A','Fictional extra A','garden'),
      (3,2,'PILOT-B','Fictional pilot B','garden'),
      (9007199254740993,9007199254740993,'PILOT-C','Fictional pilot C','garden');
  `);
}

export async function gisLogin(db, actor = gisActors.admin, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor ?? ""]);
  if (!["authenticated", "anon", "service_role", "postgres"].includes(role)) throw new Error("Unexpected fixture role");
  if (role !== "postgres") await db.exec(`set role ${role}`);
}

export function releaseValues(overrides = {}) {
  return {
    site_id: "1", release_code: `synthetic-${randomUUID()}`, title: "Fictional pilot release",
    scope_kind: "pilot", pilot_area_id: "1", description: "Synthetic metadata",
    package_reference: "fictional/package.zip", package_hash: "a".repeat(64),
    source_plan_reference: "fictional/plan.pdf", source_plan_version: "v1",
    source_plan_hash: "b".repeat(64), source_coordinate_space: "plan pixels",
    field_srid: 4326, working_srid: 32651, published_srid: 4326, qgis_version: "3.40",
    notes: "PRIVATE_SYNTHETIC_NOTE", ...overrides,
  };
}

export async function createRelease(db, values = releaseValues(), requestId = randomUUID()) {
  return (await db.query("select public.staff_create_mapping_release($1::jsonb,$2::uuid) result", [JSON.stringify(values), requestId])).rows[0].result;
}

export async function rejectRelease(db, id, revision = 1, reason = "PRIVATE_SYNTHETIC_REJECTION", requestId = randomUUID()) {
  return (await db.query("select public.staff_reject_mapping_release($1::uuid,$2::int,$3::text,$4::uuid) result", [id, revision, reason, requestId])).rows[0].result;
}

// Owner-only corruption/emulation in the disposable DB, always rolled back.
// These fixtures never expose a generic writer or transition API to clients.
export async function withOwnerTransaction(db, callback) {
  await gisLogin(db, gisActors.admin, "postgres");
  await db.exec("begin");
  try { return await callback(); }
  finally { await db.exec("rollback"); await gisLogin(db); }
}
