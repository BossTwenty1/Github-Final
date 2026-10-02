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

## B5 / Task 15 — publication foundation and Final F

- Target: linked GraveNav project `ddoowghocqyfoxaikifb`.
- Migration: `20260929000000_gis_publication.sql` (M09).
- Reviewed SHA-256: `b36533009189b4069fee26117b7963ca0842602f9fd13802e995e24b76fb005d`.
- Entry gate: Checkpoint D and STOP E5 approved; final dry-run contained only M09, with no seeds or roles.
- Deployment command: `npx supabase db push --linked`; do not use `--include-all`, `--include-seed`, or `--include-roles`.
- Deployment completed: M09 applied successfully once. All 26 local/hosted migration versions align through M09; M01–M09 are deployed. The earlier B1 entry above is a historical Task 1 checkpoint, not the current deployment state.
- Post-deployment catalog verified: three public ADMIN RPCs are owned by `postgres`, SECURITY DEFINER, authenticated-only executable, with pinned `pg_catalog, extensions, pg_temp` search paths. The three private helpers are SECURITY INVOKER with the same owner/path and no application execution privileges. Protected tables have RLS and no application write ACLs. Publication constraints are validated, expected indexes exist, and the release/event guards are enabled. PostgreSQL 17.6 / PostGIS 3.3.7 are available; pgRouting remains absent.
- Rollback-only hosted verification: `npx supabase db query --linked --file tests/gis-hosted-fixtures.sql` uses the existing authenticated Management API workflow. The SQL editor is an alternative. The fixture uses unmistakably synthetic identities/data, reviewed SQL claim simulation, deliberate audit failure, and ends in `ROLLBACK` before emitting its result. If any assertion fails, stop and explicitly roll back before another attempt; do not blindly retry.
- Read-only comparison: `node scripts/gis/verify-hosted.mjs --linked` verifies the project reference before using the installed authenticated Supabase CLI. Alternatively supply `GRAVENAV_GIS_DATABASE_URL` only through the process environment and run without `--linked` using `psql` on `PATH`. Neither path prints connection values or login diagnostics; both issue only a read-only transaction.
- Role evidence from the SQL fixture is database claim simulation, not proof of an external Supabase Auth JWT exchange.
- Expected persistent state after the fixture: 1 site, 4 areas, 3 lots, 3 deceased, 3 burial records, zero releases/imports/selectors/events/release-owned graph rows, 41 NULL-release nodes, and 18 NULL-release edges.
- Expected legacy hashes:
  - nodes: `fb04b1c24df7f77e166f8ed6e4dcbf1f66fde6e61cf77ad17053971d137e56c2`
  - edges: `c8da5d6bdebd470a7f3fd1a1a5715c5290bc78f509c6aec41b315238873c139d`
- Sequence note: rolled-back inserts can advance PostgreSQL identity sequences. Record any observed advance; never reset production sequences.
- Hosted fixture result: `FINAL_F_ROLLBACK_FIXTURE_PASSED`. Explicit approval, first publication (scope revision 0→1), replacement (1→2), rollback (2→3), exact retries, changed-input/actor conflicts, stale publication/rollback dependencies, invalid/full pilot scopes, deliberate final-audit failure atomicity, role denials, and safe anonymous DTO reads all passed. Every fixture record, receipt, event, selector, temporary guard, and trigger change rolled back. No real package or release was involved.
- Post-rollback counts and both hashes match the baseline above. Audit sequence advanced from 711 to 893 across the rolled-back verification attempts; edge/site/area/lot sequences remained 33/1/4/3. Sequences were not reset.
- Final genuine disposable PostgreSQL/PostGIS suite: 2/2 top-level tests passed, including all four publication/lifecycle races: first publication, replacement, publication versus legacy-lot edit, and finalization versus restage. This is real two-session PostgreSQL, not PGlite or hosted data.
- Deployed Preview smoke: Visitor Map and authenticated ADMIN Cemetery Map loaded without captured warning/error logs. Existing local cleaned-GeoJSON fallback remains available; no verified production coordinates exist for a real-destination navigation test. Current pages/components do not import `gis-data.ts` or `gis-types.ts`; both legacy hosted graph queries still filter `mapping_release_id IS NULL`. Vercel was not changed or redeployed.
- Final local validation: `npm run validate` exited 0: lint (0 errors, one existing unused-`mkdir` warning in the Task 8 test), TypeScript, 161 passing / 0 failing / 1 skipped tests, and production build all succeeded. The skipped symlink test reports Windows `EPERM`; junction rejection and stable-read safety tests passed. The existing Node module-type warning was retained without an unrelated package configuration change. `node --check scripts/gis/verify-hosted.mjs` also passed.
- Final artifact checks: read-only verifier exited 0 with every security/baseline assertion true. `git diff --check` and new-file whitespace checks passed. Task 15 changes remain unstaged/uncommitted, with all unrelated dirty/untracked work retained; no Git push occurred.
- Publication remains manual: import finalization cannot approve or publish, no background trigger exists, and only an explicit active-ADMIN review followed by explicit publication can create the selector.
- Recovery: do not reset or repair migration history. Preserve snapshots; use an eligible protected rollback or a reviewed forward migration/ACL fix.

Final F foundation verification is complete. Receiving/staging the first reviewed real pilot package still requires its own authorization and GIS/field review; no package can automatically approve or publish. Current map integration, survey suitability decisions, and pgRouting remain deferred. This checklist does not authorize the first real package to be approved or published.
