"use client";

import { getBrowserSupabase } from "./config";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminAccount, AdminLot, AdminPhoto, AdminRecord, AuditLogEntry, BurialPlotOption, LotOwner, PlotAreaOption } from "./types";

const RECORD_COLUMNS = "burial_id,deceased_id,lot_id,interment_date,record_status,interment_status,remains_type,reference_no,service_provider,record_source,quality_notes,created_by,updated_by,updated_at";
const DECEASED_COLUMNS = "deceased_id,display_name,birth_date,death_date,public_display";
const BURIAL_WRITE_COLUMNS = "burial_id,deceased_id,lot_id,created_by,updated_by,interment_order_number,reference_no,interment_date,record_status,interment_status,remains_type,exhumation_date,service_provider,record_source,quality_notes";
const LOT_COLUMNS = "lot_id,lot_code,area_id,block_id,lot_owner_id,legacy_location_code,legacy_pa_number,status,length_m,width_m,px_loc_x,px_loc_y,location_geom,coordinate_accuracy_m,coordinate_status,coordinate_verified,updated_at";
const OWNER_COLUMNS = "lot_owner_id,first_name,middle_name,last_name,suffix,aliases,address,representative_name,representative_contact,representative_relation";
const PHOTO_COLUMNS = "photo_id,burial_id,file_name,caption,captured_at,approval_status,public_display,created_at";
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export type PageResult<T> = { items: T[]; hasMore: boolean; total: number | null };
type PageOptions = { page?: number; pageSize?: number };
type OwnerPageOptions = PageOptions & { search?: string };
type LotRow = { lot_id: number; lot_code: string; area_id: number; block_id: number | null; lot_owner_id: number | null; legacy_location_code: string | null; legacy_pa_number: string | null; status: "AVAILABLE" | "BOOKED" | "HOLD"; length_m: number | null; width_m: number | null; px_loc_x: number | null; px_loc_y: number | null; location_geom: unknown; coordinate_accuracy_m: number | null; coordinate_status: "pending" | "verified" | "rejected"; coordinate_verified: boolean; updated_at: string; location: { longitude: number; latitude: number } | null };
type OwnerRow = { lot_owner_id: number; first_name: string; middle_name: string | null; last_name: string; suffix: string | null; aliases: string | null; address: string; representative_name: string | null; representative_contact: string | null; representative_relation: string | null };

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
  const { data: records, error, count } = await client.from("burial_record").select(RECORD_COLUMNS, { count: "exact" }).order("updated_at", { ascending: false }).range(from, to);
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
      burialId: record.burial_id,
      name: deceasedRecord?.display_name || "Unnamed record",
      deceasedId: record.deceased_id,
      lotId: record.lot_id,
      plot: lot?.lot_code || "Unassigned",
      section: area?.area_name || "Unassigned",
      recordStatus: record.record_status,
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
      coordinateStatus: lot?.coordinate_status || "pending",
      coordinateVerified: Boolean(lot?.coordinate_verified),
    } satisfies AdminRecord;
  });
  return { items, hasMore: hasMore(from, items.length, count), total: count };
}

export async function getAvailableBurialPlots() {
  const client = requireClient();
  const { data: lots, error: lotError } = await client.from("lot").select("lot_id,lot_code,area_id,status").eq("status", "AVAILABLE").order("lot_code");
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
  const client = requireClient();
  const { error: transactionError } = await client.rpc("admin_create_burial_record", burialRecordRpcPayload(input));
  if (!transactionError) return;
  if (!isMissingRpcError(transactionError)) throw transactionError;
  await createBurialRecordWithCleanup(client, input);
}

