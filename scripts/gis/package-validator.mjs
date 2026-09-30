import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  DATA_FILE_NAMES,
  EVIDENCE_CONTRACTS,
  EVIDENCE_FILE_NAMES,
  GEOJSON_CONTRACTS,
  GEOJSON_FILE_NAMES,
  IDENTIFIER_PATTERNS,
  MANIFEST_FILE_NAME,
  PACKAGE_FILE_NAMES,
  PACKAGE_LIMITS,
  PRIVATE_PUBLIC_PROPERTY_NAMES,
  computePackageDigest,
  computeSha256,
  sortValidationErrors,
  validationError,
} from "./package-contract.mjs";
import { StrictJsonError, parseStrictJson } from "./strict-json.mjs";

const MANIFEST_KEYS = [
  "schema_version", "package_id", "site_id", "pilot_area_id", "release_code", "title", "description",
  "source_plan", "crs", "exported_at", "qgis_version", "selected_run_code", "pilot_lot_ids",
  "provenance_notes", "limitations", "files",
];
const SOURCE_PLAN_KEYS = ["reference", "version", "sha256", "coordinate_space"];
const CRS_KEYS = ["field", "working", "export"];
const FILE_ENTRY_KEYS = ["name", "sha256", "bytes", "feature_count", "layer_version"];
const FEATURE_KEYS = ["type", "geometry", "properties"];
const GEOJSON_KEYS = ["type", "features"];
const MAX_BIGINT = 9_223_372_036_854_775_807n;

class PackageReadError extends Error {
  constructor(code, file = null) {
    super(code);
    this.code = code;
    this.file = file;
  }
}

