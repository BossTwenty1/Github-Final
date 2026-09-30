import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  DATA_FILE_NAMES,
  PACKAGE_FILE_NAMES,
  PACKAGE_LIMITS,
  computePackageDigest,
} from "../scripts/gis/package-contract.mjs";
import { parseStrictJson } from "../scripts/gis/strict-json.mjs";
import { validatePackageDirectory } from "../scripts/gis/package-validator.mjs";

const ROOT = new URL("../", import.meta.url);
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stableJson(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

async function writeFile(path, data) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await fsWriteFile(path, data);
      return;
    } catch (error) {
      if (error?.code !== "UNKNOWN" || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 25));
    }
  }
}

function polygon(minX, minY, maxX, maxY) {
  return {
    type: "Polygon",
    coordinates: [[
      [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY],
    ]],
  };
}

function common(sourceFeatureId, layerVersion = "v1") {
  return {
    source_feature_id: sourceFeatureId,
    site_id: "1",
    artifact_hash: HASH_A,
    layer_version: layerVersion,
  };
}

function feature(geometry, properties) {
  return { type: "Feature", geometry, properties };
}

function collection(features) {
  return { type: "FeatureCollection", features };
}

function baseData() {
  return {
    "cemetery_boundary.geojson": collection([
      feature(polygon(123.0, 13.0, 123.02, 13.02), {
        ...common("boundary.cemetery"), kind: "cemetery", area_id: null,
      }),
    ]),
    "garden_sections.geojson": collection([
      feature(polygon(123.001, 13.001, 123.019, 13.019), {
        ...common("boundary.pilot"), kind: "area", area_id: "1",
      }),
    ]),
    "roads_walkways.geojson": collection([
      feature({ type: "LineString", coordinates: [[123.002, 13.002], [123.018, 13.018]] }, {
        ...common("walkway.main"), edge_type: "walkway", walking_allowed: true, is_restricted: false,
      }),
    ]),
    "grave_plots.geojson": collection([
      feature(polygon(123.010, 13.010, 123.011, 13.011), {
        ...common("plot.1"), lot_id: "1", area_id: "1",
      }),
    ]),
    "grave_access_points.geojson": collection([
      feature({ type: "Point", coordinates: [123.0105, 13.0105] }, {
        ...common("access.1"), lot_id: "1", area_id: "1", node_source_feature_id: "node.end",
      }),
    ]),
    "route_nodes.geojson": collection([
      feature({ type: "Point", coordinates: [123.002, 13.002] }, {
        ...common("node.entrance"), node_name: "Main entrance", node_type: "entrance",
      }),
      feature({ type: "Point", coordinates: [123.0105, 13.0105] }, {
        ...common("node.end"), node_name: "Pilot path end", node_type: "junction",
      }),
    ]),
    "route_edges.geojson": collection([
      feature({ type: "LineString", coordinates: [[123.002, 13.002], [123.0105, 13.0105]] }, {
        ...common("edge.1"), from_source_feature_id: "node.entrance", to_source_feature_id: "node.end",
        walkway_source_feature_id: "walkway.main", edge_type: "walkway", walking_allowed: true,
        is_restricted: false, direction: "both",
      }),
    ]),
    "landmarks.geojson": collection([]),
    "survey_points.json": [{
      point_code: "GCP-01", site_id: "1", role: "GCP", description: "Synthetic control point",
      source_plan_reference: "synthetic-plan-v1", active: true,
    }, {
      point_code: "VAL-01", site_id: "1", role: "VALIDATION", description: "Synthetic validation point",
      source_plan_reference: "synthetic-plan-v1", active: true,
    }],
    "survey_captures.json": [{
      capture_code: "CAP-GCP-01", point_code: "GCP-01", site_id: "1",
      started_at: "2026-09-28T00:00:00.000Z", ended_at: "2026-09-28T00:05:00.000Z",
      remeasures_capture_code: null, remeasure_required: false,
    }, {
      capture_code: "CAP-VAL-01", point_code: "VAL-01", site_id: "1",
      started_at: "2026-09-28T00:10:00.000Z", ended_at: "2026-09-28T00:15:00.000Z",
      remeasures_capture_code: null, remeasure_required: false,
    }],
    "survey_observations.json": [{
      capture_code: "CAP-GCP-01", observation_order: 1, latitude: 13.002,
      longitude: 123.002, reported_accuracy_m: 0.8, captured_at: "2026-09-28T00:00:30.000Z",
    }, {
      capture_code: "CAP-VAL-01", observation_order: 1, latitude: 13.0105,
      longitude: 123.0105, reported_accuracy_m: 0.9, captured_at: "2026-09-28T00:10:30.000Z",
    }],
    "georeferencing_runs.json": [{
      run_code: "RUN-01", release_code: "PILOT-V1", site_id: "1",
      source_reference: "synthetic-plan.png", source_sha256: HASH_B, source_width: 2000,
      source_height: 1200, source_coordinate_space: "image-pixels", working_srid: 32651,
      output_srid: 4326, method: "projective", processing_parameters: { expected_validation_count: 1 },
      processed_at: "2026-09-28T01:00:00.000Z", qgis_version: "3.40",
      output_artifact_reference: "synthetic-output.tif", output_artifact_sha256: HASH_A,
    }],
    "georeferencing_run_points.json": [{
      run_code: "RUN-01", point_code: "GCP-01", capture_code: "CAP-GCP-01", role: "FITTING",
      source_x: 100, source_y: 100, fitting_residual_m: 0.5,
    }, {
      run_code: "RUN-01", point_code: "VAL-01", capture_code: "CAP-VAL-01", role: "VALIDATION",
      source_x: 900, source_y: 700, fitting_residual_m: null,
    }],
    "georeferencing_validation.json": [{
      run_code: "RUN-01", point_code: "VAL-01",
      transformed_plan_point: { type: "Point", coordinates: [123.01053, 13.01054] },
      review_state: "reviewed",
    }],
  };
}

