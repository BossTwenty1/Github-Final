"use client";

import { getBrowserSupabase } from "./config";
import { acknowledgeRequest, mutationFingerprint, pendingRequestId } from "./mutation-receipts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "./database.types";
import type { AdminAccount, AdminLot, AdminPhoto, AdminRecord, AuditLogEntry, BurialPlotOption, LotOwner, PlotAreaOption } from "./types";

const RECORD_COLUMNS = "revision,burial_id,deceased_id,lot_id,interment_date,record_status,interment_status,remains_type,reference_no,service_provider,record_source,quality_notes,created_by,updated_by,updated_at";
const DECEASED_COLUMNS = "deceased_id,display_name,birth_date,death_date,public_display";
const LOT_COLUMNS = "revision,lot_id,lot_code,area_id,block_id,lot_owner_id,legacy_location_code,legacy_pa_number,status,length_m,width_m,px_loc_x,px_loc_y,location_geom,coordinate_accuracy_m,coordinate_status,coordinate_verified,coordinate_rejection_reason,updated_at";
const OWNER_COLUMNS = "revision,lot_owner_id,first_name,middle_name,last_name,suffix,aliases,address,representative_name,representative_contact,representative_relation";
const PHOTO_COLUMNS = "revision,photo_id,burial_id,file_name,caption,captured_at,approval_status,public_display,created_at";
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export type PageResult<T> = { items: T[]; hasMore: boolean; total: number | null };
type PageOptions = { page?: number; pageSize?: number };
type OwnerPageOptions = PageOptions & { search?: string };
export type LotRow = { revision: number; coordinate_rejection_reason: string | null; lot_id: number; lot_code: string; area_id: number; block_id: number | null; lot_owner_id: number | null; legacy_location_code: string | null; legacy_pa_number: string | null; status: "AVAILABLE" | "BOOKED" | "HOLD"; length_m: number | null; width_m: number | null; px_loc_x: number | null; px_loc_y: number | null; location_geom: unknown; coordinate_accuracy_m: number | null; coordinate_status: "pending" | "verified" | "rejected"; coordinate_verified: boolean; updated_at: string; location: { longitude: number; latitude: number } | null };
type OwnerRow = { revision: number; lot_owner_id: number; first_name: string; middle_name: string | null; last_name: string; suffix: string | null; aliases: string | null; address: string; representative_name: string | null; representative_contact: string | null; representative_relation: string | null };

export async function getAdminRecords(options: PageOptions = {}) {
  return (await getAdminRecordsPage(options)).items;
}

export async function getAllAdminRecords() {
  const items: AdminRecord[] = [];
  let page = 0;
  let nextPage: PageResult<AdminRecord>;
  do {
    nextPage = await getAdminRecordsPage({ page });
    items.push(...nextPage.items);
    page += 1;
  } while (nextPage.hasMore);
  return items;
}

export async function getAdminRecordsPage(options: PageOptions = {}): Promise<PageResult<AdminRecord>> {
  const client = requireClient();
  const { from, to } = pageRange(options);
  const { data: records, error, count } = await client.from("burial_record").select(RECORD_COLUMNS, { count: "exact" }).is("deleted_at", null).order("updated_at", { ascending: false }).order("burial_id", { ascending: false }).range(from, to);
  if (error) throw error;
  if (!records?.length) return { items: [], hasMore: false, total: count };

  const deceasedIds = records.map((record) => record.deceased_id);
  const lotIds = records.map((record) => record.lot_id);
  const [{ data: deceased, error: deceasedError }, { data: lots, error: lotsError }] = await Promise.all([
    client.from("deceased").select(DECEASED_COLUMNS).in("deceased_id", deceasedIds),
    client.from("lot").select(LOT_COLUMNS).in("lot_id", lotIds),
  ]);
  if (deceasedError) throw deceasedError;
  if (lotsError) throw lotsError;
  const areaIds = (lots || []).map((lot) => lot.area_id).filter((areaId): areaId is number => areaId !== null && areaId !== undefined);
  const { data: areas, error: areasError } = areaIds.length ? await client.from("area").select("area_id,area_name").in("area_id", areaIds) : { data: [], error: null };
  if (areasError) throw areasError;

  const deceasedById = new Map((deceased || []).map((item) => [item.deceased_id, item]));
  const lotById = new Map((lots || []).map((item) => [item.lot_id, item]));
  const areaById = new Map((areas || []).map((item) => [item.area_id, item]));
  const items = records.map((record) => {
    const deceasedRecord = deceasedById.get(record.deceased_id);
    const lot = lotById.get(record.lot_id);
    const area = lot?.area_id ? areaById.get(lot.area_id) : undefined;
    return {
      revision: record.revision,
      burialId: record.burial_id,
      name: deceasedRecord?.display_name || "Unnamed record",
      deceasedId: record.deceased_id,
      lotId: record.lot_id,
      plot: lot?.lot_code || "Unassigned",
      section: area?.area_name || "Unassigned",
      recordStatus: enumValue(record.record_status, ["active", "pending", "archived"]),
      birthDate: deceasedRecord?.birth_date || null,
      deathDate: deceasedRecord?.death_date || null,
      publicDisplay: Boolean(deceasedRecord?.public_display),
      intermentDate: record.interment_date,
      intermentStatus: record.interment_status,
      remainsType: record.remains_type,
      referenceNo: record.reference_no,
      serviceProvider: record.service_provider || null,
      recordSource: record.record_source || null,
      qualityNotes: record.quality_notes || null,
      updatedAt: record.updated_at,
      location: parsePoint(lot?.location_geom),
      pixelLocation: lot?.px_loc_x !== null && lot?.px_loc_x !== undefined && lot?.px_loc_y !== null && lot?.px_loc_y !== undefined ? { x: lot.px_loc_x, y: lot.px_loc_y } : null,
      coordinateStatus: enumValue(lot?.coordinate_status || "pending", ["pending", "verified", "rejected"]),
      coordinateVerified: Boolean(lot?.coordinate_verified),
    } satisfies AdminRecord;
  });
  return { items, hasMore: hasMore(from, items.length, count), total: count };
}

