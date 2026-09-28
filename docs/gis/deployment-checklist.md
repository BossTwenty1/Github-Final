# GIS deployment checklist

## B1 / Task 1 — release foundation

- Migration: `20260928160000_gis_release_foundation.sql` (M01).
- SHA-256 of the local file bytes: `b78cec34f7d47a7e22d313ae9f0c9fca63bdd6db6dd949aa73a91c2bf096c513`.
- Ordering baseline: 17 migrations ending at `20260928150000_staff_coordinate_verification.sql`; M01 version was allocated only after the Task 1 RED run and a fresh inventory check.
- Local implementation: complete; independent Task 1 review passed with no findings.
- Local verification: initial missing-object RED recorded; targeted 19/19 and full 54/54 tests pass, TypeScript passes, catalog security inspection passes, whitespace checks pass.
- Scope: release identity, scope, lifecycle guards, protected create/reject operations, private hashed receipts, sanitized audit metadata.
- Hosted deployment: **not performed**. No production data was accessed or changed.
- B1 deployment eligibility: **not ready**. Tasks 2–3 and Checkpoint A must finish before the planned Task 4 deployment phase.
- Before a future authorized B1 deployment: review the complete migration set/target and recheck this file's hash. Git newline conversion can change file-byte hashes; record the actual reviewed deployment artifact's hash if it differs.

This entry does not authorize deployment or mark later GIS tasks complete.
