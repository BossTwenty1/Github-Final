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
  matchType?: "exact" | "matched" | "similar";
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
  coordinateStatus: "missing" | "pending" | "verified" | "rejected";
  locationVerified: boolean;
  tone: string;
};

export type AdminRecord = {
  revision: number;
  burialId: number;
  name: string;
  deceasedId: number;
  lotId: number;
  plot: string;
  section: string;
  recordStatus: "active" | "pending" | "archived";
  birthDate: string | null;
  deathDate: string | null;
  publicDisplay: boolean;
  intermentDate: string | null;
  intermentStatus: string;
  remainsType: string;
  referenceNo: string | null;
  serviceProvider: string | null;
  recordSource: string | null;
  qualityNotes: string | null;
  updatedAt: string;
  location: { latitude: number; longitude: number } | null;
  pixelLocation: { x: number; y: number } | null;
  coordinateStatus: "pending" | "verified" | "rejected";
  coordinateVerified: boolean;
};

export type AdminLot = {
  revision: number;
  lotId: number;
  lotCode: string;
  areaId: number;
  blockId: number | null;
  lotOwnerId: number | null;
  legacyLocationCode: string | null;
  legacyPaNumber: string | null;
  status: "AVAILABLE" | "BOOKED" | "HOLD";
  lengthM: number | null;
  widthM: number | null;
  pxLocX: number | null;
  pxLocY: number | null;
  coordinateStatus: "pending" | "verified" | "rejected";
  coordinateVerified: boolean;
  coordinateAccuracyM: number | null;
  location: { longitude: number; latitude: number } | null;
  updatedAt: string;
};

export type LotOwner = {
  revision: number;
  lotOwnerId: number;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  aliases: string | null;
  address: string;
  representativeName: string | null;
  representativeContact: string | null;
  representativeRelation: string | null;
};

export type PlotAreaOption = {
  areaId: number;
  areaCode: string;
  label: string;
};

export type BurialPlotOption = {
  lotId: number;
  lotCode: string;
  section: string;
  status: "AVAILABLE";
};

export type AdminAccount = StaffAccount & {
  revision: number;
  createdAt: string;
  approvedAt: string | null;
};

export type AuditLogEntry = {
  audit_id: number;
  actor_account_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  created_at: string;
};

export type AdminPhoto = {
  revision: number;
  photoId: number;
  burialId: number;
  fileName: string;
  caption: string | null;
  capturedAt: string | null;
  approvalStatus: "pending" | "approved" | "rejected";
  publicDisplay: boolean;
  createdAt: string;
};