export async function getAvailableBurialPlots() {
  const client = requireClient();
  const { data: lots, error: lotError } = await client.from("lot").select("lot_id,lot_code,area_id,status").eq("status", "AVAILABLE").is("deleted_at", null).order("lot_code");
  if (lotError) throw lotError;
  if (!lots?.length) return [];

  const lotIds = lots.map((lot) => lot.lot_id);
  const { data: usedRows, error: usedError } = await client.from("burial_record").select("lot_id").in("lot_id", lotIds);
  if (usedError) throw usedError;
  const usedLotIds = new Set((usedRows || []).map((row) => row.lot_id));
  const unusedLots = lots.filter((lot) => !usedLotIds.has(lot.lot_id));
  if (!unusedLots.length) return [];

  const areaIds = unusedLots.map((lot) => lot.area_id).filter((areaId): areaId is number => areaId !== null && areaId !== undefined);
  const { data: areas, error: areaError } = areaIds.length ? await client.from("area").select("area_id,area_name").in("area_id", areaIds) : { data: [], error: null };
  if (areaError) throw areaError;
  const areaById = new Map((areas || []).map((area) => [area.area_id, area]));
  return unusedLots.map((lot) => {
    const area = lot.area_id ? areaById.get(lot.area_id) : undefined;
    return { lotId: lot.lot_id, lotCode: lot.lot_code, section: area?.area_name || "Unassigned garden", status: "AVAILABLE" } satisfies BurialPlotOption;
  });
}


export async function createBurialRecord(input: BurialRecordInput) {
  return saveStaffRecord("burial_record", null, null, burialPayload(input));
}
export async function updateBurialRecord(burialId: number, input: BurialRecordInput) {
  return saveStaffRecord("burial_record", burialId, input.revision ?? null, burialPayload(input));
}
export async function deleteBurialRecord(burialId: number, revision: number) {
  return saveStaffRecord("burial_record", burialId, revision, {}, "delete");
}


export async function getLotsForVerification(options: PageOptions = {}) {
  return (await getLotsForVerificationPage(options)).items;
}

export async function getLotsForVerificationPage(options: PageOptions = {}): Promise<PageResult<LotRow>> {
  const client = requireClient();
  const { from, to } = pageRange(options);
  const { data, error, count } = await client.from("lot").select(LOT_COLUMNS, { count: "exact" }).is("deleted_at", null).order("updated_at", { ascending: false }).order("lot_id", { ascending: false }).range(from, to);
  if (error) throw error;
  const items = (data || []).map((lot) => ({ ...lot, status: enumValue(lot.status, ["AVAILABLE", "BOOKED", "HOLD"]), coordinate_status: enumValue(lot.coordinate_status, ["pending", "verified", "rejected"]), location: parsePoint(lot.location_geom) }));
  return { items, hasMore: hasMore(from, items.length, count), total: count };
}