export async function validatePackageDirectory(root, options = {}) {
  const errors = [];
  let errorCount = 0;
  const counts = {};
  let totalBytes = 0;
  let packageDigest = null;
  let manifest = null;

  function add(code, file = null, field = null) {
    errorCount += 1;
    if (errors.length < PACKAGE_LIMITS.maxErrors) errors.push(validationError(code, file, field));
  }

  function report() {
    return Object.freeze({
      schemaVersion: 1,
      valid: errorCount === 0,
      requiresDatabaseValidation: true,
      databaseValidationPerformed: false,
      packageDigest: errorCount === 0 ? packageDigest : null,
      fileCount: PACKAGE_FILE_NAMES.length,
      totalBytes,
      counts: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
      errorCount,
      errorsTruncated: errorCount > errors.length,
      errors: sortValidationErrors(errors),
    });
  }

  if (typeof root !== "string" || root.length === 0) {
    add("invalid_package_directory");
    return report();
  }

  const requestedRoot = resolve(root);
  let rootStat;
  let safeRoot;
  try {
    rootStat = await lstat(requestedRoot);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
      add("unsafe_package_directory");
      return report();
    }
    safeRoot = await realpath(requestedRoot);
  } catch {
    add("invalid_package_directory");
    return report();
  }

  let directoryEntries;
  try {
    directoryEntries = await readdir(safeRoot, { withFileTypes: true });
  } catch {
    add("filesystem_error");
    return report();
  }
  directoryEntries.sort((left, right) => left.name.localeCompare(right.name));

  const expected = new Set(PACKAGE_FILE_NAMES);
  const found = new Map();
  for (const entry of directoryEntries) {
    if (!expected.has(entry.name)) add("unexpected_file", entry.name);
    if (found.has(entry.name)) add("duplicate_file_name", entry.name);
    found.set(entry.name, entry);
    if (entry.isSymbolicLink() || !entry.isFile()) add("unsafe_file_type", entry.name);
  }
  for (const name of PACKAGE_FILE_NAMES) if (!found.has(name)) add("missing_file", name);

  const initialStats = new Map();
  for (const name of PACKAGE_FILE_NAMES) {
    const entry = found.get(name);
    if (!entry || entry.isSymbolicLink() || !entry.isFile()) continue;
    try {
      const stat = await lstat(join(safeRoot, name));
      if (stat.isSymbolicLink() || !stat.isFile()) {
        add("unsafe_file_type", name);
        continue;
      }
      initialStats.set(name, stat);
      totalBytes += stat.size;
      if (name === MANIFEST_FILE_NAME && stat.size > PACKAGE_LIMITS.maxManifestBytes) add("manifest_too_large", name);
      if (name !== MANIFEST_FILE_NAME && stat.size > PACKAGE_LIMITS.maxDataFileBytes) add("file_too_large", name);
    } catch {
      add("filesystem_error", name);
    }
  }
  if (totalBytes > PACKAGE_LIMITS.maxPackageBytes) add("package_too_large");

  if (errors.some((error) => ["unsafe_file_type", "missing_file", "manifest_too_large", "file_too_large", "package_too_large", "filesystem_error"].includes(error.code))) {
    return report();
  }

  const bytesByName = new Map();
  for (const name of PACKAGE_FILE_NAMES) {
    try {
      const bytes = await readStableFile(safeRoot, name, options);
      bytesByName.set(name, bytes);
    } catch (error) {
      add(error?.code || "filesystem_error", error?.file || name);
    }
  }
  if (errorCount > 0) return report();

  try {
    const finalEntries = (await readdir(safeRoot, { withFileTypes: true })).map((entry) => entry.name).sort();
    const initialNames = directoryEntries.map((entry) => entry.name).sort();
    if (JSON.stringify(finalEntries) !== JSON.stringify(initialNames)) add("package_changed_during_validation");
  } catch {
    add("filesystem_error");
  }
  if (errorCount > 0) return report();

  const parsed = new Map();
  let packageNodes = 0;
  for (const name of PACKAGE_FILE_NAMES) {
    try {
      const value = parseStrictJson(bytesByName.get(name), {
        maxDepth: PACKAGE_LIMITS.maxDepth,
        maxNodes: PACKAGE_LIMITS.maxNodesPerFile,
        maxStringLength: PACKAGE_LIMITS.maxStringLength,
      });
      parsed.set(name, value);
      packageNodes += countJsonNodes(value);
      if (packageNodes > PACKAGE_LIMITS.maxNodesPerPackage) add("package_json_node_limit");
    } catch (error) {
      add(error instanceof StrictJsonError ? error.code : "malformed_json", name);
    }
  }
  if (errorCount > 0) return report();

  manifest = parsed.get(MANIFEST_FILE_NAME);
  validateManifest(manifest, add);
  if (!isPlainObject(manifest) || !Array.isArray(manifest.files)) return report();

  const declaredNames = new Set();
  const declaredFiles = [];
  for (let index = 0; index < manifest.files.length; index += 1) {
    const entry = manifest.files[index];
    const field = `files[${index}]`;
    if (!isPlainObject(entry)) {
      add("invalid_manifest_file_entry", MANIFEST_FILE_NAME, field);
      continue;
    }
    exactKeys(entry, FILE_ENTRY_KEYS, [], add, MANIFEST_FILE_NAME, field);
    if (!isSafePackageFileName(entry.name) || !DATA_FILE_NAMES.includes(entry.name)) add("unsafe_file_name", MANIFEST_FILE_NAME, `${field}.name`);
    if (declaredNames.has(entry.name)) add("duplicate_manifest_file", MANIFEST_FILE_NAME, `${field}.name`);
    declaredNames.add(entry.name);
    if (!IDENTIFIER_PATTERNS.sha256.test(entry.sha256 || "")) add("invalid_sha256", MANIFEST_FILE_NAME, `${field}.sha256`);
    if (!isBoundedInteger(entry.bytes, 0, PACKAGE_LIMITS.maxDataFileBytes)) add("invalid_file_bytes", MANIFEST_FILE_NAME, `${field}.bytes`);
    if (!isBoundedInteger(entry.feature_count, 0, 20_000)) add("invalid_feature_count", MANIFEST_FILE_NAME, `${field}.feature_count`);
    if (!isSourceId(entry.layer_version)) add("unsafe_identifier", MANIFEST_FILE_NAME, `${field}.layer_version`);
    declaredFiles.push(entry);
  }
  if (manifest.files.length !== DATA_FILE_NAMES.length || DATA_FILE_NAMES.some((name) => !declaredNames.has(name))) add("manifest_file_set_mismatch", MANIFEST_FILE_NAME);
  if (declaredNames.has(MANIFEST_FILE_NAME)) add("manifest_self_reference", MANIFEST_FILE_NAME);

  for (const entry of declaredFiles) {
    if (!DATA_FILE_NAMES.includes(entry.name)) continue;
    const bytes = bytesByName.get(entry.name);
    if (!bytes) continue;
    if (entry.bytes !== bytes.byteLength) add("file_size_mismatch", entry.name);
    if (entry.sha256 !== computeSha256(bytes)) add("file_hash_mismatch", entry.name);
  }

  packageDigest = computePackageDigest(bytesByName.get(MANIFEST_FILE_NAME), declaredFiles);

  let geometryVertices = 0;
  const sourceIdsByFile = new Map();
  for (const name of GEOJSON_FILE_NAMES) {
    const value = parsed.get(name);
    const result = validateGeoJson(name, value, manifest, add);
    counts[name] = result.count;
    geometryVertices += result.vertices;
    sourceIdsByFile.set(name, result.sourceIds);
    const declaration = declaredFiles.find((entry) => entry.name === name);
    if (declaration && declaration.feature_count !== result.count) add("file_count_mismatch", name);
  }
  if (geometryVertices > PACKAGE_LIMITS.maxGeometryVertices) add("geometry_vertex_limit");
  counts.geometry_vertices = geometryVertices;

  const evidenceRows = new Map();
  for (const name of EVIDENCE_FILE_NAMES) {
    const value = parsed.get(name);
    const rows = validateEvidence(name, value, manifest, add);
    evidenceRows.set(name, rows);
    counts[name] = rows.length;
    const declaration = declaredFiles.find((entry) => entry.name === name);
    if (declaration && declaration.feature_count !== rows.length) add("file_count_mismatch", name);
  }
  if ((counts["georeferencing_run_points.json"] || 0) + (counts["georeferencing_validation.json"] || 0) > PACKAGE_LIMITS.maxMembershipsAndResults) {
    add("aggregate_membership_result_limit");
  }

  validateInternalReferences(parsed, evidenceRows, sourceIdsByFile, manifest, add);
  return report();
}