function manifestFor(fileBytes, overrides = {}) {
  return {
    schema_version: 1,
    package_id: "forest-lake-pilot-v1",
    site_id: "1",
    pilot_area_id: "1",
    release_code: "PILOT-V1",
    title: "Synthetic Forest Lake pilot",
    description: "Fictional validation fixture only",
    source_plan: {
      reference: "synthetic-plan.png", version: "v1", sha256: HASH_B, coordinate_space: "image-pixels",
    },
    crs: { field: 4326, working: 32651, export: 4326 },
    exported_at: "2026-09-28T02:00:00.000Z",
    qgis_version: "3.40",
    selected_run_code: "RUN-01",
    pilot_lot_ids: ["1"],
    provenance_notes: "Synthetic fixture; no production evidence.",
    limitations: ["Not survey-grade."],
    files: DATA_FILE_NAMES.map((name) => ({
      name,
      sha256: sha256(fileBytes[name]),
      bytes: fileBytes[name].byteLength,
      feature_count: JSON.parse(fileBytes[name]).features?.length ?? JSON.parse(fileBytes[name]).length,
      layer_version: "v1",
    })),
    ...overrides,
  };
}

async function writePackage(root, mutate) {
  const data = baseData();
  if (mutate) await mutate(data);
  const fileBytes = Object.fromEntries(Object.entries(data).map(([name, value]) => [name, stableJson(value)]));
  const manifest = manifestFor(fileBytes);
  for (const [name, bytes] of Object.entries(fileBytes)) await writeFile(join(root, name), bytes);
  await writeFile(join(root, "manifest.json"), stableJson(manifest));
  return { data, fileBytes, manifest };
}

