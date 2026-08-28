"use client";

import { getBrowserSupabase } from "./config";
import type { AdminAccount, AdminRecord, AuditLogEntry } from "./types";

const RECORD_COLUMNS = "burial_id,deceased_id,lot_id,interment_date,record_status,interment_status,remains_type,reference_no,updated_at";

export async function getAdminRecords() {
  const client = getBrowserSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  const { data: records, error } = await client.from("burial_record").select(RECORD_COLUMNS).order("updated_at", { ascending: false });
  if (error) throw error;
  if (!records?.length) return [] as AdminRecord[];

  const deceasedIds = records.map((record) => record.deceased_id);
  const lotIds = records.map((record) => record.lot_id);
  const [{ data: deceased, error: deceasedError }, { data: lots, error: lotsError }] = await Promise.all([
    client.from("deceased").select("deceased_id,display_name").in("deceased_id", deceasedIds),
    client.from("lot").select("lot_id,lot_code,block_id,location_geom,px_loc_x,px_loc_y,coordinate_status,coordinate_verified").in("lot_id", lotIds),
  ]);
  if (deceasedError) throw deceasedError;
  if (lotsError) throw lotsError;
  const blockIds = (lots || []).map((lot) => lot.block_id);
  const { data: blocks, error: blocksError } = blockIds.length ? await client.from("block").select("block_id,block_number,sector_id").in("block_id", blockIds) : { data: [], error: null };
  if (blocksError) throw blocksError;
  const sectorIds = (blocks || []).map((block) => block.sector_id);
  const { data: sectors, error: sectorsError } = sectorIds.length ? await client.from("sector").select("sector_id,sector_name,area_id").in("sector_id", sectorIds) : { data: [], error: null };
  if (sectorsError) throw sectorsError;
  const areaIds = (sectors || []).map((sector) => sector.area_id);
  const { data: areas, error: areasError } = areaIds.length ? await client.from("area").select("area_id,area_name").in("area_id", areaIds) : { data: [], error: null };
  if (areasError) throw areasError;

  const deceasedById = new Map((deceased || []).map((item) => [item.deceased_id, item.display_name]));
  const lotById = new Map((lots || []).map((item) => [item.lot_id, item]));
  const blockById = new Map((blocks || []).map((item) => [item.block_id, item]));
  const sectorById = new Map((sectors || []).map((item) => [item.sector_id, item]));
  const areaById = new Map((areas || []).map((item) => [item.area_id, item]));
  return records.map((record) => {
    const lot = lotById.get(record.lot_id);
    const block = lot ? blockById.get(lot.block_id) : undefined;
    const sector = block ? sectorById.get(block.sector_id) : undefined;
    const area = sector ? areaById.get(sector.area_id) : undefined;
    return {
      burialId: record.burial_id,
      name: deceasedById.get(record.deceased_id) || "Unnamed record",
      deceasedId: record.deceased_id,
      lotId: record.lot_id,
      plot: lot?.lot_code || "Unassigned",
      section: area?.area_name || sector?.sector_name || "Unassigned",
      recordStatus: record.record_status,
      intermentDate: record.interment_date,
      intermentStatus: record.interment_status,
      remainsType: record.remains_type,
      referenceNo: record.reference_no,
      updatedAt: record.updated_at,
      location: parsePoint(lot?.location_geom),
      pixelLocation: lot?.px_loc_x !== null && lot?.px_loc_x !== undefined && lot?.px_loc_y !== null && lot?.px_loc_y !== undefined ? { x: lot.px_loc_x, y: lot.px_loc_y } : null,
      coordinateStatus: lot?.coordinate_status || "pending",
      coordinateVerified: Boolean(lot?.coordinate_verified),
    } satisfies AdminRecord;
  });
}

export async function updateBurialStatus(burialId: number, recordStatus: AdminRecord["recordStatus"]) {
  const client = getBrowserSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  const { error } = await client.from("burial_record").update({ record_status: recordStatus }).eq("burial_id", burialId);
  if (error) throw error;
}

