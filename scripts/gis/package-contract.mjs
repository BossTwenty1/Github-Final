import { createHash } from "node:crypto";

export const MANIFEST_FILE_NAME = "manifest.json";

export const GEOJSON_FILE_NAMES = Object.freeze([
  "cemetery_boundary.geojson",
  "garden_sections.geojson",
  "roads_walkways.geojson",
  "grave_plots.geojson",
  "grave_access_points.geojson",
  "route_nodes.geojson",
  "route_edges.geojson",
  "landmarks.geojson",
]);

export const EVIDENCE_FILE_NAMES = Object.freeze([
  "survey_points.json",
  "survey_captures.json",
  "survey_observations.json",
  "georeferencing_runs.json",
  "georeferencing_run_points.json",
  "georeferencing_validation.json",
]);

export const DATA_FILE_NAMES = Object.freeze([
  ...GEOJSON_FILE_NAMES,
  ...EVIDENCE_FILE_NAMES,
]);

export const PACKAGE_FILE_NAMES = Object.freeze([
  MANIFEST_FILE_NAME,
  ...DATA_FILE_NAMES,
]);

export const PACKAGE_LIMITS = Object.freeze({
  maxManifestBytes: 64 * 1024,
  maxDataFileBytes: 4 * 1024 * 1024,
  maxPackageBytes: 8 * 1024 * 1024,
  maxDepth: 32,
  maxStringLength: 8_192,
  maxNodesPerFile: 500_000,
  maxNodesPerPackage: 1_000_000,
  maxErrors: 2_000,
  maxGeometryVertices: 50_000,
  maxPlots: 50,
  maxAccessPoints: 50,
  maxRouteNodes: 200,
  maxRouteEdges: 400,
  maxWalkways: 200,
  maxDisplayFeatures: 100,
  maxSurveyPoints: 200,
  maxSurveyCaptures: 1_000,
  maxSurveyObservations: 20_000,
  maxRuns: 20,
  maxMembershipsAndResults: 4_000,
});

export const IDENTIFIER_PATTERNS = Object.freeze({
  decimalId: /^[1-9][0-9]{0,18}$/,
  sourceId: /^[A-Za-z0-9._:-]{1,100}$/,
  sha256: /^[0-9a-f]{64}$/,
});

export const GEOJSON_CONTRACTS = Object.freeze({
  "cemetery_boundary.geojson": {
    geometryTypes: ["Polygon"], min: 1, max: 1,
    required: ["source_feature_id", "site_id", "artifact_hash", "layer_version", "kind", "area_id"],
    optional: [],
  },
  "garden_sections.geojson": {
    geometryTypes: ["Polygon"], min: 1, max: 50,
    required: ["source_feature_id", "site_id", "artifact_hash", "layer_version", "kind", "area_id"],
    optional: [],
  },
  "roads_walkways.geojson": {
    geometryTypes: ["LineString", "MultiLineString"], min: 1, max: PACKAGE_LIMITS.maxWalkways,
    required: ["source_feature_id", "site_id", "artifact_hash", "layer_version", "edge_type", "walking_allowed", "is_restricted"],
    optional: [],
  },
  "grave_plots.geojson": {
    geometryTypes: ["Polygon"], min: 1, max: PACKAGE_LIMITS.maxPlots,
    required: ["source_feature_id", "site_id", "artifact_hash", "layer_version", "lot_id", "area_id"],
    optional: [],
  },
  "grave_access_points.geojson": {
    geometryTypes: ["Point"], min: 1, max: PACKAGE_LIMITS.maxAccessPoints,
    required: ["source_feature_id", "site_id", "artifact_hash", "layer_version", "lot_id", "area_id", "node_source_feature_id"],
    optional: [],
  },
  "route_nodes.geojson": {
    geometryTypes: ["Point"], min: 1, max: PACKAGE_LIMITS.maxRouteNodes,
    required: ["source_feature_id", "site_id", "artifact_hash", "layer_version", "node_name", "node_type"],
    optional: [],
  },
  "route_edges.geojson": {
    geometryTypes: ["LineString"], min: 1, max: PACKAGE_LIMITS.maxRouteEdges,
    required: ["source_feature_id", "site_id", "artifact_hash", "layer_version", "from_source_feature_id", "to_source_feature_id", "walkway_source_feature_id", "edge_type", "walking_allowed", "is_restricted", "direction"],
    optional: [],
  },
  "landmarks.geojson": {
    geometryTypes: ["Point", "Polygon"], min: 0, max: PACKAGE_LIMITS.maxDisplayFeatures,
    required: ["source_feature_id", "site_id", "artifact_hash", "layer_version", "kind", "label"],
    optional: ["node_source_feature_id"],
  },
});