async function readStableFile(root, name, options) {
  if (!isSafePackageFileName(name) || basename(name) !== name || isAbsolute(name)) throw new PackageReadError("unsafe_file_name", name);
  const path = join(root, name);
  if (relative(root, path).startsWith(`..${sep}`) || dirname(path) !== root) throw new PackageReadError("unsafe_file_name", name);
  const before = await lstat(path);
  if (before.isSymbolicLink() || !before.isFile()) throw new PackageReadError("unsafe_file_type", name);
  if ((await realpath(path)) !== path) throw new PackageReadError("unsafe_file_alias", name);

  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW || 0);
  const handle = await open(path, flags);
  let first;
  let firstOpenStat;
  let afterOpenStat;
  try {
    firstOpenStat = await handle.stat();
    first = await handle.readFile();
    if (typeof options.afterFileRead === "function") await options.afterFileRead({ name, path });
    afterOpenStat = await handle.stat();
  } finally {
    await handle.close();
  }

  const pathAfter = await lstat(path);
  if (pathAfter.isSymbolicLink() || !pathAfter.isFile() || (await realpath(path)) !== path) throw new PackageReadError("file_changed_during_validation", name);
  const secondHandle = await open(path, flags);
  let second;
  let secondOpenStat;
  try {
    secondOpenStat = await secondHandle.stat();
    second = await secondHandle.readFile();
  } finally {
    await secondHandle.close();
  }
  const finalStat = await lstat(path);
  if (![firstOpenStat, afterOpenStat, pathAfter, secondOpenStat, finalStat].every((stat) => sameFileStat(before, stat)) || computeSha256(first) !== computeSha256(second)) {
    throw new PackageReadError("file_changed_during_validation", name);
  }
  return first;
}

