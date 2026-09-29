import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(file, dependencies = {}) {
  const source = readFileSync(new URL("../" + file, import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const loadedModule = { exports: {} };

  new Function("require", "module", "exports", output)(
    (name) => {
      if (!(name in dependencies)) throw Error("Unexpected dependency " + name);
      return dependencies[name];
    },
    loadedModule,
    loadedModule.exports,
  );

  return loadedModule.exports;
}

function createQuerySpy() {
  const operations = new Map();
  const rows = {
    site: [
      {
        site_id: 1,
        site_name: "Forest Lake Memorial Park",
        boundary_geom: {
          type: "Polygon",
          coordinates: [[[123, 13], [123.02, 13], [123.02, 13.02], [123, 13.02], [123, 13]]],
        },
      },
    ],
    area: [
      {
        area_id: 1,
        site_id: 1,
        area_code: "DPG",
        area_name: "Diamond Private Garden",
        area_category: "garden",
        boundary_geom: {
          type: "Polygon",
          coordinates: [[[123.001, 13.001], [123.01, 13.001], [123.01, 13.01], [123.001, 13.01], [123.001, 13.001]]],
        },
      },
    ],
    map_node: [
      {
        node_id: 1,
        site_id: 1,
        node_name: "Entrance",
        node_type: "entrance",
        px_loc_x: null,
        px_loc_y: null,
        location_geom: { type: "Point", coordinates: [123.002, 13.002] },
      },
      {
        node_id: 2,
        site_id: 1,
        node_name: "Path end",
        node_type: "junction",
        px_loc_x: null,
        px_loc_y: null,
        location_geom: { type: "Point", coordinates: [123.009, 13.009] },
      },
    ],
    map_edge: [
      {
        edge_id: 1,
        from_node_id: 1,
        to_node_id: 2,
        path_geom: { type: "LineString", coordinates: [[123.002, 13.002], [123.009, 13.009]] },
        distance_m: 100,
        edge_type: "path",
        is_restricted: false,
      },
    ],
  };

  const client = {
    from(table) {
      const calls = [];
      operations.set(table, calls);
      const builder = {
        select(columns) {
          calls.push(["select", columns]);
          return this;
        },
        eq(column, value) {
          calls.push(["eq", column, value]);
          return this;
        },
        in(column, values) {
          calls.push(["in", column, values]);
          return this;
        },
        is(column, value) {
          calls.push(["is", column, value]);
          return this;
        },
        order(column) {
          calls.push(["order", column]);
          return this;
        },
        then(resolve, reject) {
          return Promise.resolve({ data: rows[table], error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };

  return { client, operations };
}

async function loadWithSpy() {
  const { client, operations } = createQuerySpy();
  const mapModule = load("src/lib/phase1-map-data.ts", {
    "@/lib/map-layout": {
      schematicImageWidth: 100,
      schematicImageHeight: 100,
    },
    "@/lib/supabase/config": {
      getBrowserSupabase: () => client,
    },
  });

  return {
    result: await mapModule.loadPhaseOneMapDataFromSupabase(),
    operations,
  };
}

test("legacy graph queries exclude release-owned nodes and edges", async () => {
  const { operations } = await loadWithSpy();

  assert.deepEqual(operations.get("map_node"), [
    ["select", "node_id,site_id,node_name,node_type,px_loc_x,px_loc_y,location_geom"],
    ["is", "mapping_release_id", null],
    ["order", "node_id"],
  ]);
  assert.deepEqual(operations.get("map_edge"), [
    ["select", "edge_id,from_node_id,to_node_id,path_geom,distance_m,edge_type,is_restricted"],
    ["is", "mapping_release_id", null],
    ["order", "edge_id"],
  ]);
});

test("legacy isolation preserves the existing query contract and usable network", async () => {
  const { result, operations } = await loadWithSpy();

  assert.deepEqual(operations.get("site"), [
    ["select", "site_id,site_name,boundary_geom"],
    ["order", "site_id"],
  ]);
  assert.deepEqual(operations.get("area"), [
    ["select", "area_id,site_id,area_code,area_name,area_category,boundary_geom"],
    ["eq", "area_category", "garden"],
    ["in", "area_code", ["DPG", "HPG", "RPG", "YPG"]],
  ]);
  assert.equal(result.nodes.length, 2);
  assert.equal(result.edges.features.length, 1);
  assert.equal(result.areas.features.length, 1);
  assert.equal(result.warnings.length, 0);
});
