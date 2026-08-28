export type StaffRole = "ADMIN" | "MANAGER";
export type AccountStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "REVOKED";

export type StaffAccount = {
  accountId: string;
  username: string;
  role: StaffRole;
  accountStatus: AccountStatus;
  isActive: boolean;
};

export type PublicBurialRecord = {
  id: string;
  name: string;
  birthDate: string | null;
  deathDate: string | null;
  dates: string;
  plot: string;
  plotLabel: string;
  section: string;
  row: string;
  burialDate: string;
  status: "Active";
  location: { latitude: number; longitude: number } | null;
  pixelLocation: { x: number; y: number } | null;
  locationVerified: boolean;
  tone: string;
};

export type AdminRecord = {
  burialId: number;
  name: string;
  deceasedId: number;
  lotId: number;
  plot: string;
  section: string;
  recordStatus: "active" | "pending" | "archived";
  intermentDate: string | null;
  intermentStatus: string;
  remainsType: string;
  referenceNo: string | null;
  updatedAt: string;
  location: { latitude: number; longitude: number } | null;
  pixelLocation: { x: number; y: number } | null;
  coordinateStatus: "pending" | "verified" | "rejected";
  coordinateVerified: boolean;
};

export type AdminAccount = StaffAccount & {
  createdAt: string;
  approvedAt: string | null;
};

export type AuditLogEntry = {
  audit_id: number;
  actor_account_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  created_at: string;
};