function sameFileStat(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

function isSafePackageFileName(name) {
  return typeof name === "string" && name.length > 0 && name === basename(name) &&
    !name.includes("/") && !name.includes("\\") && name !== "." && name !== ".." && !name.includes("\0");
}

function validateManifest(value, add) {
  if (!isPlainObject(value)) {
    add("invalid_manifest", MANIFEST_FILE_NAME);
    return;
  }
  exactKeys(value, MANIFEST_KEYS, [], add, MANIFEST_FILE_NAME, "manifest");
  if (value.schema_version !== 1) add("unsupported_schema_version", MANIFEST_FILE_NAME, "schema_version");
  if (!isSourceId(value.package_id)) add("unsafe_identifier", MANIFEST_FILE_NAME, "package_id");
  for (const field of ["site_id", "pilot_area_id"]) if (!isDecimalId(value[field])) add("unsafe_identifier", MANIFEST_FILE_NAME, field);
  for (const field of ["release_code", "selected_run_code"]) if (!isSourceId(value[field])) add("unsafe_identifier", MANIFEST_FILE_NAME, field);
  boundedText(value.title, 200, add, MANIFEST_FILE_NAME, "title");
  boundedText(value.description, 2_000, add, MANIFEST_FILE_NAME, "description", true);
  boundedText(value.qgis_version, 100, add, MANIFEST_FILE_NAME, "qgis_version");
  boundedText(value.provenance_notes, 2_000, add, MANIFEST_FILE_NAME, "provenance_notes", true);
  if (!isIsoDate(value.exported_at)) add("invalid_timestamp", MANIFEST_FILE_NAME, "exported_at");

  if (!isPlainObject(value.source_plan)) add("invalid_source_plan", MANIFEST_FILE_NAME, "source_plan");
  else {
    exactKeys(value.source_plan, SOURCE_PLAN_KEYS, [], add, MANIFEST_FILE_NAME, "source_plan");
    boundedText(value.source_plan.reference, 1_024, add, MANIFEST_FILE_NAME, "source_plan.reference");
    if (!isSourceId(value.source_plan.version)) add("unsafe_identifier", MANIFEST_FILE_NAME, "source_plan.version");
    if (!IDENTIFIER_PATTERNS.sha256.test(value.source_plan.sha256 || "")) add("invalid_sha256", MANIFEST_FILE_NAME, "source_plan.sha256");
    boundedText(value.source_plan.coordinate_space, 500, add, MANIFEST_FILE_NAME, "source_plan.coordinate_space");
  }

  if (!isPlainObject(value.crs)) add("invalid_crs", MANIFEST_FILE_NAME, "crs");
  else {
    exactKeys(value.crs, CRS_KEYS, [], add, MANIFEST_FILE_NAME, "crs");
    if (value.crs.field !== 4326 || value.crs.working !== 32651 || value.crs.export !== 4326) add("invalid_crs", MANIFEST_FILE_NAME, "crs");
  }

  if (!Array.isArray(value.pilot_lot_ids) || value.pilot_lot_ids.length < 1 || value.pilot_lot_ids.length > PACKAGE_LIMITS.maxPlots) add("invalid_pilot_lot_ids", MANIFEST_FILE_NAME, "pilot_lot_ids");
  else {
    const seen = new Set();
    for (const id of value.pilot_lot_ids) {
      if (!isDecimalId(id)) add("unsafe_identifier", MANIFEST_FILE_NAME, "pilot_lot_ids");
      if (seen.has(id)) add("duplicate_identifier", MANIFEST_FILE_NAME, "pilot_lot_ids");
      seen.add(id);
    }
  }
  if (!Array.isArray(value.limitations) || value.limitations.length > 100) add("invalid_limitations", MANIFEST_FILE_NAME, "limitations");
  else for (const item of value.limitations) boundedText(item, 2_000, add, MANIFEST_FILE_NAME, "limitations", true);
  if (!Array.isArray(value.files)) add("invalid_manifest_files", MANIFEST_FILE_NAME, "files");
}

function validateGeoJson(name, value, manifest, add) {
  const contract = GEOJSON_CONTRACTS[name];
  if (!isPlainObject(value)) {
    add("invalid_geojson", name);
    return { count: 0, vertices: 0, sourceIds: new Set() };
  }
  exactKeys(value, GEOJSON_KEYS, [], add, name, "root");
  if (value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    add("invalid_geojson", name);
    return { count: 0, vertices: 0, sourceIds: new Set() };
  }
  if (value.features.length < contract.min || value.features.length > contract.max) add("feature_count_out_of_range", name);
  const sourceIds = new Set();
  let vertices = 0;
  for (let index = 0; index < value.features.length; index += 1) {
    const item = value.features[index];
    const base = `features[${index}]`;
    if (!isPlainObject(item)) {
      add("invalid_feature", name, base);
      continue;
    }
    exactKeys(item, FEATURE_KEYS, [], add, name, base);
    if (item.type !== "Feature" || !isPlainObject(item.geometry) || !isPlainObject(item.properties)) {
      add("invalid_feature", name, base);
      continue;
    }
    for (const key of Object.keys(item.properties)) if (PRIVATE_PUBLIC_PROPERTY_NAMES.has(key)) add("private_field_forbidden", name, `${base}.properties.${key}`);
    exactKeys(item.properties, contract.required, contract.optional, add, name, `${base}.properties`);
    validateCommonProperties(item.properties, manifest, add, name, base);
    const sourceId = item.properties.source_feature_id;
    if (sourceIds.has(sourceId)) add("duplicate_source_feature_id", name, `${base}.properties.source_feature_id`);
    sourceIds.add(sourceId);
    vertices += validateGeometry(item.geometry, contract.geometryTypes, add, name, `${base}.geometry`);
    validateLayerProperties(name, item.properties, add, base);
  }
  return { count: value.features.length, vertices, sourceIds };
}

function validateCommonProperties(properties, manifest, add, file, base) {
  if (!isSourceId(properties.source_feature_id)) add("unsafe_identifier", file, `${base}.properties.source_feature_id`);
  if (!isDecimalId(properties.site_id) || properties.site_id !== manifest.site_id) add("unsafe_identifier", file, `${base}.properties.site_id`);
  if (!IDENTIFIER_PATTERNS.sha256.test(properties.artifact_hash || "")) add("invalid_sha256", file, `${base}.properties.artifact_hash`);
  if (!isSourceId(properties.layer_version)) add("unsafe_identifier", file, `${base}.properties.layer_version`);
}

function validateLayerProperties(name, properties, add, base) {
  const field = (key) => `${base}.properties.${key}`;
  if (name === "cemetery_boundary.geojson" && (properties.kind !== "cemetery" || properties.area_id !== null)) add("invalid_boundary_scope", name, field("kind"));
  if (name === "garden_sections.geojson" && (properties.kind !== "area" || !isDecimalId(properties.area_id))) add("invalid_boundary_scope", name, field("area_id"));
  if (["grave_plots.geojson", "grave_access_points.geojson"].includes(name)) {
    if (!isDecimalId(properties.lot_id) || !isDecimalId(properties.area_id)) add("unsafe_identifier", name, field("lot_id"));
  }
  for (const key of ["node_source_feature_id", "from_source_feature_id", "to_source_feature_id", "walkway_source_feature_id"]) {
    if (key in properties && !isSourceId(properties[key])) add("unsafe_identifier", name, field(key));
  }
  if (name === "roads_walkways.geojson" && !["road", "walkway", "path", "entrance"].includes(properties.edge_type)) add("invalid_enum", name, field("edge_type"));
  if (name === "route_nodes.geojson") {
    boundedText(properties.node_name, 200, add, name, field("node_name"));
    if (!["entrance", "junction", "access", "landmark"].includes(properties.node_type)) add("invalid_enum", name, field("node_type"));
  }
  if (name === "route_edges.geojson") {
    if (!["road", "walkway", "path", "entrance"].includes(properties.edge_type)) add("invalid_enum", name, field("edge_type"));
    if (!["both", "forward", "reverse"].includes(properties.direction)) add("invalid_enum", name, field("direction"));
  }
  if (["roads_walkways.geojson", "route_edges.geojson"].includes(name)) {
    for (const key of ["walking_allowed", "is_restricted"]) if (typeof properties[key] !== "boolean") add("invalid_boolean", name, field(key));
  }
  if (name === "landmarks.geojson") {
    if (!["landmark", "building", "entrance"].includes(properties.kind)) add("invalid_enum", name, field("kind"));
    boundedText(properties.label, 200, add, name, field("label"));
  }
}

function validateGeometry(geometry, allowedTypes, add, file, field) {
  exactKeys(geometry, ["type", "coordinates"], [], add, file, field);
  if (!allowedTypes.includes(geometry.type)) {
    add("invalid_geometry_type", file, `${field}.type`);
    return 0;
  }
  if (geometry.type === "Point") return validatePoint(geometry.coordinates, add, file, `${field}.coordinates`) ? 1 : 0;
  if (geometry.type === "LineString") return validateLine(geometry.coordinates, add, file, `${field}.coordinates`);
  if (geometry.type === "MultiLineString") {
    if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
      add("invalid_geometry", file, field);
      return 0;
    }
    return geometry.coordinates.reduce((count, line, index) => count + validateLine(line, add, file, `${field}.coordinates[${index}]`), 0);
  }
  if (geometry.type === "Polygon") return validatePolygon(geometry.coordinates, add, file, `${field}.coordinates`);
  return 0;
}

