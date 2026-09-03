# GraveNav database implementation notes

The initial migration is local-first and contains no cemetery seed records. It does not import the sensitive Excel workbook. All GPS and image-map coordinates remain nullable, and no real or fictional coordinates are included.

The public burial view contains only active records for deceased records with `deceased.public_display = true`. A non-null `lot.location_geom` is returned regardless of `coordinate_status` or `coordinate_verified`; the view also returns existing pixel-map coordinates and a `location_verified` indicator. Pending and archived records are excluded.

The approved roles are `ADMIN` and `MANAGER`. Active `ADMIN` accounts have full operational access, account provisioning and lifecycle authority, and audit read/export access. Active `MANAGER` accounts have operational cemetery-record access, coordinate verification, photo approval, and audit read/export access, but cannot access account-management mutations. Inactive, pending, suspended, and revoked accounts cannot use administrator functions.

Account passwords are managed only by Supabase Auth. The public `account` table stores no password or password hash. A protected server-side Auth Admin operation creates or invites the Auth user first; the protected database functions then create or approve the matching `account` row. The first ADMIN is a controlled service-side bootstrap with `created_by = NULL`; it is not public self-registration.

Account mutations are function-only: `admin_create_account`, `admin_approve_account`, `admin_activate_account`, `admin_deactivate_account`, and `admin_change_account_role`. Only active ADMIN accounts may call them. `bootstrap_first_admin` is granted only to the protected `service_role` and refuses to run after an active ADMIN exists. No frontend call should receive or use a service-role credential.

Audit triggers cover application-table inserts, updates, deletes, and state changes. Verification, approval, and status-change events are classified explicitly. `export_audit_log` records audit exports and permits only active ADMIN or MANAGER accounts to read/export logs. Owner identity/contact fields, cause of death, service-provider data, quality notes, and account usernames are redacted from JSON snapshots. `audit_log.table_name` plus `record_id` is a polymorphic reference, not one ordinary foreign key. Audit records are intended to be retained for the lifetime of the system unless an institutional retention policy is later approved.

Photos remain database metadata only. Configure a private Supabase Storage bucket and storage-object RLS policies separately; approved public photos should be delivered through short-lived signed URLs. No uploads occur in this migration.

## Map data and routing

The administrator cemetery map reads Phase 1 `site`, garden `area`, `map_node`, and `map_edge` rows from Supabase. If those protected map tables are unavailable or not populated, the UI uses the checked-in Phase 1 GeoJSON as a display fallback and labels the source. The public visitor map continues to use that public static asset so anonymous visitors do not need access to protected map tables.

The navigation screen uses the recorded Phase 1 node/edge network and Dijkstra shortest-path calculation. It starts at the recorded main entrance, targets the nearest network node to an existing burial coordinate, follows stored edge geometry, and appends the destination coordinate. It does not invent a grave coordinate or repair a missing network connection. A route is therefore available only when the record has a coordinate and the network is connected.

The transactional burial functions in `supabase/migrations/20260830200000_transactional_burial_operations.sql` and the coordinate-validation trigger in `supabase/migrations/20260830210000_validate_lot_coordinates.sql` are now applied to the approved hosted development project. Keep the server’s guarded cleanup fallback for environments that have not received the migrations yet, and apply future migrations only through the project’s approved database process.

The current location hierarchy is `site -> area/garden -> plot`. The ERD retains `sector`, `block`, and nullable `lot.block_id` only for legacy compatibility; new plots use `lot.area_id` and `UNIQUE(area_id, lot_code)`.

The local migration `supabase/migrations/20260830210000_validate_lot_coordinates.sql` adds a database trigger that rejects a non-null plot coordinate unless it is covered by the selected garden boundary. It also prevents a coordinate outside that boundary from being marked verified. This protects direct SQL/import writes as well as a future coordinate-entry screen; the current plot form still does not collect GPS coordinates.