async function createBurialRecordWithCleanup(client: SupabaseClient, input: BurialRecordInput) {
  const userId = await getCurrentUserId(client);
  await assertAvailableLot(client, input.lotId);
  const { data: deceased, error: deceasedError } = await client.from("deceased").insert({
    display_name: input.name,
    birth_date: input.birthDate || null,
    death_date: input.deathDate || null,
    public_display: input.publicDisplay,
  }).select("deceased_id").single();
  if (deceasedError || !deceased) throw deceasedError || new Error("The deceased record could not be created.");

  const { error: burialError } = await client.from("burial_record").insert({
    deceased_id: deceased.deceased_id,
    lot_id: input.lotId,
    created_by: userId,
    updated_by: userId,
    reference_no: input.referenceNo || null,
    interment_date: input.intermentDate || null,
    record_status: input.recordStatus || "pending",
    interment_status: input.intermentStatus,
    remains_type: input.remainsType,
    service_provider: input.serviceProvider || null,
    record_source: input.recordSource || null,
    quality_notes: input.qualityNotes || null,
  });
  if (burialError) {
    await client.from("deceased").delete().eq("deceased_id", deceased.deceased_id);
    throw burialError;
  }
}

export async function updateBurialRecord(burialId: number, input: BurialRecordInput) {
  const client = requireClient();
  const { error: transactionError } = await client.rpc("admin_update_burial_record", { p_burial_id: burialId, ...burialRecordRpcPayload(input) });
  if (!transactionError) return;
  if (!isMissingRpcError(transactionError)) throw transactionError;
  await updateBurialRecordWithCleanup(client, burialId, input);
}

async function updateBurialRecordWithCleanup(client: SupabaseClient, burialId: number, input: BurialRecordInput) {
  const userId = await getCurrentUserId(client);
  const { data: current, error: currentError } = await client.from("burial_record").select(BURIAL_WRITE_COLUMNS).eq("burial_id", burialId).single();
  if (currentError || !current) throw currentError || new Error("The burial record could not be found.");
  const { data: deceased, error: deceasedError } = await client.from("deceased").select("deceased_id,display_name,birth_date,death_date,public_display").eq("deceased_id", current.deceased_id).single();
  if (deceasedError || !deceased) throw deceasedError || new Error("The linked deceased record could not be found.");
  if (input.lotId !== current.lot_id) await assertAvailableLot(client, input.lotId);

  const { error: deceasedUpdateError } = await client.from("deceased").update({
    display_name: input.name,
    birth_date: input.birthDate || null,
    death_date: input.deathDate || null,
    public_display: input.publicDisplay,
  }).eq("deceased_id", deceased.deceased_id);
  if (deceasedUpdateError) throw deceasedUpdateError;

  const { error: burialUpdateError } = await client.from("burial_record").update({
    lot_id: input.lotId,
    updated_by: userId,
    reference_no: input.referenceNo || null,
    interment_date: input.intermentDate || null,
    record_status: input.recordStatus || "pending",
    interment_status: input.intermentStatus,
    remains_type: input.remainsType,
    service_provider: input.serviceProvider || null,
    record_source: input.recordSource || null,
    quality_notes: input.qualityNotes || null,
  }).eq("burial_id", burialId);
  if (burialUpdateError) {
    await client.from("deceased").update({
      display_name: deceased.display_name,
      birth_date: deceased.birth_date,
      death_date: deceased.death_date,
      public_display: deceased.public_display,
    }).eq("deceased_id", deceased.deceased_id);
    throw burialUpdateError;
  }
}

export async function deleteBurialRecord(burialId: number) {
  const client = requireClient();
  const { error: transactionError } = await client.rpc("admin_delete_burial_record", { p_burial_id: burialId });
  if (!transactionError) return;
  if (!isMissingRpcError(transactionError)) throw transactionError;
  await deleteBurialRecordWithCleanup(client, burialId);
}

async function deleteBurialRecordWithCleanup(client: SupabaseClient, burialId: number) {
  const { data: current, error: currentError } = await client.from("burial_record").select(BURIAL_WRITE_COLUMNS).eq("burial_id", burialId).single();
  if (currentError || !current) throw currentError || new Error("The burial record could not be found.");
  const { count, error: countError } = await client.from("burial_record").select("burial_id", { count: "exact", head: true }).eq("deceased_id", current.deceased_id);
  if (countError) throw countError;
  if (count !== 1) throw new Error("This deceased record is linked to more than one burial record and cannot be deleted here.");

  const { error: burialDeleteError } = await client.from("burial_record").delete().eq("burial_id", burialId);
  if (burialDeleteError) throw burialDeleteError;
  const { error: deceasedDeleteError } = await client.from("deceased").delete().eq("deceased_id", current.deceased_id);
  if (deceasedDeleteError) {
    await client.from("burial_record").insert(current);
    throw deceasedDeleteError;
  }
}