function validatePoint(value, add, file, field) {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite) || value[0] < -180 || value[0] > 180 || value[1] < -90 || value[1] > 90) {
    add("invalid_coordinate", file, field);
    return false;
  }
  return true;
}

function validateLine(value, add, file, field) {
  if (!Array.isArray(value) || value.length < 2) {
    add("invalid_geometry", file, field);
    return 0;
  }
  value.forEach((point, index) => validatePoint(point, add, file, `${field}[${index}]`));
  return value.length;
}

function validatePolygon(value, add, file, field) {
  if (!Array.isArray(value) || value.length === 0) {
    add("invalid_geometry", file, field);
    return 0;
  }
  let count = 0;
  value.forEach((ring, ringIndex) => {
    if (!Array.isArray(ring) || ring.length < 4) {
      add("invalid_geometry", file, `${field}[${ringIndex}]`);
      return;
    }
    ring.forEach((point, pointIndex) => validatePoint(point, add, file, `${field}[${ringIndex}][${pointIndex}]`));
    count += ring.length;
    if (!samePoint(ring[0], ring.at(-1))) add("unclosed_polygon_ring", file, `${field}[${ringIndex}]`);
  });
  return count;
}

function validateEvidence(name, value, manifest, add) {
  const contract = EVIDENCE_CONTRACTS[name];
  if (!Array.isArray(value)) {
    add("invalid_evidence_file", name);
    return [];
  }
  if (value.length > contract.max) add("feature_count_out_of_range", name);
  const identities = new Set();
  for (let index = 0; index < value.length; index += 1) {
    const row = value[index];
    const base = `[${index}]`;
    if (!isPlainObject(row)) {
      add("invalid_evidence_row", name, base);
      continue;
    }
    exactKeys(row, contract.required, contract.optional, add, name, base);
    validateEvidenceRow(name, row, manifest, add, base);
    const identity = evidenceIdentity(name, row);
    if (identity && identities.has(identity)) add("duplicate_identifier", name, base);
    if (identity) identities.add(identity);
  }
  return value;
}