export async function createBurialRecord(input: { name: string; lotId: number; birthDate?: string; deathDate?: string; publicDisplay: boolean; intermentDate?: string; intermentStatus: "PERMANENT" | "TEMPORARY"; remainsType: "FRESH" | "ASH" | "BONE" }) {
  const client = getBrowserSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  const { data: deceased, error: deceasedError } = await client.from("deceased").insert({ display_name: input.name, birth_date: input.birthDate || null, death_date: input.deathDate || null, public_display: input.publicDisplay }).select("deceased_id").single();
  if (deceasedError || !deceased) throw deceasedError || new Error("The deceased record could not be created.");
  const { error: burialError } = await client.from("burial_record").insert({ deceased_id: deceased.deceased_id, lot_id: input.lotId, interment_date: input.intermentDate || null, interment_status: input.intermentStatus, remains_type: input.remainsType, record_status: "pending" });
  if (burialError) {
    await client.from("deceased").delete().eq("deceased_id", deceased.deceased_id);
    throw burialError;
  }
}

export async function getLotsForVerification() {
  const client = getBrowserSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  const { data, error } = await client.from("lot").select("lot_id,lot_code,status,block_id,coordinate_accuracy_m,coordinate_status,coordinate_verified,location_geom,px_loc_x,px_loc_y,updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((lot) => ({ ...lot, location: parsePoint(lot.location_geom) }));
}

export async function updateLotVerification(lotId: number, verified: boolean, status: "pending" | "verified" | "rejected") {
  const client = getBrowserSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  const { error } = await client.from("lot").update({ coordinate_verified: verified, coordinate_status: status }).eq("lot_id", lotId);
  if (error) throw error;
}

export async function getAdminAccounts() {
  const client = getBrowserSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  const { data: accounts, error } = await client.from("account").select("account_id,username,role_id,is_active,account_status,created_at,approved_at").order("created_at", { ascending: false });
  if (error) throw error;
  const roleIds = (accounts || []).map((account) => account.role_id);
  const { data: roles, error: roleError } = roleIds.length ? await client.from("role").select("role_id,role_name").in("role_id", roleIds) : { data: [], error: null };
  if (roleError) throw roleError;
  const roleById = new Map((roles || []).map((role) => [role.role_id, role.role_name]));
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

export async function getLotOwners() {
  const client = getBrowserSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  const { data, error } = await client.from("lot_owner").select("lot_owner_id,first_name,middle_name,last_name,suffix,aliases,address,representative_name,representative_contact,representative_relation").order("last_name");
  if (error) throw error;
  return data || [];
}

export async function accountAction(action: "approve" | "activate" | "deactivate" | "role", accountId: string, value?: string) {
  const client = getBrowserSupabase();
  if (!client) throw new Error("Supabase is not configured.");
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

export async function getAuditLog(exportRows = false) {
  const client = getBrowserSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  if (exportRows) {
    const { data, error } = await client.rpc("export_audit_log", { p_from: null, p_to: null });
    if (error) throw error;
    return (data || []) as AuditLogEntry[];
  }
  const { data, error } = await client.from("audit_log").select("audit_id,actor_account_id,action,table_name,record_id,old_values,new_values,created_at").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return (data || []) as AuditLogEntry[];
}

export async function getStorageStatus() {
  const client = getBrowserSupabase();
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_PHOTOS_BUCKET;
  if (!client || !bucket) return { configured: false, bucket: null };
  const { error } = await client.storage.getBucket(bucket);
  return { configured: !error, bucket };
}

function parsePoint(value: unknown) {
  if (!value || typeof value !== "object" || !("coordinates" in value)) return null;
  const coordinates = (value as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2 || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") return null;
  return { longitude: coordinates[0], latitude: coordinates[1] };
}
