import { getPublicSupabase, localSupabaseConfig } from "./config";
import type { PublicBurialRecord } from "./types";
import { filterGravesites, getGravesiteById, getGravesiteByPlot, gravesites } from "@/lib/mock-data";

type PublicRow = {
  burial_id: number;
  display_name: string;
  birth_date: string | null;
  death_date: string | null;
  record_status: "active";
  lot_code: string;
  area_name?: string | null;
  sector_name?: string | null;
  block_number?: number | null;
  location_geom: unknown;
  px_loc_x: number | null;
  px_loc_y: number | null;
  location_verified: boolean;
};

const PUBLIC_COLUMNS = "burial_id,display_name,birth_date,death_date,record_status,lot_code,area_name,sector_name,block_number,location_geom,px_loc_x,px_loc_y,location_verified";
const PUBLIC_BASE_COLUMNS = "burial_id,display_name,birth_date,death_date,record_status,lot_code,location_geom,px_loc_x,px_loc_y,location_verified";

export async function getPublicBurialRecords(filters: { query?: string; section?: string; year?: string } = {}) {
  const client = getPublicSupabase();
  if (client) {
    let request = client.from("public_burial_records").select(PUBLIC_COLUMNS).order("display_name");
    const query = filters.query?.trim().replaceAll("%", "\\%").replaceAll("_", "\\_");
    if (query) request = request.ilike("display_name", `%${query}%`);
    if (filters.section && filters.section !== "all") request = request.eq("area_name", filters.section);
    if (filters.year === "1800-1899") request = request.gte("death_date", "1800-01-01").lt("death_date", "1900-01-01");
    if (filters.year === "1900-1999") request = request.gte("death_date", "1900-01-01").lt("death_date", "2000-01-01");
    const { data, error } = await request;
    if (!error && data?.length) return (data as PublicRow[]).map(toPublicRecord);
    if (error && localSupabaseConfig.environment === "hosted") {
      let safeRequest = client.from("public_burial_records").select(PUBLIC_BASE_COLUMNS).order("display_name");
      if (query) safeRequest = safeRequest.ilike("display_name", `%${query}%`);
      if (filters.year === "1800-1899") safeRequest = safeRequest.gte("death_date", "1800-01-01").lt("death_date", "1900-01-01");
      if (filters.year === "1900-1999") safeRequest = safeRequest.gte("death_date", "1900-01-01").lt("death_date", "2000-01-01");
      const { data: safeData, error: safeError } = await safeRequest;
      if (!safeError && safeData?.length) return (safeData as PublicRow[]).map(toPublicRecord);
    }
    if (localSupabaseConfig.environment === "hosted") return [];
  }

  return filterGravesites(filters).map(toFallbackRecord);
}

export async function getPublicBurialRecord(id: string) {
  const client = getPublicSupabase();
  if (client && /^\d+$/.test(id)) {
    const { data, error } = await client.from("public_burial_records").select(PUBLIC_COLUMNS).eq("burial_id", Number(id)).maybeSingle();
    if (!error && data) return toPublicRecord(data as PublicRow);
    if (error && localSupabaseConfig.environment === "hosted") {
      const { data: safeData, error: safeError } = await client.from("public_burial_records").select(PUBLIC_BASE_COLUMNS).eq("burial_id", Number(id)).maybeSingle();
      if (!safeError && safeData) return toPublicRecord(safeData as PublicRow);
      return null;
    }
    if (localSupabaseConfig.environment === "hosted") return null;
  }

  const mock = getGravesiteById(id);
  return mock ? toFallbackRecord(mock) : null;
}

export async function getPublicBurialRecordByPlot(plot: string) {
  const client = getPublicSupabase();
  if (client) {
    const { data, error } = await client.from("public_burial_records").select(PUBLIC_COLUMNS).eq("lot_code", plot).maybeSingle();
    if (!error && data) return toPublicRecord(data as PublicRow);
    if (error && localSupabaseConfig.environment === "hosted") {
      const { data: safeData, error: safeError } = await client.from("public_burial_records").select(PUBLIC_BASE_COLUMNS).eq("lot_code", plot).maybeSingle();
      if (!safeError && safeData) return toPublicRecord(safeData as PublicRow);
      return null;
    }
    if (localSupabaseConfig.environment === "hosted") return null;
  }

  const mock = getGravesiteByPlot(plot);
  return mock ? toFallbackRecord(mock) : null;
}

function toPublicRecord(row: PublicRow): PublicBurialRecord {
  const dates = [row.birth_date?.slice(0, 4), row.death_date?.slice(0, 4)].filter(Boolean).join(" – ") || "Dates not recorded";
  const section = row.area_name || row.sector_name || "Section not recorded";
  const rowLabel = row.block_number ? `Block ${row.block_number}` : "Location details not recorded";
  return {
    id: String(row.burial_id),
    name: row.display_name,
    birthDate: row.birth_date,
    deathDate: row.death_date,
    dates,
    plot: row.lot_code,
    plotLabel: `Plot ${row.lot_code}`,
    section,
    row: rowLabel,
    burialDate: row.death_date ? formatDate(row.death_date) : "Not recorded",
    status: "Active",
    location: parsePoint(row.location_geom),
    pixelLocation: row.px_loc_x !== null && row.px_loc_y !== null ? { x: row.px_loc_x, y: row.px_loc_y } : null,
    locationVerified: row.location_verified,
    tone: "result-media--lawn",
  };
}

function parsePoint(value: unknown) {
  if (!value || typeof value !== "object" || !("coordinates" in value)) return null;
  const coordinates = (value as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2 || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") return null;
  return { longitude: coordinates[0], latitude: coordinates[1] };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function getMockFallbackRecords() {
  return gravesites;
}

function toFallbackRecord(record: (typeof gravesites)[number]): PublicBurialRecord {
  return { ...record, birthDate: null, deathDate: null, status: "Active", location: null, pixelLocation: null, locationVerified: true };
}