function validateEvidenceRow(name, row, manifest, add, base) {
  const field = (key) => `${base}.${key}`;
  const sourceFields = ["point_code", "capture_code", "remeasures_capture_code", "run_code", "release_code"];
  for (const key of sourceFields) if (key in row && row[key] !== null && !isSourceId(row[key])) add("unsafe_identifier", name, field(key));
  if ("site_id" in row && (!isDecimalId(row.site_id) || row.site_id !== manifest.site_id)) add("unsafe_identifier", name, field("site_id"));
  if (name === "survey_points.json") {
    if (!["GCP", "VALIDATION"].includes(row.role)) add("invalid_enum", name, field("role"));
    if ("description" in row) boundedText(row.description, 2_000, add, name, field("description"), true);
    if ("source_plan_reference" in row) boundedText(row.source_plan_reference, 1_024, add, name, field("source_plan_reference"), true);
    if ("active" in row && typeof row.active !== "boolean") add("invalid_boolean", name, field("active"));
  } else if (name === "survey_captures.json") {
    if (!isIsoDate(row.started_at) || (row.ended_at !== undefined && row.ended_at !== null && !isIsoDate(row.ended_at))) add("invalid_timestamp", name, field("started_at"));
    if (row.ended_at && Date.parse(row.ended_at) < Date.parse(row.started_at)) add("invalid_time_range", name, field("ended_at"));
    for (const key of ["device_reference", "operator_reference"]) if (key in row) boundedText(row[key], 500, add, name, field(key), true);
    if ("remeasure_required" in row && typeof row.remeasure_required !== "boolean") add("invalid_boolean", name, field("remeasure_required"));
  } else if (name === "survey_observations.json") {
    if (!isBoundedInteger(row.observation_order, 1, 1_000_000)) add("invalid_number", name, field("observation_order"));
    if (!isFiniteRange(row.latitude, -90, 90) || !isFiniteRange(row.longitude, -180, 180) || !isFiniteRange(row.reported_accuracy_m, 0, Number.MAX_SAFE_INTEGER)) add("invalid_number", name, field("coordinates"));
    if (!isIsoDate(row.captured_at)) add("invalid_timestamp", name, field("captured_at"));
  } else if (name === "georeferencing_runs.json") {
    if (row.release_code !== manifest.release_code) add("release_code_mismatch", name, field("release_code"));
    for (const key of ["source_reference", "source_coordinate_space", "method", "qgis_version", "output_artifact_reference"]) boundedText(row[key], key.includes("reference") ? 1_024 : 500, add, name, field(key));
    for (const key of ["source_sha256", "output_artifact_sha256"]) if (!IDENTIFIER_PATTERNS.sha256.test(row[key] || "")) add("invalid_sha256", name, field(key));
    if (row.working_srid !== 32651 || row.output_srid !== 4326) add("invalid_crs", name, field("working_srid"));
    if ((row.source_width !== undefined || row.source_height !== undefined) && (!isBoundedInteger(row.source_width, 1, 1_000_000) || !isBoundedInteger(row.source_height, 1, 1_000_000))) add("invalid_number", name, field("source_width"));
    if (!isPlainObject(row.processing_parameters)) add("invalid_processing_parameters", name, field("processing_parameters"));
    else {
      exactKeys(row.processing_parameters, [], ["expected_validation_count"], add, name, field("processing_parameters"));
      if ("expected_validation_count" in row.processing_parameters && !isBoundedInteger(row.processing_parameters.expected_validation_count, 1, 200)) add("invalid_number", name, field("processing_parameters.expected_validation_count"));
    }
    if (!isIsoDate(row.processed_at)) add("invalid_timestamp", name, field("processed_at"));
  } else if (name === "georeferencing_run_points.json") {
    if (!["FITTING", "VALIDATION"].includes(row.role)) add("invalid_enum", name, field("role"));
    if (!isFiniteRange(row.source_x, 0, Number.MAX_SAFE_INTEGER) || !isFiniteRange(row.source_y, 0, Number.MAX_SAFE_INTEGER)) add("invalid_number", name, field("source_x"));
    if (row.fitting_residual_m !== undefined && row.fitting_residual_m !== null && (row.role !== "FITTING" || !isFiniteRange(row.fitting_residual_m, 0, Number.MAX_SAFE_INTEGER))) add("invalid_number", name, field("fitting_residual_m"));
  } else if (name === "georeferencing_validation.json") {
    if (!["draft", "reviewed", "rejected"].includes(row.review_state)) add("invalid_enum", name, field("review_state"));
    if (!isPlainObject(row.transformed_plan_point)) add("invalid_geometry", name, field("transformed_plan_point"));
    else validateGeometry(row.transformed_plan_point, ["Point"], add, name, field("transformed_plan_point"));
  }
}

