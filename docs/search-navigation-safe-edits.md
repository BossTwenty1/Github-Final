# Search, navigation, and safe editing

## Rollout

These changes are implemented in the repository. All three release migrations were applied to the linked hosted Supabase project on September 5, 2026. Website deployment status is separate from database migration status.

Apply all existing migrations in order to a staging database, followed by:

1. `20260905120000_public_search.sql`
2. `20260905130000_safe_staff_edits.sql`
3. `20260905140000_staff_record_lookup.sql`

Back up the database and Storage objects first. Use the project's approved migration process and record the applied versions. Deploy the matching frontend during the same maintenance window: safe editing revokes access to the old write functions and direct table writes, so old browser sessions must reload. A missing migration produces an error rather than falling back to unsafe writes.

## Database changes

- `pg_trgm` supplies similar-name suggestions. Normalization handles punctuation, repeated spaces, case, and reordered name tokens. Plot-code matching ignores spacing and punctuation. Exact matches precede ordinary matches and similar-name suggestions. Search returns a bounded page and a filtered total; results contain approved public fields only.
- The public view now exposes `interment_date`. An unknown burial date is displayed as “Not recorded,” never substituted with the death date.
- Plots, owners, burial records, photos, and accounts have integer revisions. Updates lock the current row and require the revision that the editor originally loaded. Changes to a shared deceased record invalidate linked burial editors too.
- `staff_save_record` runs related writes in one transaction. Request IDs prevent duplicate commits. Pending request IDs and hashes survive a same-tab reload using session storage, expire after 24 hours, and are removed after confirmed success. No form values are saved in that storage. Retries must use the same submitted values. Closing the tab or clearing browser storage removes this protection; check the record before starting another submission.
- Coordinate/photo review, account actions, removal, and recovery require an active ADMIN at the database layer. MANAGER accounts retain ordinary operational create/edit access. Coordinate rejection requires a reason; new or changed coordinates return to pending.
- Removal of a burial, unreferenced plot, or unassigned owner is recoverable. Removed burials retain their lot reservation and dependent records. Removed burials and their photos disappear from public views.
- Existing redacted audit events now have a before/after display. Separate complete recovery snapshots are ADMIN-only. Recovery can restore a removed record or undo the latest unchanged edit. It cannot overwrite subsequent changes. Recovered coordinate edits return to pending.

The new indexes support normalized name/code lookup and trigram matching, but response times still need measurement with representative cemetery data. The public view's security barrier and broad matching predicates can affect index use; do not assume index-only execution. Further tuning should follow `EXPLAIN (ANALYZE, BUFFERS)` on staging.

## Immediate interface and code improvements

- Public map records use the ranked, garden-filtered search with pagination. The map explicitly identifies which page its markers represent. Selection uses burial IDs, so equal plot codes in different gardens remain distinct.
- Photo uploads use a protected, paginated name/plot picker. The review queue filters by status, pages through all photos, refreshes after uploads/reviews, and offers short-lived private image previews.
- Dashboard totals are calculated in the database across all current records. Missing and pending coordinates have separate counts.
- Confirmation dialogs retain keyboard focus and restore it on close. Inputs have unique IDs and programmatically associated hints.
- Supabase clients use generated types in `database.types.ts`; `database-schema.ts` supplies the nullable save-function argument contract that introspection cannot express. Regenerate after schema changes with `npx supabase gen types typescript --linked --schema public`.
- Temporary files, local map experiments, and reproducible map review exports are excluded from Git. The routing GeoJSON consumed by the site and its rebuild script are included.

## Navigation

Navigation watches location while active and clears the watch on stop, restart, and unmount. It ignores invalid or stale readings and only calculates from a current position inside the mapped area with reported accuracy of 30 m or better. Otherwise it offers the entrance route with an explanation.

The map shows a position marker and an approximate geographic accuracy circle. Recenter does not continuously override manual map panning. “Near the plot” requires a fresh reading within 15 m, with reported accuracy of 15 m or better; it asks the visitor to confirm the marker rather than declaring exact arrival.

Routes end on recorded paths. The final approach to a grave is explicitly unverified and is not drawn as a shortcut. Instructions reference named entrance/landmark nodes actually traversed by the route; no landmark or accessible approach is invented. Field surveying must still confirm nearby landmarks and the final walkable approach.

## Validation and remaining operational work

`npm run validate` runs lint, TypeScript, tests, and the production build. Database tests execute every migration in an isolated PGlite PostgreSQL instance with PostGIS and pg_trgm. Auth roles and `auth.uid()` are test stand-ins; no hosted data or real credentials are used. This validates SQL and role contracts but does not replace staging tests of Supabase Auth, PostgREST, Storage policies, or simultaneous transactions across real connections. The test-only PGlite PostGIS package is experimental and is not an application runtime dependency.

Before rollout, test two staff sessions editing the same record, ADMIN/MANAGER access, permission denial, low-accuracy GPS, physical walking routes, and account/photo review. Test restoration in staging. Retain encrypted off-site backups independently of the in-database recovery history.

Other database priorities after this release: monitor query plans with real volume, establish retention rules for recovery snapshots and mutation receipts, and confirm normalized plot-code uniqueness with the client before enforcing a new uniqueness rule on existing data. Current plot codes remain unique within their garden; ambiguous code-only profile lookups do not choose an arbitrary grave.