async function withPackage(t, mutate) {
  const root = await mkdtemp(join(tmpdir(), "gravenav-gis-package-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixture = await writePackage(root, mutate);
  return { root, ...fixture };
}

async function rewriteDataFile(root, name, value) {
  const bytes = stableJson(value);
  await writeFile(join(root, name), bytes);
  const manifestPath = join(root, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const entry = manifest.files.find((candidate) => candidate.name === name);
  entry.sha256 = sha256(bytes);
  entry.bytes = bytes.byteLength;
  entry.feature_count = value.features?.length ?? value.length;
  await writeFile(manifestPath, stableJson(manifest));
}

async function expectInvalid(root, code, options) {
  const result = await validatePackageDirectory(root, options);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === code), JSON.stringify(result));
  return result;
}

test("strict parser rejects decoded, nested, and malformed duplicate keys", () => {
  assert.throws(() => parseStrictJson(Buffer.from('{"a":1,"\\u0061":2}')), (error) => error.code === "duplicate_json_key");
  assert.throws(() => parseStrictJson(Buffer.from('{"outer":{"x":1,"x":2}}')), (error) => error.code === "duplicate_json_key");
  assert.throws(() => parseStrictJson(Buffer.from('{"a":1,}')), (error) => error.code === "malformed_json");
  assert.deepEqual(parseStrictJson(Buffer.from('[{"x":1},{"x":2}]')), [{ x: 1 }, { x: 2 }]);
});

test("strict parser rejects invalid UTF-8, BOM, nonfinite numbers, unsafe strings, and excessive depth", () => {
  assert.throws(() => parseStrictJson(Buffer.from([0xc3, 0x28])), (error) => error.code === "invalid_utf8");
  assert.throws(() => parseStrictJson(Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d])), (error) => error.code === "json_bom");
  assert.throws(() => parseStrictJson(Buffer.from('{"n":1e9999}')), (error) => error.code === "nonfinite_number");
  assert.throws(() => parseStrictJson(Buffer.from('{"s":"\\uD800"}')), (error) => error.code === "invalid_unicode_escape");
  assert.throws(() => parseStrictJson(Buffer.from(`${"[".repeat(34)}0${"]".repeat(34)}`)), (error) => error.code === "json_depth_exceeded");
});

test("digest contract has an exact golden vector", () => {
  const manifestBytes = Buffer.from('{"schema_version":1}\n');
  const files = [
    { name: "b.json", sha256: "b".repeat(64) },
    { name: "a.json", sha256: "a".repeat(64) },
  ];
  assert.equal(computePackageDigest(manifestBytes, files), "70635b860691d52f3613189d689ccbd63ea1e1c472379156d6b9a7f7d8108411");
});

test("approved 15-file package validates without claiming database validity", async (t) => {
  const { root } = await withPackage(t);
  const result = await validatePackageDirectory(root);
  assert.equal(PACKAGE_FILE_NAMES.length, 15);
  assert.equal(result.valid, true, JSON.stringify(result));
  assert.equal(result.fileCount, 15);
  assert.equal(result.requiresDatabaseValidation, true);
  assert.equal(result.databaseValidationPerformed, false);
  assert.equal(result.errors.length, 0);
});