function validateInternalReferences(parsed, evidenceRows, sourceIdsByFile, manifest, add) {
  const plotFeatures = parsed.get("grave_plots.geojson")?.features || [];
  const lotIds = new Set(plotFeatures.map((item) => item.properties?.lot_id));
  const declaredLots = new Set(manifest.pilot_lot_ids || []);
  for (const id of lotIds) if (!declaredLots.has(id)) add("undeclared_pilot_lot", "grave_plots.geojson");
  for (const id of declaredLots) if (!lotIds.has(id)) add("missing_pilot_lot_geometry", "grave_plots.geojson");

  const nodes = sourceIdsByFile.get("route_nodes.geojson") || new Set();
  const walkways = sourceIdsByFile.get("roads_walkways.geojson") || new Set();
  for (const item of parsed.get("route_edges.geojson")?.features || []) {
    const properties = item.properties || {};
    if (!nodes.has(properties.from_source_feature_id) || !nodes.has(properties.to_source_feature_id)) add("unresolved_package_reference", "route_edges.geojson");
    if (!walkways.has(properties.walkway_source_feature_id)) add("unresolved_package_reference", "route_edges.geojson");
  }
  for (const item of parsed.get("grave_access_points.geojson")?.features || []) {
    if (!nodes.has(item.properties?.node_source_feature_id) || !lotIds.has(item.properties?.lot_id)) add("unresolved_package_reference", "grave_access_points.geojson");
  }

  const pointCodes = new Set((evidenceRows.get("survey_points.json") || []).map((row) => row.point_code));
  const captureCodes = new Set((evidenceRows.get("survey_captures.json") || []).map((row) => row.capture_code));
  const runCodes = new Set((evidenceRows.get("georeferencing_runs.json") || []).map((row) => row.run_code));
  if (!runCodes.has(manifest.selected_run_code)) add("unresolved_package_reference", MANIFEST_FILE_NAME, "selected_run_code");
  for (const row of evidenceRows.get("survey_captures.json") || []) if (!pointCodes.has(row.point_code)) add("unresolved_package_reference", "survey_captures.json");
  for (const row of evidenceRows.get("survey_observations.json") || []) if (!captureCodes.has(row.capture_code)) add("unresolved_package_reference", "survey_observations.json");
  const validationMemberships = new Set();
  for (const row of evidenceRows.get("georeferencing_run_points.json") || []) {
    if (!runCodes.has(row.run_code) || !pointCodes.has(row.point_code) || !captureCodes.has(row.capture_code)) add("unresolved_package_reference", "georeferencing_run_points.json");
    if (row.role === "VALIDATION") validationMemberships.add(`${row.run_code}\u0000${row.point_code}`);
  }
  for (const row of evidenceRows.get("georeferencing_validation.json") || []) if (!validationMemberships.has(`${row.run_code}\u0000${row.point_code}`)) add("unresolved_package_reference", "georeferencing_validation.json");
}

