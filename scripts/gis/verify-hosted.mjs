#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXPECTED = Object.freeze({
  projectRef: "ddoowghocqyfoxaikifb",
  migration: "20260929000000",
  sites: 1,
  areas: 4,
  lots: 3,
  deceased: 3,
  burialRecords: 3,
  legacyNodes: 41,
  legacyEdges: 18,
  legacyNodeHash: "fb04b1c24df7f77e166f8ed6e4dcbf1f66fde6e61cf77ad17053971d137e56c2",
  legacyEdgeHash: "c8da5d6bdebd470a7f3fd1a1a5715c5290bc78f509c6aec41b315238873c139d",
});

const linked = process.argv.length === 3 && process.argv[2] === "--linked";
if (process.argv.length > 2 && !linked) {
  process.stderr.write("Usage: node scripts/gis/verify-hosted.mjs [--linked]\n");
  process.exit(1);
}
const connection = process.env.GRAVENAV_GIS_DATABASE_URL;
if (!linked && !connection) {
  process.stderr.write("GRAVENAV_GIS_DATABASE_URL is required through the process environment.\n");
  process.exit(1);
}

let parsed;
if (!linked) {
  try {
    parsed = new URL(connection);
  } catch {
    process.stderr.write("GRAVENAV_GIS_DATABASE_URL is not a valid PostgreSQL URL.\n");
    process.exit(1);
  }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    process.stderr.write("GRAVENAV_GIS_DATABASE_URL must use postgres:// or postgresql://.\n");
    process.exit(1);
  }
} else {
  let projectRef;
  try {
    projectRef = readFileSync(new URL("../../supabase/.temp/project-ref", import.meta.url), "utf8").trim();
  } catch {
    process.stderr.write("Linked project reference is unavailable.\n");
    process.exit(1);
  }
  if (projectRef !== EXPECTED.projectRef) {
    process.stderr.write("Linked project does not match the reviewed GraveNav target.\n");
    process.exit(1);
  }
}