test("manifest/file digests and counts are authoritative", async (t) => {
  const { root } = await withPackage(t);
  await writeFile(join(root, "route_nodes.geojson"), Buffer.from('{"type":"FeatureCollection","features":[]}\n'));
  await expectInvalid(root, "file_hash_mismatch");

  const second = await withPackage(t);
  const manifestPath = join(second.root, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.files.find((entry) => entry.name === "route_edges.geojson").feature_count = 99;
  await writeFile(manifestPath, stableJson(manifest));
  await expectInvalid(second.root, "file_count_mismatch");
});

test("unsafe identifiers, traversal, undeclared files, and unknown properties are rejected", async (t) => {
  const unsafe = await withPackage(t, (data) => { data["grave_plots.geojson"].features[0].properties.lot_id = "9223372036854775808"; });
  await expectInvalid(unsafe.root, "unsafe_identifier");

  const traversal = await withPackage(t);
  const manifestPath = join(traversal.root, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.files[0].name = "../cemetery_boundary.geojson";
  await writeFile(manifestPath, stableJson(manifest));
  await expectInvalid(traversal.root, "unsafe_file_name");

  const undeclared = await withPackage(t);
  await writeFile(join(undeclared.root, "extra.json"), "{}\n");
  await expectInvalid(undeclared.root, "unexpected_file");

  const unknown = await withPackage(t, (data) => { data["route_nodes.geojson"].features[0].properties.untrusted = true; });
  await expectInvalid(unknown.root, "unknown_property");
});

test("private-name fields are rejected from public GeoJSON properties", async (t) => {
  const deceased = await withPackage(t, (data) => { data["landmarks.geojson"].features.push(feature({ type: "Point", coordinates: [123.01, 13.01] }, { ...common("landmark.1"), kind: "landmark", label: "Office", deceased_name: "PRIVATE" })); });
  await expectInvalid(deceased.root, "private_field_forbidden");

  const owner = await withPackage(t, (data) => { data["grave_plots.geojson"].features[0].properties.owner_name = "PRIVATE"; });
  await expectInvalid(owner.root, "private_field_forbidden");
});

test("CRS, geometry type, coordinate range, ring closure, and duplicate IDs are enforced", async (t) => {
  const wrongCrs = await withPackage(t);
  const manifestPath = join(wrongCrs.root, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.crs.export = 3857;
  await writeFile(manifestPath, stableJson(manifest));
  await expectInvalid(wrongCrs.root, "invalid_crs");

  const wrongType = await withPackage(t, (data) => { data["grave_plots.geojson"].features[0].geometry = { type: "Point", coordinates: [123.01, 13.01] }; });
  await expectInvalid(wrongType.root, "invalid_geometry_type");

  const badRange = await withPackage(t, (data) => { data["route_nodes.geojson"].features[0].geometry.coordinates = [200, 13]; });
  await expectInvalid(badRange.root, "invalid_coordinate");

  const openRing = await withPackage(t, (data) => { data["grave_plots.geojson"].features[0].geometry.coordinates[0][4] = [123.0105, 13.0105]; });
  await expectInvalid(openRing.root, "unclosed_polygon_ring");

  const duplicate = await withPackage(t, (data) => { data["route_nodes.geojson"].features.push(structuredClone(data["route_nodes.geojson"].features[0])); });
  await expectInvalid(duplicate.root, "duplicate_source_feature_id");
});

test("required geometry and approved count bounds are enforced", async (t) => {
  const emptyBoundary = await withPackage(t, (data) => { data["cemetery_boundary.geojson"].features = []; });
  await expectInvalid(emptyBoundary.root, "feature_count_out_of_range");

  const tooManyNodes = await withPackage(t, (data) => {
    data["route_nodes.geojson"].features = Array.from({ length: 201 }, (_, index) => feature(
      { type: "Point", coordinates: [123.002 + index * 0.000001, 13.002] },
      { ...common(`node.${index}`), node_name: `Node ${index}`, node_type: index === 0 ? "entrance" : "junction" },
    ));
  });
  await expectInvalid(tooManyNodes.root, "feature_count_out_of_range");
});

test("manifest, per-file, total-package, and aggregate evidence limits are enforced before trust", async (t) => {
  const manifestLarge = await withPackage(t);
  const manifestPath = join(manifestLarge.root, "manifest.json");
  await writeFile(manifestPath, Buffer.alloc(PACKAGE_LIMITS.maxManifestBytes + 1, 0x20));
  await expectInvalid(manifestLarge.root, "manifest_too_large");

  const fileLarge = await withPackage(t);
  await writeFile(join(fileLarge.root, "survey_observations.json"), Buffer.alloc(PACKAGE_LIMITS.maxDataFileBytes + 1, 0x20));
  await expectInvalid(fileLarge.root, "file_too_large");

  const totalLarge = await withPackage(t);
  await writeFile(join(totalLarge.root, "survey_observations.json"), Buffer.alloc(PACKAGE_LIMITS.maxDataFileBytes, 0x20));
  await writeFile(join(totalLarge.root, "survey_captures.json"), Buffer.alloc(PACKAGE_LIMITS.maxDataFileBytes, 0x20));
  await expectInvalid(totalLarge.root, "package_too_large");

  const aggregate = await withPackage(t);
  const rows = Array.from({ length: 2001 }, (_, index) => ({
    run_code: "RUN-01", point_code: `GCP-${index}`, capture_code: `CAP-${index}`,
    role: "FITTING", source_x: index, source_y: index, fitting_residual_m: 0,
  }));
  const results = Array.from({ length: 2000 }, (_, index) => ({
    run_code: "RUN-01", point_code: `VAL-${index}`,
    transformed_plan_point: { type: "Point", coordinates: [123.01, 13.01] }, review_state: "reviewed",
  }));
  await rewriteDataFile(aggregate.root, "georeferencing_run_points.json", rows);
  await rewriteDataFile(aggregate.root, "georeferencing_validation.json", results);
  await expectInvalid(aggregate.root, "aggregate_membership_result_limit");
});

test("symlinked package files are rejected", async (t) => {
  const { root } = await withPackage(t);
  const target = join(root, "route_nodes.real");
  const link = join(root, "route_nodes.geojson");
  await writeFile(target, await readFile(link));
  await rm(link);
  try {
    await symlink(target, link, "file");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) return t.skip(`symlink unavailable: ${error.code}`);
    throw error;
  }
  await expectInvalid(root, "unsafe_file_type");
});

test("junction-like directory aliases are rejected", async (t) => {
  const junction = await withPackage(t);
  const outside = await mkdtemp(join(tmpdir(), "gravenav-gis-junction-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await rm(join(junction.root, "landmarks.geojson"));
  try {
    await symlink(outside, join(junction.root, "landmarks.geojson"), "junction");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOSYS"].includes(error.code)) return t.skip(`junction unavailable: ${error.code}`);
    throw error;
  }
  await expectInvalid(junction.root, "unsafe_file_type");
});

test("changed files are rejected by the stable-read guard", async (t) => {
  const { root } = await withPackage(t);
  let changed = false;
  await expectInvalid(root, "file_changed_during_validation", {
    async afterFileRead({ name, path }) {
      if (!changed && name === "route_nodes.geojson") {
        changed = true;
        await writeFile(path, Buffer.from('{"type":"FeatureCollection","features":[]}\n'));
      }
    },
  });
});

test("CLI returns deterministic redacted JSON for valid and invalid packages", async (t) => {
  const { root } = await withPackage(t);
  const cli = fileURLToPath(new URL("../scripts/validate-gis-package.mjs", import.meta.url));
  const valid = spawnSync(process.execPath, [cli, root], { cwd: fileURLToPath(ROOT), encoding: "utf8" });
  assert.equal(valid.status, 0, valid.stderr || valid.stdout);
  const validResult = JSON.parse(valid.stdout);
  assert.equal(validResult.valid, true);
  assert.equal(validResult.requiresDatabaseValidation, true);
  assert.equal(valid.stdout.includes(root), false);

  await writeFile(join(root, "undeclared-private.json"), '{"secret":"must-not-echo"}\n');
  const invalidOne = spawnSync(process.execPath, [cli, root], { cwd: fileURLToPath(ROOT), encoding: "utf8" });
  const invalidTwo = spawnSync(process.execPath, [cli, root], { cwd: fileURLToPath(ROOT), encoding: "utf8" });
  assert.equal(invalidOne.status, 1);
  assert.equal(invalidOne.stdout, invalidTwo.stdout);
  assert.equal(invalidOne.stdout.includes(root), false);
  assert.equal(invalidOne.stdout.includes("must-not-echo"), false);
  assert.ok(JSON.parse(invalidOne.stdout).errors.some((error) => error.code === "unexpected_file"));
});

test("offline validator has no Supabase client dependency", async () => {
  for (const name of ["package-contract.mjs", "strict-json.mjs", "package-validator.mjs", "../validate-gis-package.mjs"]) {
    const source = await readFile(new URL(`../scripts/gis/${name}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /@supabase|createClient\s*\(/);
  }
});