export async function getAdminLots(options: PageOptions = {}) {
  return (await getAdminLotsPage(options)).items;
}

export async function getAdminLotsPage(options: PageOptions = {}): Promise<PageResult<AdminLot>> {
  const lotsPage = await getLotsForVerificationPage(options);
  return { ...lotsPage, items: lotsPage.items.map((lot) => ({
    revision: lot.revision,
    lotId: lot.lot_id,
    lotCode: lot.lot_code,
    areaId: lot.area_id,
    blockId: lot.block_id,
    lotOwnerId: lot.lot_owner_id,
    legacyLocationCode: lot.legacy_location_code,
    legacyPaNumber: lot.legacy_pa_number,
    status: lot.status,
    lengthM: lot.length_m,
    widthM: lot.width_m,
    pxLocX: lot.px_loc_x,
    pxLocY: lot.px_loc_y,
    coordinateStatus: lot.coordinate_status,
    coordinateVerified: Boolean(lot.coordinate_verified),
    coordinateAccuracyM: lot.coordinate_accuracy_m,
    location: lot.location,
    updatedAt: lot.updated_at,
  } satisfies AdminLot)) };
}

export async function getPlotAreas() {
  const client = requireClient();
  const { data: areas, error } = await client.from("area").select("area_id,area_code,area_name").eq("area_category", "garden").order("area_name");
  if (error) throw error;
  return (areas || []).map((area) => ({ areaId: area.area_id, areaCode: area.area_code, label: area.area_name }) satisfies PlotAreaOption);
}


function lotPayload(input: LotInput) {
  const coordinate = coordinatePayload(input);
  return {
    area_id: input.areaId, block_id: input.blockId ?? null, lot_owner_id: input.lotOwnerId,
    lot_code: input.lotCode, legacy_location_code: input.legacyLocationCode?.trim() || null,
    legacy_pa_number: input.legacyPaNumber || null, status: input.status, length_m: input.lengthM, width_m: input.widthM,
    location_geom: coordinate.location_geom, coordinate_accuracy_m: coordinate.coordinate_accuracy_m,
  };
}
export async function createLot(input: LotInput) { return saveStaffRecord("lot", null, null, lotPayload(input)); }
export async function updateLot(lotId: number, input: LotInput) { return saveStaffRecord("lot", lotId, input.revision ?? null, lotPayload(input)); }
export async function deleteLot(lotId: number, revision: number) { return saveStaffRecord("lot", lotId, revision, {}, "delete"); }
export async function updateLotVerification(lotId: number, revision: number, status: "verified" | "rejected", reason = "") {
  return saveStaffRecord("lot", lotId, revision, { status, reason }, "review");
}


export async function getAdminAccounts() {
  const client = requireClient();
  const { data: accounts, error } = await client.from("account").select("revision,account_id,username,role_id,is_active,account_status,created_at,approved_at").order("created_at", { ascending: false });
  if (error) throw error;
  const roleIds = (accounts || []).map((account) => account.role_id);
  const { data: roles, error: roleError } = roleIds.length ? await client.from("role").select("role_id,role_name").in("role_id", roleIds) : { data: [], error: null };
  if (roleError) throw roleError;
  const roleById = new Map((roles || []).map((item) => [item.role_id, item.role_name]));
  return (accounts || []).map((account) => ({
    revision: account.revision,
    accountId: account.account_id,
    username: account.username,
    role: roleById.get(account.role_id) === "ADMIN" ? "ADMIN" : "MANAGER",
    accountStatus: account.account_status,
    isActive: account.is_active,
    createdAt: account.created_at,
    approvedAt: account.approved_at,
  })) as AdminAccount[];
}

export async function getLotOwners(options: OwnerPageOptions = {}) {
  return (await getLotOwnersPage(options)).items;
}

export async function getLotOwnersPage(options: OwnerPageOptions = {}): Promise<PageResult<OwnerRow>> {
  const client = requireClient();
  const { from, to } = pageRange(options);
  let query = client.from("lot_owner").select(OWNER_COLUMNS, { count: "exact" }).is("deleted_at", null);
  const search = safeOwnerSearch(options.search);
  if (search) query = query.or(`first_name.ilike.*${search}*,last_name.ilike.*${search}*,aliases.ilike.*${search}*`);
  const { data, error, count } = await query.order("last_name").range(from, to);
  if (error) throw error;
  const items = data || [];
  return { items, hasMore: hasMore(from, items.length, count), total: count };
}