const sql = String.raw`
begin read only;
select jsonb_build_object(
  'migrationApplied',exists(select 1 from supabase_migrations.schema_migrations where version='20260929000000'),
  'migrationAppliedOnce',(select count(*)=1 from supabase_migrations.schema_migrations where version='20260929000000'),
  'postgis',(select extversion from pg_extension where extname='postgis'),
  'pgroutingEnabled',exists(select 1 from pg_extension where extname='pgrouting'),
  'm09FunctionCount',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='public' and p.proname in ('staff_review_mapping_release','staff_publish_mapping_release','staff_rollback_mapping_release'))
       or (n.nspname='gis_private' and p.proname in ('activate_release','assert_release_live','release_live_dependency_digest'))),
  'privateSchemaDenied',not has_schema_privilege('authenticated','gis_private','USAGE')
    and not has_schema_privilege('anon','gis_private','USAGE')
    and not has_schema_privilege('service_role','gis_private','USAGE'),
  'publicRpcSecurity',(select count(*)=3 and bool_and(p.prosecdef and pg_get_userbyid(p.proowner)='postgres'
    and p.proconfig @> array['search_path=pg_catalog, extensions, pg_temp']
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('service_role',p.oid,'EXECUTE'))
    from pg_proc p where p.oid=any(array[
      to_regprocedure('public.staff_review_mapping_release(uuid,integer,text,jsonb,text,uuid)'),
      to_regprocedure('public.staff_publish_mapping_release(uuid,integer,integer,uuid)'),
      to_regprocedure('public.staff_rollback_mapping_release(uuid,integer,integer,text,uuid)')]::oid[])),
  'privateHelperSecurity',(select count(*)=3 and bool_and(not p.prosecdef and pg_get_userbyid(p.proowner)='postgres'
    and p.proconfig @> array['search_path=pg_catalog, extensions, pg_temp']
    and not has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE')
    and not has_function_privilege('service_role',p.oid,'EXECUTE'))
    from pg_proc p where p.oid=any(array[
      to_regprocedure('gis_private.activate_release(uuid,integer,integer,text)'),
      to_regprocedure('gis_private.assert_release_live(uuid,jsonb,boolean)'),
      to_regprocedure('gis_private.release_live_dependency_digest(uuid)')]::oid[])),
  'protectedTablesSecurity',(select count(*)=7 and bool_and(c.relrowsecurity and pg_get_userbyid(c.relowner)='postgres'
    and not has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE')
    and not has_table_privilege('anon',c.oid,'INSERT,UPDATE,DELETE')
    and not has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE')
    and not has_table_privilege('anon',c.oid,'SELECT'))
    from pg_class c where c.oid=any(array['public.mapping_release'::regclass,'public.mapping_publication'::regclass,
      'public.mapping_publication_event'::regclass,'public.mapping_import'::regclass,
      'public.mapping_import_file'::regclass,'public.mapping_import_chunk'::regclass,'public.mapping_import_report'::regclass]::oid[])),
  'publicationConstraintsValidated',(select count(*)>0 and bool_and(convalidated) from pg_constraint
    where conrelid in ('public.mapping_publication'::regclass,'public.mapping_publication_event'::regclass)),
  'publicationTriggersEnabled',(select count(*)=2 and bool_and(t.tgenabled in ('O','A')) from pg_trigger t
    where not t.tgisinternal and ((t.tgrelid='public.mapping_release'::regclass and t.tgname='mapping_release_guard')
      or (t.tgrelid='public.mapping_publication_event'::regclass and t.tgname='mapping_publication_event_immutable'))),
  'sites',(select count(*) from public.site),
  'areas',(select count(*) from public.area),
  'lots',(select count(*) from public.lot),
  'deceased',(select count(*) from public.deceased),
  'burialRecords',(select count(*) from public.burial_record),
  'availableLots',(select count(*) from public.lot where status='AVAILABLE'),
  'pendingCoordinates',(select count(*) from public.lot where coordinate_status='pending'),
  'verifiedCoordinates',(select count(*) from public.lot where coordinate_verified),
  'coordinateGeometries',(select count(*) from public.lot where location_geom is not null),
  'pendingBurialRecords',(select count(*) from public.burial_record where record_status='pending'),
  'releases',(select count(*) from public.mapping_release),
  'imports',(select count(*) from public.mapping_import),
  'selectors',(select count(*) from public.mapping_publication),
  'events',(select count(*) from public.mapping_publication_event),
  'legacyNodes',(select count(*) from public.map_node where mapping_release_id is null),
  'legacyEdges',(select count(*) from public.map_edge where mapping_release_id is null),
  'releaseNodes',(select count(*) from public.map_node where mapping_release_id is not null),
  'releaseEdges',(select count(*) from public.map_edge where mapping_release_id is not null),
  'legacyNodeHash',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(n)::text,'|' order by node_id),''),'UTF8')),'hex')
    from public.map_node n where mapping_release_id is null),
  'legacyEdgeHash',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(e)::text,'|' order by edge_id),''),'UTF8')),'hex')
    from public.map_edge e where mapping_release_id is null),
  'auditSequence',(select last_value from public.audit_log_audit_id_seq),
  'mapEdgeSequence',(select last_value from public.map_edge_edge_id_seq),
  'siteSequence',(select last_value from public.site_site_id_seq),
  'areaSequence',(select last_value from public.area_area_id_seq),
  'lotSequence',(select last_value from public.lot_lot_id_seq)
)::text as verification_result;
rollback;
`;