export const EVIDENCE_CONTRACTS = Object.freeze({
  "survey_points.json": {
    max: PACKAGE_LIMITS.maxSurveyPoints,
    required: ["point_code", "site_id", "role"],
    optional: ["description", "source_plan_reference", "active"],
  },
  "survey_captures.json": {
    max: PACKAGE_LIMITS.maxSurveyCaptures,
    required: ["capture_code", "point_code", "site_id", "started_at"],
    optional: ["ended_at", "device_reference", "operator_reference", "remeasures_capture_code", "remeasure_required"],
  },
  "survey_observations.json": {
    max: PACKAGE_LIMITS.maxSurveyObservations,
    required: ["capture_code", "observation_order", "latitude", "longitude", "reported_accuracy_m", "captured_at"],
    optional: [],
  },
  "georeferencing_runs.json": {
    max: PACKAGE_LIMITS.maxRuns,
    required: ["run_code", "release_code", "site_id", "source_reference", "source_sha256", "source_coordinate_space", "working_srid", "output_srid", "method", "processing_parameters", "processed_at", "qgis_version", "output_artifact_reference", "output_artifact_sha256"],
    optional: ["source_width", "source_height", "operator_reference", "reviewer_reference"],
  },
  "georeferencing_run_points.json": {
    max: PACKAGE_LIMITS.maxMembershipsAndResults,
    required: ["run_code", "point_code", "capture_code", "role", "source_x", "source_y"],
    optional: ["fitting_residual_m"],
  },
  "georeferencing_validation.json": {
    max: PACKAGE_LIMITS.maxMembershipsAndResults,
    required: ["run_code", "point_code", "transformed_plan_point", "review_state"],
    optional: [],
  },
});

export const PRIVATE_PUBLIC_PROPERTY_NAMES = Object.freeze(new Set([
  "deceased_name",
  "owner_name",
  "operator_name",
  "device_reference",
  "operator_reference",
  "private_notes",
  "review_notes",
  "review_reason",
]));

export function computeSha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function computePackageDigest(manifestBytes, declaredFiles) {
  const sorted = [...declaredFiles].sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "variant" }));
  const hashLines = sorted.map(({ name, sha256 }) => `${name}\t${sha256}\n`).join("");
  return createHash("sha256")
    .update(Buffer.from("GraveNavGISPackage/v1\n", "utf8"))
    .update(manifestBytes)
    .update(Buffer.from("\n", "utf8"))
    .update(Buffer.from(hashLines, "utf8"))
    .digest("hex");
}

export function validationError(code, file = null, field = null) {
  return Object.freeze({
    code,
    ...(file ? { file } : {}),
    ...(field ? { field } : {}),
  });
}

export function sortValidationErrors(errors) {
  return [...errors].sort((left, right) =>
    `${left.code}\u0000${left.file ?? ""}\u0000${left.field ?? ""}`.localeCompare(
      `${right.code}\u0000${right.file ?? ""}\u0000${right.field ?? ""}`,
      "en",
      { sensitivity: "variant" },
    ));
}
