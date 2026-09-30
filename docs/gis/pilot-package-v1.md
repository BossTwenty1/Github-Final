# GraveNav pilot GIS package v1

This document defines the offline structure accepted by
`node scripts/validate-gis-package.mjs <directory>`. The command performs no
network requests and does not create a Supabase client.

An exit status of `0` means only that the directory is structurally valid under
this contract. It does not establish that referenced sites, areas, lots,
releases, survey evidence, graph topology, or other database relationships
exist or are suitable for publication. Every successful result therefore
contains `requiresDatabaseValidation: true` and
`databaseValidationPerformed: false`.

## Required files

The package is a directory containing exactly these 15 regular files. Archives,
subdirectories, additional files, symlinks, junctions, and other filesystem
aliases are not accepted.

| Kind | File |
| --- | --- |
| Manifest | `manifest.json` |
| GeoJSON | `cemetery_boundary.geojson` |
| GeoJSON | `garden_sections.geojson` |
| GeoJSON | `roads_walkways.geojson` |
| GeoJSON | `grave_plots.geojson` |
| GeoJSON | `grave_access_points.geojson` |
| GeoJSON | `route_nodes.geojson` |
| GeoJSON | `route_edges.geojson` |
| GeoJSON | `landmarks.geojson` |
| Evidence JSON | `survey_points.json` |
| Evidence JSON | `survey_captures.json` |
| Evidence JSON | `survey_observations.json` |
| Evidence JSON | `georeferencing_runs.json` |
| Evidence JSON | `georeferencing_run_points.json` |
| Evidence JSON | `georeferencing_validation.json` |

Only these basenames are opened. Path separators, absolute paths, `.`/`..`,
undeclared files, and non-regular files are rejected. Files are read twice and
their identity, size, timestamps, and SHA-256 are compared to detect a change
during validation.

## Byte and parser limits

Limits are measured from the exact file bytes, before JSON is trusted.

| Limit | Maximum |
| --- | ---: |
| `manifest.json` | 65,536 bytes (64 KiB) |
| Each other file | 4,194,304 bytes (4 MiB) |
| Entire 15-file directory | 8,388,608 bytes (8 MiB) |
| JSON nesting depth | 32 |
| JSON string length | 8,192 characters |
| JSON nodes per file | 500,000 |
| JSON nodes in the package | 1,000,000 |
| Returned error entries | 2,000 |
| Geometry vertices in all layers | 50,000 |

The parser accepts UTF-8 JSON without a byte-order mark. It rejects malformed
JSON, invalid UTF-8, unpaired Unicode surrogates, nonfinite numeric results,
excess depth/nodes/string length, and duplicate decoded property names within
one object. For example, `{"a":1,"\u0061":2}` is invalid because both keys
decode to `a`. The same key in separate objects is valid.

Database bigint identifiers are decimal strings, not JSON numbers. They must
match `^[1-9][0-9]{0,18}$` and be no greater than
`9223372036854775807`. Codes and source identifiers are case-sensitive ASCII
strings of 1–100 characters matching `[A-Za-z0-9._:-]+`. SHA-256 values are 64
lowercase hexadecimal characters.

## Manifest

`manifest.json` is one exact object with these fields and no others:

| Field | Contract |
| --- | --- |
| `schema_version` | Integer `1` |
| `package_id` | Source identifier |
| `site_id`, `pilot_area_id` | Positive decimal bigint strings |
| `release_code`, `selected_run_code` | Source identifiers |
| `title` | Nonblank string, at most 200 characters |
| `description` | String, at most 2,000 characters |
| `source_plan` | Exact object described below |
| `crs` | Exact object `{field:4326, working:32651, export:4326}` |
| `exported_at` | Canonical ISO timestamp |
| `qgis_version` | Nonblank string, at most 100 characters |
| `pilot_lot_ids` | 1–50 unique decimal bigint strings |
| `provenance_notes` | String, at most 2,000 characters |
| `limitations` | At most 100 strings, each at most 2,000 characters |
| `files` | Exactly one declaration for each of the 14 data files |

`source_plan` contains exactly `reference` (1–1,024 characters), `version`
(source identifier), `sha256`, and `coordinate_space` (1–500 characters).

Each `files` entry contains exactly:

- `name`: one allowlisted data filename; the manifest never lists itself;
- `sha256`: SHA-256 of the exact file bytes;
- `bytes`: exact byte length, from 0 through 4 MiB;
- `feature_count`: the raw GeoJSON feature count or JSON array row count;
- `layer_version`: source identifier.

## Package digest

The package identity is:

```text
SHA256(
  UTF8("GraveNavGISPackage/v1\n")
  || exact manifest bytes
  || UTF8("\n")
  || UTF8(concatenated file lines sorted by filename)
)
```

Each sorted file line is exactly:

```text
name + "\t" + sha256 + "\n"
```

The validator hashes each data file from its actual bytes before using the
manifest declaration. It does not reserialize JSON, normalize line endings, or
include archive/chunk ordering in the digest. The manifest does not list or hash
itself as a file entry; its exact bytes are already an input to the digest.

The locked test vector uses exact manifest bytes
`{"schema_version":1}\n`, then declarations for `a.json` with 64 `a`
hex characters and `b.json` with 64 `b` hex characters. Its digest is:

```text
70635b860691d52f3613189d689ccbd63ea1e1c472379156d6b9a7f7d8108411
```

## GeoJSON layers

Every GeoJSON file is an exact `FeatureCollection`. Every feature contains only
`type`, `geometry`, and `properties`, with `type: "Feature"`. Coordinates are
two-dimensional EPSG:4326 `[longitude, latitude]` values in world bounds.
Lines contain at least two points. Polygon rings contain at least four points
and are explicitly closed. Full PostGIS validity, containment, overlap,
lineage, reachability, and topology checks are deferred to database validation.