export async function getOwnerRecords(options: OwnerPageOptions = {}) {
  return (await getOwnerRecordsPage(options)).items;
}

export async function getOwnerRecordsPage(options: OwnerPageOptions = {}): Promise<PageResult<LotOwner>> {
  const ownersPage = await getLotOwnersPage(options);
  return { ...ownersPage, items: ownersPage.items.map((owner) => ({
    revision: owner.revision,
    lotOwnerId: owner.lot_owner_id,
    firstName: owner.first_name,
    middleName: owner.middle_name,
    lastName: owner.last_name,
    suffix: owner.suffix,
    aliases: owner.aliases,
    address: owner.address,
    representativeName: owner.representative_name,
    representativeContact: owner.representative_contact,
    representativeRelation: owner.representative_relation,
  } satisfies LotOwner)) };
}


export async function createLotOwner(input: OwnerInput) { return saveStaffRecord("lot_owner", null, null, ownerPayload(input)); }
export async function updateLotOwner(lotOwnerId: number, input: OwnerInput) { return saveStaffRecord("lot_owner", lotOwnerId, input.revision ?? null, ownerPayload(input)); }
export async function deleteLotOwner(lotOwnerId: number, revision: number) { return saveStaffRecord("lot_owner", lotOwnerId, revision, {}, "delete"); }
export async function accountAction(action: "approve" | "activate" | "deactivate" | "role", accountId: string, revision: number, value?: string) {
  return saveStaffRecord("account", accountId, revision, { value: value || null }, action);
}


export async function getAuditLog(exportRows = false, options: PageOptions = {}) {
  const client = requireClient();
  if (exportRows) {
    const { data, error } = await client.rpc("export_audit_log", {});
    if (error) throw error;
    return (data || []) as AuditLogEntry[];
  }
  return (await getAuditLogPage(options)).items;
}

export async function getAuditLogPage(options: PageOptions = {}): Promise<PageResult<AuditLogEntry>> {
  const client = requireClient();
  const { from, to } = pageRange(options);
  const { data, error, count } = await client.from("audit_log").select("audit_id,actor_account_id,action,table_name,record_id,old_values,new_values,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  const items = (data || []) as AuditLogEntry[];
  return { items, hasMore: hasMore(from, items.length, count), total: count };
}

export async function getStorageStatus() {
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_PHOTOS_BUCKET;
  // Bucket metadata endpoints are administrative and should not be called
  // with the browser key. The upload operation below is the authoritative
  // capability check and will return a safe error if the bucket is missing or
  // its Storage policies do not allow the current account.
  return { configured: Boolean(getBrowserSupabase() && bucket), bucket: bucket || null };
}

export async function uploadBurialPhoto(input: { burialId: number; file: File; caption?: string; capturedAt?: string }) {
  const client = requireClient();
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_PHOTOS_BUCKET;
  if (!bucket) throw new Error("Photo storage is not configured for this Supabase environment.");
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(input.file.type)) throw new Error("Use a JPG, PNG, or WebP image.");
  if (input.file.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.");
  const userId = await getCurrentUserId(client);
  const fileName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || "photo";
  const storagePath = `burial/${input.burialId}/${crypto.randomUUID()}-${fileName}`;
  const { error: uploadError } = await client.storage.from(bucket).upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
  if (uploadError) throw uploadError;
  const { error: metadataError } = await client.from("photo").insert({
    burial_id: input.burialId,
    uploaded_by: userId,
    storage_path: storagePath,
    file_name: input.file.name,
    caption: input.caption?.trim() || null,
    captured_at: input.capturedAt || null,
    approval_status: "pending",
    public_display: false,
  });
  if (metadataError) {
    await client.storage.from(bucket).remove([storagePath]);
    throw metadataError;
  }
}

export async function getAdminPhotos(options: PageOptions & { status?: AdminPhoto["approvalStatus"] | "all" } = {}) {
  const client = requireClient();
  const { from, to } = pageRange(options);
  let query = client.from("photo").select(PHOTO_COLUMNS, { count: "exact" });
  if (options.status && options.status !== "all") query = query.eq("approval_status", options.status);
  const { data, error, count } = await query.order("created_at", { ascending: false }).order("photo_id", { ascending: false }).range(from, to);
  if (error) throw error;
  const items = (data || []).map((photo) => ({
    revision: photo.revision,
    photoId: photo.photo_id,
    burialId: photo.burial_id,
    fileName: photo.file_name,
    caption: photo.caption,
    capturedAt: photo.captured_at,
    approvalStatus: photo.approval_status,
    publicDisplay: Boolean(photo.public_display),
    createdAt: photo.created_at,
  })) as AdminPhoto[];
  return { items, hasMore: hasMore(from, items.length, count), total: count } satisfies PageResult<AdminPhoto>;
}


export async function updatePhotoReview(photoId: number, approvalStatus: AdminPhoto["approvalStatus"], revision: number) {
  return saveStaffRecord("photo", photoId, revision, { status: approvalStatus }, "review");
}

export type StaffBurialOption = { burial_id: number; display_name: string; lot_code: string; area_name: string | null };
export type DashboardCounts = { active: number; pending: number; archived: number; plots: number; unverified: number; missingCoordinates: number; pendingCoordinates: number };
export async function getDashboardCounts(): Promise<DashboardCounts> {
  const { data, error } = await requireClient().rpc("staff_dashboard_counts");
  if (error || !data || typeof data !== "object" || Array.isArray(data) || !["active", "pending", "archived", "plots", "unverified", "missingCoordinates", "pendingCoordinates"].every((key) => typeof data[key] === "number")) throw new Error("Dashboard totals could not be loaded. Reload to try again.");
  return data as DashboardCounts;
}
export async function searchStaffBurials(query: string, page = 1): Promise<{ items: StaffBurialOption[]; total: number }> {
  const { data, error } = await requireClient().rpc("search_staff_burials", { p_query: query.slice(0, 160), p_page: page });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.items) || typeof data.total !== "number") throw new Error("Burial records could not be loaded.");
  return { items: data.items as StaffBurialOption[], total: data.total };
}