function evidenceIdentity(name, row) {
  if (name === "survey_points.json") return row.point_code;
  if (name === "survey_captures.json") return row.capture_code;
  if (name === "survey_observations.json") return `${row.capture_code}\u0000${row.observation_order}`;
  if (name === "georeferencing_runs.json") return row.run_code;
  if (name === "georeferencing_run_points.json") return `${row.run_code}\u0000${row.point_code}`;
  if (name === "georeferencing_validation.json") return `${row.run_code}\u0000${row.point_code}`;
  return null;
}

function exactKeys(value, required, optional, add, file, field) {
  if (!isPlainObject(value)) {
    add("invalid_object", file, field);
    return;
  }
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) add("unknown_property", file, `${field}.${key}`);
  for (const key of required) if (!(key in value)) add("missing_property", file, `${field}.${key}`);
}

function boundedText(value, max, add, file, field, allowEmpty = false) {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && value.trim().length === 0)) add("invalid_text", file, field);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function isSourceId(value) {
  return typeof value === "string" && IDENTIFIER_PATTERNS.sourceId.test(value);
}

function isDecimalId(value) {
  if (typeof value !== "string" || !IDENTIFIER_PATTERNS.decimalId.test(value)) return false;
  try {
    return BigInt(value) <= MAX_BIGINT;
  } catch {
    return false;
  }
}

function isBoundedInteger(value, min, max) {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function isFiniteRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function isIsoDate(value) {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString() === value;
}

function samePoint(left, right) {
  return Array.isArray(left) && Array.isArray(right) && left.length === 2 && right.length === 2 && left[0] === right[0] && left[1] === right[1];
}

function countJsonNodes(value) {
  if (Array.isArray(value)) return 1 + value.reduce((count, item) => count + countJsonNodes(item), 0);
  if (isPlainObject(value)) return 1 + Object.values(value).reduce((count, item) => count + countJsonNodes(item), 0);
  return 1;
}
