import { getPublicSupabase, localSupabaseConfig } from "./config";
import type { PublicBurialRecord } from "./types";
import { filterGravesites, getGravesiteById, getGravesiteByPlot, gravesites } from "@/lib/mock-data";
import { phaseOneGardenNames } from "@/lib/map-layout";

type PublicRow = {
  burial_id: number;
  display_name: string;
  birth_date: string | null;
  death_date: string | null;
  interment_date?: string | null;
  match_type?: "exact" | "matched" | "similar";
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

const PUBLIC_COLUMNS = "interment_date,burial_id,display_name,birth_date,death_date,record_status,lot_code,area_name,sector_name,block_number,location_geom,px_loc_x,px_loc_y,location_verified";

export class PublicDataUnavailableError extends Error {
  constructor() { super("Search is temporarily unavailable—try again."); }
}
export type PublicSearchFilters = { query?: string; section?: string; year?: string; sort?: "name" | "newest"; page?: number };
export async function searchPublicBurials(filters: PublicSearchFilters = {}) {
  const page = Number.isInteger(filters.page) ? Math.max(1, Math.min(filters.page || 1, 10000)) : 1;
  const pageSize = 20;
  const client = getPublicSupabase();
  if (client) {
    const { data, error } = await client.rpc("search_public_burials", {
      p_query: (filters.query || "").slice(0, 160), p_section: filters.section || "all",
      p_year: filters.year || "any", p_sort: filters.sort || "name", p_page: page, p_page_size: pageSize,
    });
    if (error || !data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.items) || typeof data.total !== "number") throw new PublicDataUnavailableError();
    return { items: (data.items as PublicRow[]).map(toPublicRecord), total: Number(data.total), page, pageSize };
  }
  if (!shouldUseMockData()) throw new PublicDataUnavailableError();
  const matches = filterGravesites(filters).map(toFallbackRecord);
  return { items: matches.slice((page - 1) * pageSize, page * pageSize), total: matches.length, page, pageSize };
}
export async function getPublicBurialRecords(filters: PublicSearchFilters = {}) {
  const client = getPublicSupabase();
  if (client) {
    const { data, error } = await client.from("public_burial_records").select(PUBLIC_COLUMNS).order("burial_id").limit(1000);
    if (error) throw new PublicDataUnavailableError();
    return (data || []).map((row) => toPublicRecord(row as PublicRow));
  }
  if (!shouldUseMockData()) throw new PublicDataUnavailableError();
  return filterGravesites(filters).map(toFallbackRecord);
}

export async function getPublicGardenNames() {
  const client = getPublicSupabase();
  if (client) {
    const { data, error } = await client.from("public_burial_records").select("area_name").not("area_name", "is", null).order("area_name").limit(100);
    if (!error) {
      const names = (data || []).map((row) => row.area_name).filter((name): name is string => typeof name === "string" && Boolean(name.trim()));
      if (names.length) return [...new Set([...phaseOneGardenNames, ...names])];
    }
    if (localSupabaseConfig.environment === "hosted") return [...phaseOneGardenNames];
  }
  return shouldUseMockData() ? [...new Set(gravesites.map((record) => record.section))] : [...phaseOneGardenNames];
}

export async function getPublicBurialRecord(id: string) {
  const client = getPublicSupabase();
  if (client) {
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) return null;
    const { data, error } = await client.from("public_burial_records").select(PUBLIC_COLUMNS).eq("burial_id", Number(id)).maybeSingle();
    if (error) throw new PublicDataUnavailableError();
    return data ? toPublicRecord(data as PublicRow) : null;
  }
  if (!shouldUseMockData()) throw new PublicDataUnavailableError();
  const mock = getGravesiteById(id);
  return mock ? toFallbackRecord(mock) : null;
}
export async function getPublicBurialRecordByPlot(plot: string) {
  if (!plot.trim()) return null;
  const client = getPublicSupabase();
  if (client) {
    const { data, error } = await client.from("public_burial_records").select(PUBLIC_COLUMNS).eq("lot_code", plot).limit(2);
    if (error) throw new PublicDataUnavailableError();
    return data?.length === 1 ? toPublicRecord(data[0] as PublicRow) : null;
  }
  if (!shouldUseMockData()) throw new PublicDataUnavailableError();
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
    matchType: row.match_type,
    burialDate: row.interment_date ? formatDate(row.interment_date) : "Not recorded",
    status: "Active",
    location: parsePoint(row.location_geom),
    pixelLocation: row.px_loc_x !== null && row.px_loc_y !== null ? { x: row.px_loc_x, y: row.px_loc_y } : null,
    locationVerified: row.location_verified,
    tone: "result-media--lawn",
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export function getMockFallbackRecords() {
  return gravesites;
}

function shouldUseMockData() {
  return process.env.NODE_ENV !== "production";
}

function toFallbackRecord(record: (typeof gravesites)[number]): PublicBurialRecord {
  return { ...record, birthDate: null, deathDate: null, status: "Active", location: null, pixelLocation: null, locationVerified: true };
}