export async function getAdminPhotoPreview(photoId: number) {
  const client = requireClient();
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_PHOTOS_BUCKET;
  if (!bucket) throw new Error("Photo storage is not configured.");
  const { data: photo, error } = await client.from("photo").select("storage_path").eq("photo_id", photoId).single();
  if (error || !photo) throw new Error("This photo could not be loaded.");
  const { data, error: storageError } = await client.storage.from(bucket).createSignedUrl(photo.storage_path, 120);
  if (storageError || !data) throw new Error("Photo preview is unavailable. Try again.");
  return data.signedUrl;
}
const inflight = new Map<string, Promise<unknown>>();
export async function saveStaffRecord(entity: string, id: string | number | null, revision: number | null, values: Record<string, unknown>, operation = "save") {
  const client = requireClient();
  const actor = await getCurrentUserId(client);
  const key = await mutationFingerprint(JSON.stringify([actor, entity, id, revision, values, operation]));
  if (inflight.has(key)) return inflight.get(key);
  const requestId = pendingRequestId(key);
  const pending = (async () => {
    const { data, error } = await client.rpc("staff_save_record", {
      p_entity: entity, p_id: id === null ? null : String(id), p_revision: revision,
      p_values: values as Json, p_request_id: requestId, p_operation: operation,
    });
    if (error) throw new Error(error.code === "PGRST202"
      ? "The database update for safe editing has not been applied. Contact the project administrator."
      : error.message || "The change could not be saved. Retry to safely resume the same request.");
    acknowledgeRequest(key);
    return data;
  })();
  inflight.set(key, pending);
  try { return await pending; } finally { inflight.delete(key); }
}
export type RecordHistory = { history_id: number; entity: string; record_id: string; operation: string; before_values: Record<string, unknown>; after_revision: number; created_at: string };
export async function getRecordHistory(page = 0) {
  const { data, error } = await requireClient().from("record_history").select("history_id,entity,record_id,operation,before_values,after_revision,created_at").order("history_id", { ascending: false }).range(page * 25, page * 25 + 24);
  if (error) throw new Error(error.message);
  return (data || []) as RecordHistory[];
}


export type BurialRecordInput = {
  revision?: number;
  name: string;
  lotId: number;
  birthDate?: string;
  deathDate?: string;
  publicDisplay: boolean;
  intermentDate?: string;
  recordStatus?: AdminRecord["recordStatus"];
  intermentStatus: "PERMANENT" | "TEMPORARY";
  remainsType: "FRESH" | "ASH" | "BONE";
  referenceNo?: string;
  serviceProvider?: string;
  recordSource?: string;
  qualityNotes?: string;
};

export type LotInput = {
  revision?: number;
  areaId: number;
  blockId?: number | null;
  lotOwnerId: number | null;
  lotCode: string;
  legacyLocationCode?: string;
  legacyPaNumber?: string;
  status: "AVAILABLE" | "BOOKED" | "HOLD";
  lengthM: number | null;
  widthM: number | null;
  longitude?: number | null;
  latitude?: number | null;
  coordinateAccuracyM?: number | null;
  coordinateStatus?: "pending" | "verified" | "rejected";
  coordinateVerified?: boolean;
};

