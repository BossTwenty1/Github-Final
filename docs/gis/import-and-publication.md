# GraveNav pilot GIS import and publication separation

This runbook covers the protected **pilot-only** import pipeline and the separate M09 approval, publication, and rollback operations. Import finalization still produces a validated, unapproved release. Nothing automatically approves or publishes it.

## Prerequisites

- Run the Task 8 offline validator against the 15-file package first. Offline validity proves only structure, byte limits, hashes, and the documented package contract; database identities, frozen evidence, geometry validity, topology, and live relationships still require SQL validation.
- Use an existing active ADMIN Supabase session token in `GRAVENAV_GIS_ACCESS_TOKEN`.
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Never use a service-role/secret key, put a JWT on the command line, or save a token in the resume file.
- Choose an operator-controlled ignored path for `--resume-file`. The file contains only UUIDs, digests, chunk indexes, and operation receipts; it contains no package bytes or credentials.

## Commands

```text
node scripts/import-gis-package.mjs stage --directory <package-dir> --release-id <uuid> --revision <n> --resume-file <ignored-path>
node scripts/import-gis-package.mjs resume --directory <package-dir> --resume-file <ignored-path>
node scripts/import-gis-package.mjs validate --resume-file <ignored-path>
node scripts/import-gis-package.mjs finalize --resume-file <ignored-path> --report-digest <sha256> --acknowledgements <json-file>
node scripts/import-gis-package.mjs status --resume-file <ignored-path>
```

There is deliberately no import-CLI publish flag. A failed or interrupted upload remains resumable with identical accepted chunks. Corrected content requires a new root request/import. An `invalid` import may be revalidated with unchanged bytes only when its prior blockers were live dependencies and a new validation operation UUID is used.

## Review acknowledgements

Finalization accepts an exact object:

```json
{
  "warnings": ["warning_code:source_or_lot_id"],
  "reviewed_layer_hashes": {
    "cemetery_boundary.geojson": "<sha256>",
    "garden_sections.geojson": "<sha256>",
    "roads_walkways.geojson": "<sha256>",
    "grave_plots.geojson": "<sha256>",
    "grave_access_points.geojson": "<sha256>",
    "route_nodes.geojson": "<sha256>",
    "route_edges.geojson": "<sha256>",
    "landmarks.geojson": "<sha256>"
  }
}
```

Every warning token and layer hash is bound to the current deterministic report/package. Unknown acknowledgement fields or tokens are rejected. Uploaded `review_state` values are not trusted. Existing survey captures and the selected georeferencing run must already be accepted/frozen through their protected ADMIN review RPCs; changed evidence uses a new identity.

## State and replacement guarantees

- `receiving -> sealed|invalid|abandoned`
- `sealed -> validated|invalid|abandoned`
- `invalid -> invalid|validated|abandoned` only for eligible same-byte live-dependency rechecks
- `validated -> validated|invalid|finalized|abandoned`
- `finalized` and `abandoned` are terminal

Validation appends a deterministic private report and creates no operational GIS rows. Finalization locks pilot area, release, and import in that order; reruns authoritative validation; verifies exact report/acknowledgements; deletes only that release's prior unapproved children in reverse-FK order; inserts the complete replacement in forward-FK order; and moves only the release to `validated`. A transaction failure restores the complete prior snapshot. Other releases, legacy NULL-release graph rows, raw chunks, reports, receipts, and accepted field/run evidence are retained.

## Explicit approval, publication, and rollback

These are manual ADMIN RPC calls. Generate a fresh request UUID for each new intent and retain the bounded response as the operation receipt. An exact retry with the same actor and input returns that receipt; reusing its UUID for different input or another actor is rejected. Pass the current value as the expected revision immediately before approval or activation. Read the current publication-scope revision from the protected readiness response immediately before publish or rollback.

Approval binds the exact package digest, validation report digest, current warning tokens, and three affirmative reviewer checks. The acknowledgement object is:

```json
{
  "packageDigest": "<current package sha256>",
  "reportDigest": "<current report sha256>",
  "warnings": ["warning_code:source_or_lot_id"],
  "suitabilityReviewed": true,
  "omissionsReviewed": true,
  "privacyReviewed": true
}
```

Call `staff_review_mapping_release(release_id, expected_revision, 'approve', acknowledgements, bounded_notes_or_null, request_uuid)`. Rejection uses decision `reject`, an empty bounded acknowledgement object, and a required bounded reason in the notes argument. Never paste private field evidence, geometry, filesystem paths, device identifiers, or secrets into notes.

After independently confirming the approval receipt, call `staff_publish_mapping_release(release_id, expected_revision, expected_scope_revision, request_uuid)`. This is the only explicit publication operation. It rechecks current live lots, coverage, frozen geometry/access evidence, acknowledgements, hashes, and revisions before atomically changing the selector, release states, history, and sanitized audit rows.

Rollback is not an edit of history. To reactivate an eligible previously published release in the same pilot scope, first recheck it against current live dependencies, then call `staff_rollback_mapping_release(release_id, expected_revision, expected_scope_revision, bounded_reason, request_uuid)`. A draft, staged, validated-only, rejected, unrelated, or stale release cannot be activated. Keep the human reason in the protected request only; the returned receipt and general audit metadata do not echo it.

Every approval and publication transition requires a separate explicit ADMIN RPC. Finalization does not approve or publish, no background publication trigger exists, and the import CLI has no publish option. Do not claim public readiness from import or validation alone.
