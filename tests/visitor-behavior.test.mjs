import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
function load(file, dependencies = {}) {
  const source = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", output)((name) => {
    if (!(name in dependencies)) throw Error("Unexpected dependency " + name);
    return dependencies[name];
  }, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const geo = load("src/lib/navigation-geo.ts");
test("live location emits updates, propagates denial, and stops even when watch id is zero", () => {
  let success, fail, cleared;
  const positions = [], errors = [];
  const stop = geo.subscribeToLocation({
    watchPosition(onSuccess, onError, options) { success = onSuccess; fail = onError; assert.equal(options.enableHighAccuracy, true); return 0; },
    clearWatch(id) { cleared = id; },
  }, (p) => positions.push(p), (e) => errors.push(e));
  const reading = { coords: { longitude: 123, latitude: 13, accuracy: 4 }, timestamp: Date.now() };
  success(reading); success({ ...reading, coords: { ...reading.coords, latitude: 13.001 } });
  fail({ code: 1 });
  assert.equal(positions.length, 2); assert.equal(errors[0].code, 1);
  stop(); success(reading); fail({ code: 2 });
  assert.equal(cleared, 0); assert.equal(positions.length, 2); assert.equal(errors.length, 1);
});
test("arrival language is gated by fresh, sufficiently accurate nearby readings", () => {
  const now = Date.now(), destination = { longitude: 123, latitude: 13 };
  const position = { ...destination, accuracy: 4, timestamp: now };
  assert.equal(geo.nearPlot(position, destination, now), true);
  assert.equal(geo.nearPlot({ ...position, accuracy: 80 }, destination, now), false);
  assert.equal(geo.nearPlot({ ...position, timestamp: now - 31000 }, destination, now), false);
  assert.equal(geo.nearPlot({ ...position, latitude: 13.01 }, destination, now), false);
  assert.equal(geo.usablePosition({ ...position, longitude: NaN }, now), false);
});
const mapModule = load("src/lib/phase1-map-data.ts", { "@/lib/map-layout": { schematicImageWidth: 100, schematicImageHeight: 100 }, "@/lib/supabase/config": {} });
const routing = load("src/lib/phase1-routing.ts", { "@/lib/phase1-map-data": mapModule });
test("route recalculates from new positions and ends on the path, with recorded landmarks only", () => {
  const map = {
    geographicBounds: { minLongitude: 0, minLatitude: 0, maxLongitude: 1, maxLatitude: 1 },
    nodes: [
      { properties: { id: "a", name: "Main entrance", node_type: "entrance" }, schematicPosition: [0, 0] },
      { properties: { id: "b", name: "Recorded landmark", node_type: "landmark" }, schematicPosition: [0, 40] },
      { properties: { id: "c", name: "Path end", node_type: "junction" }, schematicPosition: [0, 80] },
    ],
    edges: { features: [
      { properties: { from_node_id: "a", to_node_id: "b", distance_m: 40 }, geometry: { coordinates: [[0,0],[40,0]] } },
      { properties: { from_node_id: "b", to_node_id: "c", distance_m: 40 }, geometry: { coordinates: [[40,0],[80,0]] } },
    ] },
  };
  const destination = { longitude: 0.9, latitude: 0.1 };
  const first = routing.findShortestPhaseOneRoute(map, destination);
  const walked = routing.findShortestPhaseOneRoute(map, destination, { longitude: 0.4, latitude: 0 });
  assert.equal(first.distanceM, 80); assert.equal(walked.distanceM, 40);
  assert.deepEqual(first.coordinates.at(-1), [0,80]);
  assert.ok(first.instructions.some((i) => i.includes("Recorded landmark")));
  map.edges.features[1].properties.is_restricted = true;
  const restricted = routing.findShortestPhaseOneRoute(map, destination);
  assert.deepEqual(restricted.coordinates.at(-1), [0,40]);
  assert.equal(routing.findShortestPhaseOneRoute(map, destination, { longitude: 5, latitude: 5 }), null);
});
function publicModule(response) {
  const query = { select() { return this; }, order() { return this; }, limit() { return Promise.resolve(response); }, eq() { return this; }, maybeSingle() { return Promise.resolve(response); } };
  return load("src/lib/supabase/public-data.ts", {
    "./config": { getPublicSupabase: () => ({ from: () => query, rpc: async () => response }), localSupabaseConfig: { environment: "hosted" } },
    "@/lib/mock-data": {}, "@/lib/map-layout": { phaseOneGardenNames: [] },
  });
}
test("database errors are distinct from a successful empty search", async () => {
  await assert.rejects(publicModule({ data: null, error: { message: "private database details" } }).searchPublicBurials({ query: "Maria" }), /temporarily unavailable/);
  const result = await publicModule({ data: { items: [], total: 0 }, error: null }).searchPublicBurials();
  assert.equal(result.total, 0); assert.deepEqual(result.items, []);
  await assert.rejects(publicModule({ data: null, error: {} }).getPublicBurialRecord("1"), /temporarily unavailable/);
});
test("public burial dates use interment dates, never death dates", async () => {
  const row = { burial_id: 1, display_name: "Test", death_date: "2020-01-01", birth_date: null, lot_code: "A", interment_date: "2020-01-05" };
  const record = await publicModule({ data: row, error: null }).getPublicBurialRecord("1");
  assert.equal(record.burialDate.includes("05") || record.burialDate.includes("5,"), true);
  const missing = await publicModule({ data: { ...row, interment_date: null }, error: null }).getPublicBurialRecord("1");
  assert.equal(missing.burialDate, "Not recorded");
});

test("development demo profiles retain slug IDs while hosted lookups require numeric IDs", async () => {
  const demo = { id: "demo-person", name: "Demo Person" };
  const local = load("src/lib/supabase/public-data.ts", {
    "./config": { getPublicSupabase: () => null, localSupabaseConfig: { environment: "local" } },
    "@/lib/mock-data": { getGravesiteById: (id) => id === demo.id ? demo : null },
    "@/lib/map-layout": { phaseOneGardenNames: [] },
  });
  assert.equal((await local.getPublicBurialRecord(demo.id)).id, demo.id);
  assert.equal(await publicModule({ data: null, error: {} }).getPublicBurialRecord(demo.id), null);
});