export type OwnerInput = {
  revision?: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  aliases?: string;
  address: string;
  representativeName?: string;
  representativeContact?: string;
  representativeRelation?: string;
};

function requireClient() {
  const client = getBrowserSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  return client;
}

function enumValue<T extends string>(value: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new Error("A record contains an unsupported status. Contact the administrator.");
  return value as T;
}

async function getCurrentUserId(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Your authenticated session is no longer available.");
  return data.user.id;
}

function ownerPayload(input: OwnerInput) {
  return {
    first_name: input.firstName,
    middle_name: input.middleName || null,
    last_name: input.lastName,
    suffix: input.suffix || null,
    aliases: input.aliases || null,
    address: input.address,
    representative_name: input.representativeName || null,
    representative_contact: input.representativeContact || null,
    representative_relation: input.representativeRelation || null,
  };
}



function parsePoint(value: unknown) {
  const coordinates = getPointCoordinates(value);
  return coordinates ? { longitude: coordinates[0], latitude: coordinates[1] } : null;
}

function getPointCoordinates(value: unknown): [number, number] | null {
  if (value && typeof value === "object" && "coordinates" in value) {
    const coordinates = (value as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2 && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") return [coordinates[0], coordinates[1]];
  }
  if (typeof value !== "string") return null;
  const normalized = value.replace(/^\s*SRID=\d+\s*;\s*/i, "");
  try {
    const parsed = JSON.parse(normalized) as { coordinates?: unknown };
    const coordinates = parsed.coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2 && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") return [coordinates[0], coordinates[1]];
  } catch {
    // PostgREST may return geography as WKT text.
  }
  const match = normalized.match(/^\s*POINT\s*\(\s*([^\s,]+)\s+([^\s,)]+)\s*\)\s*$/i);
  if (!match) return null;
  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  return Number.isFinite(longitude) && Number.isFinite(latitude) ? [longitude, latitude] : null;
}

function burialPayload(input: BurialRecordInput) {
  return {
    display_name: input.name,
    birth_date: input.birthDate || null,
    death_date: input.deathDate || null,
    public_display: input.publicDisplay,
    lot_id: input.lotId,
    interment_date: input.intermentDate || null,
    record_status: input.recordStatus || "pending",
    interment_status: input.intermentStatus,
    remains_type: input.remainsType,
    reference_no: input.referenceNo || null,
    service_provider: input.serviceProvider || null,
    record_source: input.recordSource || null,
    quality_notes: input.qualityNotes || null,
  };
}



function coordinatePayload(input: LotInput) {
  const hasLongitude = input.longitude !== null && input.longitude !== undefined;
  const hasLatitude = input.latitude !== null && input.latitude !== undefined;
  if (hasLongitude !== hasLatitude) throw new Error("Enter both longitude and latitude, or leave both coordinates blank.");
  if (!hasLongitude) return { location_geom: null, coordinate_accuracy_m: null, coordinate_status: "pending", coordinate_verified: false };
  const longitude = Number(input.longitude);
  const latitude = Number(input.latitude);
  const accuracy = input.coordinateAccuracyM === null || input.coordinateAccuracyM === undefined ? null : Number(input.coordinateAccuracyM);
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new Error("Enter valid longitude and latitude values.");
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) throw new Error("Coordinate accuracy must be zero or greater.");
  return {
    location_geom: { type: "Point", coordinates: [longitude, latitude] },
    coordinate_accuracy_m: accuracy,
    coordinate_status: input.coordinateStatus || "pending",
    coordinate_verified: Boolean(input.coordinateVerified),
  };
}

function pageRange(options: PageOptions) {
  const page = Number.isInteger(options.page) && (options.page || 0) >= 0 ? options.page || 0 : 0;
  const pageSize = Number.isInteger(options.pageSize) && (options.pageSize || 0) > 0 ? Math.min(options.pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  const from = page * pageSize;
  return { from, to: from + pageSize - 1 };
}

function safeOwnerSearch(value: string | undefined) {
  return value?.trim().replace(/[^a-zA-Z0-9À-ž\s'._-]/g, "").slice(0, 80) || "";
}

function hasMore(from: number, itemCount: number, total: number | null) {
  return total === null ? itemCount > 0 : from + itemCount < total;
}