All feature properties include `source_feature_id`, `site_id`,
`artifact_hash`, and `layer_version`. `site_id` must equal the manifest site.
The exact layer-specific contract is:

| File | Geometry and count | Additional properties |
| --- | --- | --- |
| `cemetery_boundary.geojson` | Exactly 1 `Polygon` | `kind="cemetery"`, `area_id=null` |
| `garden_sections.geojson` | 1–50 `Polygon` | `kind="area"`, decimal `area_id` |
| `roads_walkways.geojson` | 1–200 `LineString` or `MultiLineString` | `edge_type`, `walking_allowed`, `is_restricted` |
| `grave_plots.geojson` | 1–50 `Polygon` | decimal `lot_id`, decimal `area_id` |
| `grave_access_points.geojson` | 1–50 `Point` | decimal `lot_id`, decimal `area_id`, `node_source_feature_id` |
| `route_nodes.geojson` | 1–200 `Point` | `node_name`, `node_type` |
| `route_edges.geojson` | 1–400 `LineString` | `from_source_feature_id`, `to_source_feature_id`, `walkway_source_feature_id`, `edge_type`, `walking_allowed`, `is_restricted`, `direction` |
| `landmarks.geojson` | 0–100 `Point` or `Polygon` | `kind`, `label`, optional `node_source_feature_id` |

`edge_type` is `road`, `walkway`, `path`, or `entrance`. `node_type` is
`entrance`, `junction`, `access`, or `landmark`. Edge `direction` is `both`,
`forward`, or `reverse`. Landmark `kind` is `landmark`, `building`, or
`entrance`.

Property allowlists are exact. Public layer properties must not contain
`deceased_name`, `owner_name`, `operator_name`, `device_reference`,
`operator_reference`, `private_notes`, `review_notes`, or `review_reason`.
This name-based check cannot recognize private information disguised as a
legitimate label, so administrator privacy review remains mandatory.

## Evidence JSON

Each evidence file is a top-level array whose row objects use the exact fields
below. All referenced codes use the source-identifier format.

| File | Maximum rows | Required fields | Optional fields |
| --- | ---: | --- | --- |
| `survey_points.json` | 200 | `point_code`, `site_id`, `role` | `description`, `source_plan_reference`, `active` |
| `survey_captures.json` | 1,000 | `capture_code`, `point_code`, `site_id`, `started_at` | `ended_at`, `device_reference`, `operator_reference`, `remeasures_capture_code`, `remeasure_required` |
| `survey_observations.json` | 20,000 | `capture_code`, `observation_order`, `latitude`, `longitude`, `reported_accuracy_m`, `captured_at` | None |
| `georeferencing_runs.json` | 20 | `run_code`, `release_code`, `site_id`, `source_reference`, `source_sha256`, `source_coordinate_space`, `working_srid`, `output_srid`, `method`, `processing_parameters`, `processed_at`, `qgis_version`, `output_artifact_reference`, `output_artifact_sha256` | `source_width`, `source_height`, `operator_reference`, `reviewer_reference` |
| `georeferencing_run_points.json` | Aggregate limit below | `run_code`, `point_code`, `capture_code`, `role`, `source_x`, `source_y` | `fitting_residual_m` |
| `georeferencing_validation.json` | Aggregate limit below | `run_code`, `point_code`, `transformed_plan_point`, `review_state` | None |

The combined number of `georeferencing_run_points.json` and
`georeferencing_validation.json` rows is at most 4,000.

Additional structural rules include:

- survey point `role` is `GCP` or `VALIDATION`;
- observation order is a positive integer, latitude/longitude are finite world
  coordinates, reported accuracy is finite and nonnegative, and timestamps are
  canonical ISO values;
- run `release_code` and `site_id` match the manifest, `working_srid` is 32651,
  and `output_srid` is 4326;
- `processing_parameters` permits only optional integer
  `expected_validation_count` from 1 through 200;
- run-point `role` is `FITTING` or `VALIDATION`, source coordinates are finite
  and nonnegative, and a fitting residual is nonnegative and present only on a
  fitting membership;
- validation `transformed_plan_point` is a 2D EPSG:4326 `Point`, and
  `review_state` is `draft`, `reviewed`, or `rejected`;
- package-local point, capture, run, validation-membership, node, walkway, and
  lot references resolve, and identities are unique in their file scope.

These reference checks prove only internal package consistency. Existing
database evidence must still be checked for identity, site, role, review/freeze
state, and unchanged hashes.

## Validator output and meaning

The CLI writes one deterministic JSON report to standard output. It reports
bounded error codes plus allowlisted filenames/field locations; it does not echo
file contents, private values, the supplied directory path, or exception text.
Invalid packages exit `1`. Structurally valid packages exit `0` and include the
verified package digest and counts.

Offline validation proves:

- exact package filenames and byte budgets;
- strict JSON syntax and decoded-key uniqueness;
- manifest declarations, file hashes, raw counts, and digest reproducibility;
- allowlisted fields, primitive formats, EPSG declarations, basic GeoJSON
  shape/range/ring closure, and package-local references;
- resistance to simple path traversal, aliases, and observed file replacement.

Offline validation does not prove:

- that site, area, lot, release, capture, or run identities exist remotely;
- that evidence is accepted, frozen, current, or authorized for the release;
- PostGIS geometry validity, boundary containment, non-overlap, endpoint
  equality, graph reachability, or other database topology rules;
- that the package is accurate, survey-grade, suitable, approved, publishable,
  or safe to activate;
- that omission of previously mapped operational objects is acceptable.

Those checks belong to the later protected database validation and review
workflow. A valid offline report must never be used as publication authority.