export async function updateBurialStatus(burialId: number, recordStatus: AdminRecord["recordStatus"]) {
  const client = requireClient();
  const userId = await getCurrentUserId(client);
  const { error } = await client.from("burial_record").update({ record_status: recordStatus, updated_by: userId }).eq("burial_id", burialId);
  if (error) throw error;
}

export async function getLotsForVerification(options: PageOptions = {}) {
  return (await getLotsForVerificationPage(options)).items;
}

export async function getLotsForVerificationPage(options: PageOptions = {}): Promise<PageResult<LotRow>> {
  const client = requireClient();
  const { from, to } = pageRange(options);
  const { data, error, count } = await client.from("lot").select(LOT_COLUMNS, { count: "exact" }).order("updated_at", { ascending: false }).range(from, to);
  if (error) throw error;
  const items = (data || []).map((lot) => ({ ...lot, location: parsePoint(lot.location_geom) }));
  return { items, hasMore: hasMore(from, items.length, count), total: count };
}

export async function getAdminLots(options: PageOptions = {}) {
  return (await getAdminLotsPage(options)).items;
}

export async function getAdminLotsPage(options: PageOptions = {}): Promise<PageResult<AdminLot>> {
  const lotsPage = await getLotsForVerificationPage(options);
  return { ...lotsPage, items: lotsPage.items.map((lot) => ({
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

export async function createLot(input: LotInput) {
  const client = requireClient();
  const coordinate = coordinatePayload(input);
  const { error } = await client.from("lot").insert({
    area_id: input.areaId,
    block_id: input.blockId ?? null,
    lot_owner_id: input.lotOwnerId,
    lot_code: input.lotCode,
    legacy_location_code: input.legacyLocationCode?.trim() || null,
    legacy_pa_number: input.legacyPaNumber || null,
    status: input.status,
    length_m: input.lengthM,
    width_m: input.widthM,
    ...coordinate,
  });
  if (error) throw error;
}

export async function updateLot(lotId: number, input: LotInput) {
  const client = requireClient();
  const coordinate = coordinatePayload(input);
  const { error } = await client.from("lot").update({
    area_id: input.areaId,
    block_id: input.blockId ?? null,
    lot_owner_id: input.lotOwnerId,
    lot_code: input.lotCode,
    legacy_location_code: input.legacyLocationCode?.trim() || null,
    legacy_pa_number: input.legacyPaNumber || null,
    status: input.status,
    length_m: input.lengthM,
    width_m: input.widthM,
    ...coordinate,
  }).eq("lot_id", lotId);
  if (error) throw error;
}

export async function deleteLot(lotId: number) {
  const client = requireClient();
  const { error } = await client.from("lot").delete().eq("lot_id", lotId);
  if (error) throw error;
}

export async function updateLotVerification(lotId: number, verified: boolean, status: "pending" | "verified" | "rejected") {
  const client = requireClient();
  const { error } = await client.from("lot").update({ coordinate_verified: verified, coordinate_status: status }).eq("lot_id", lotId);
  if (error) throw error;
}

export async function getAdminAccounts() {
  const client = requireClient();
  const { data: accounts, error } = await client.from("account").select("account_id,username,role_id,is_active,account_status,created_at,approved_at").order("created_at", { ascending: false });
  if (error) throw error;
  const roleIds = (accounts || []).map((account) => account.role_id);
  const { data: roles, error: roleError } = roleIds.length ? await client.from("role").select("role_id,role_name").in("role_id", roleIds) : { data: [], error: null };
  if (roleError) throw roleError;
  const roleById = new Map((roles || []).map((item) => [item.role_id, item.role_name]));
  return (accounts || []).map((account) => ({
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
  let query = client.from("lot_owner").select(OWNER_COLUMNS, { count: "exact" });
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

export async function createLotOwner(input: OwnerInput) {
  const client = requireClient();
  const { error } = await client.from("lot_owner").insert(ownerPayload(input));
  if (error) throw error;
}

export async function updateLotOwner(lotOwnerId: number, input: OwnerInput) {
  const client = requireClient();
  const { error } = await client.from("lot_owner").update(ownerPayload(input)).eq("lot_owner_id", lotOwnerId);
  if (error) throw error;
}

export async function deleteLotOwner(lotOwnerId: number) {
  const client = requireClient();
  const { error } = await client.from("lot_owner").delete().eq("lot_owner_id", lotOwnerId);
  if (error) throw error;
}

export async function accountAction(action: "approve" | "activate" | "deactivate" | "role", accountId: string, value?: string) {
  const client = requireClient();
  const calls = {
    approve: ["admin_approve_account", { p_account_id: accountId }],
    activate: ["admin_activate_account", { p_account_id: accountId }],
    deactivate: ["admin_deactivate_account", { p_account_id: accountId, p_account_status: value || "SUSPENDED" }],
    role: ["admin_change_account_role", { p_account_id: accountId, p_role_name: value || "MANAGER" }],
  } as const;
  const [fn, args] = calls[action];
  const { error } = await client.rpc(fn, args);
  if (error) throw error;
}

export async function getAuditLog(exportRows = false, options: PageOptions = {}) {
  const client = requireClient();
  if (exportRows) {
    const { data, error } = await client.rpc("export_audit_log", { p_from: null, p_to: null });
    if (error) throw error;
    return (data || []) as AuditLogEntry[];
  }
  return (await getAuditLogPage(options)).items;
}

export async function getAuditLogPage(options: PageOptions = {}): Promise<PageResult<AuditLogEntry>> {
  const client = requireClient();
  const { from, to } = pageRange(options);
  const { data, error, count } = await client.from("audit_log").select("audit_id,actor_account_id,action,table_name,record_id,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
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

export async function getAdminPhotos(options: PageOptions = {}) {
  const client = requireClient();
  const { from, to } = pageRange(options);
  const { data, error, count } = await client.from("photo").select(PHOTO_COLUMNS, { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
  if (error) throw error;
  const items = (data || []).map((photo) => ({
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

export async function updatePhotoReview(photoId: number, approvalStatus: AdminPhoto["approvalStatus"]) {
  const client = requireClient();
  const userId = await getCurrentUserId(client);
  const { error } = await client.from("photo").update({
    approval_status: approvalStatus,
    public_display: approvalStatus === "approved",
    reviewed_by: userId,
  }).eq("photo_id", photoId);
  if (error) throw error;
}

export type BurialRecordInput = {
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

async function assertAvailableLot(client: SupabaseClient, lotId: number, ignoreBurialId?: number) {
  const { data: lot, error: lotError } = await client.from("lot").select("lot_id,status").eq("lot_id", lotId).maybeSingle();
  if (lotError) throw lotError;
  if (!lot || lot.status !== "AVAILABLE") throw new Error("That plot is no longer available.");
  let query = client.from("burial_record").select("burial_id").eq("lot_id", lotId).limit(1);
  if (ignoreBurialId) query = query.neq("burial_id", ignoreBurialId);
  const { data: used, error: usedError } = await query.maybeSingle();
  if (usedError) throw usedError;
  if (used) throw new Error("That plot already has a burial record.");
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

function burialRecordRpcPayload(input: BurialRecordInput) {
  return {
    p_display_name: input.name,
    p_birth_date: input.birthDate || null,
    p_death_date: input.deathDate || null,
    p_public_display: input.publicDisplay,
    p_lot_id: input.lotId,
    p_interment_date: input.intermentDate || null,
    p_record_status: input.recordStatus || "pending",
    p_interment_status: input.intermentStatus,
    p_remains_type: input.remainsType,
    p_reference_no: input.referenceNo || null,
    p_service_provider: input.serviceProvider || null,
    p_record_source: input.recordSource || null,
    p_quality_notes: input.qualityNotes || null,
  };
}

function isMissingRpcError(error: { code?: string; message?: string }) {
  return error.code === "PGRST202" || error.code === "42883" || /function .* does not exist|could not find the function/i.test(error.message || "");
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
