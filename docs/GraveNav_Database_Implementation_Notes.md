# GraveNav database implementation notes

The initial migration is local-first and contains no cemetery seed records. It does not import the sensitive Excel workbook. All GPS and image-map coordinates remain nullable, and no real or fictional coordinates are included.

The public burial view contains only active records for deceased records with `deceased.public_display = true`. A non-null `lot.location_geom` is returned regardless of `coordinate_status` or `coordinate_verified`; the view also returns existing pixel-map coordinates and a `location_verified` indicator. Pending and archived records are excluded.

The approved roles are `ADMIN` and `MANAGER`. Active `ADMIN` accounts have full operational access, account provisioning and lifecycle authority, and audit read/export access. Active `MANAGER` accounts have operational cemetery-record access, coordinate verification, photo approval, and audit read/export access, but cannot access account-management mutations. Inactive, pending, suspended, and revoked accounts cannot use administrator functions.

Account passwords are managed only by Supabase Auth. The public `account` table stores no password or password hash. A protected server-side Auth Admin operation creates or invites the Auth user first; the protected database functions then create or approve the matching `account` row. The first ADMIN is a controlled service-side bootstrap with `created_by = NULL`; it is not public self-registration.

Account mutations are function-only: `admin_create_account`, `admin_approve_account`, `admin_activate_account`, `admin_deactivate_account`, and `admin_change_account_role`. Only active ADMIN accounts may call them. `bootstrap_first_admin` is granted only to the protected `service_role` and refuses to run after an active ADMIN exists. No frontend call should receive or use a service-role credential.

Audit triggers cover application-table inserts, updates, deletes, and state changes. Verification, approval, and status-change events are classified explicitly. `export_audit_log` records audit exports and permits only active ADMIN or MANAGER accounts to read/export logs. Owner identity/contact fields, cause of death, service-provider data, quality notes, and account usernames are redacted from JSON snapshots. `audit_log.table_name` plus `record_id` is a polymorphic reference, not one ordinary foreign key. Audit records are intended to be retained for the lifetime of the system unless an institutional retention policy is later approved.

Photos remain database metadata only. Configure a private Supabase Storage bucket and storage-object RLS policies separately; approved public photos should be delivered through short-lived signed URLs. No uploads occur in this migration.