const childEnv = linked ? { ...process.env } : {
  ...process.env,
  PGHOST: parsed.hostname,
  PGPORT: parsed.port || "5432",
  PGUSER: decodeURIComponent(parsed.username),
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGDATABASE: parsed.pathname.replace(/^\//, "") || "postgres",
  PGSSLMODE: parsed.searchParams.get("sslmode") || "require",
};
delete childEnv.GRAVENAV_GIS_DATABASE_URL;

const executable = linked ? process.execPath : "psql";
const args = linked
  ? [fileURLToPath(new URL("../../node_modules/supabase/dist/supabase.js", import.meta.url)),
    "db", "query", "--linked", sql, "--output", "json"]
  : ["--no-psqlrc", "--no-align", "--tuples-only", "--quiet", "--set", "ON_ERROR_STOP=1"];
const run = spawnSync(executable, args, {
  encoding: "utf8",
  env: childEnv,
  input: linked ? undefined : sql,
  windowsHide: true,
});

if (run.error || run.status !== 0) {
  // Never echo connection/login diagnostics, which could contain credentials.
  process.stderr.write("Hosted read-only verification failed; inspect authenticated tooling separately.\n");
  process.exit(1);
}

let actual;
try {
  const line = linked
    ? JSON.parse(run.stdout).rows?.[0]?.verification_result
    : run.stdout.split(/\r?\n/).map((value) => value.trim()).find((value) => value.startsWith("{"));
  actual = JSON.parse(line);
} catch {
  process.stderr.write("Hosted verification returned no valid JSON result.\n");
  process.exit(1);
}
const checks = {
  migrationApplied: actual.migrationApplied === true,
  migrationAppliedOnce: actual.migrationAppliedOnce === true,
  postgisAvailable: typeof actual.postgis === "string" && actual.postgis.length > 0,
  pgroutingDisabled: actual.pgroutingEnabled === false,
  m09Functions: actual.m09FunctionCount === 6,
  privateHelpersDenied: actual.privateSchemaDenied === true,
  publicRpcSecurity: actual.publicRpcSecurity === true,
  privateHelperSecurity: actual.privateHelperSecurity === true,
  protectedTablesSecurity: actual.protectedTablesSecurity === true,
  publicationConstraintsValidated: actual.publicationConstraintsValidated === true,
  publicationTriggersEnabled: actual.publicationTriggersEnabled === true,
  productionCounts:
    actual.sites === EXPECTED.sites && actual.areas === EXPECTED.areas && actual.lots === EXPECTED.lots &&
    actual.deceased === EXPECTED.deceased && actual.burialRecords === EXPECTED.burialRecords &&
    actual.availableLots === 3 && actual.pendingCoordinates === 3 && actual.verifiedCoordinates === 0 &&
    actual.coordinateGeometries === 0 && actual.pendingBurialRecords === 3,
  zeroMeaningfulGisState:
    actual.releases === 0 && actual.imports === 0 && actual.selectors === 0 && actual.events === 0 &&
    actual.releaseNodes === 0 && actual.releaseEdges === 0,
  legacyCounts: actual.legacyNodes === EXPECTED.legacyNodes && actual.legacyEdges === EXPECTED.legacyEdges,
  legacyHashes: actual.legacyNodeHash === EXPECTED.legacyNodeHash && actual.legacyEdgeHash === EXPECTED.legacyEdgeHash,
};

const output = {
  schemaVersion: 1,
  projectRef: EXPECTED.projectRef,
  migration: EXPECTED.migration,
  readOnly: true,
  transport: linked ? "authenticated-linked-cli" : "psql-environment",
  checks,
  counts: {
    sites: actual.sites,
    areas: actual.areas,
    lots: actual.lots,
    deceased: actual.deceased,
    burialRecords: actual.burialRecords,
    availableLots: actual.availableLots,
    pendingCoordinates: actual.pendingCoordinates,
    verifiedCoordinates: actual.verifiedCoordinates,
    coordinateGeometries: actual.coordinateGeometries,
    pendingBurialRecords: actual.pendingBurialRecords,
    releases: actual.releases,
    imports: actual.imports,
    selectors: actual.selectors,
    events: actual.events,
    legacyNodes: actual.legacyNodes,
    legacyEdges: actual.legacyEdges,
    releaseNodes: actual.releaseNodes,
    releaseEdges: actual.releaseEdges,
  },
  hashes: {
    legacyNodeHash: actual.legacyNodeHash,
    legacyEdgeHash: actual.legacyEdgeHash,
  },
  sequences: {
    auditSequence: actual.auditSequence,
    mapEdgeSequence: actual.mapEdgeSequence,
    siteSequence: actual.siteSequence,
    areaSequence: actual.areaSequence,
    lotSequence: actual.lotSequence,
  },
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exit(Object.values(checks).every(Boolean) ? 0 : 1);
