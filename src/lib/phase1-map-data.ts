import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  Point,
  Polygon,
  Position,
} from "geojson";
import { schematicImageHeight, schematicImageWidth } from "@/lib/map-layout";
import { getBrowserSupabase } from "@/lib/supabase/config";

export const phaseOneGeoJsonUrl = "/maps/forest-lake-phase1-routing-network.geojson";

export type PhaseOneMapProperties = {
  id?: string;
  feature_type?: "site" | "area" | "map_node" | "map_edge";
  name?: string;
  area_code?: string;
  node_type?: string;
  edge_type?: "road" | "path";
  is_restricted?: boolean;
  source_name?: string;
  from_node_id?: string;
  to_node_id?: string;
  phase?: number;
  [key: string]: unknown;
};

export type PhaseOneFeature = Feature<Geometry, PhaseOneMapProperties>;
export type PhaseOneFeatureCollection = FeatureCollection<Geometry, PhaseOneMapProperties>;
export type PhaseOneAreaFeature = Feature<Polygon, PhaseOneMapProperties>;
export type PhaseOneEdgeFeature = Feature<LineString, PhaseOneMapProperties>;
export type PhaseOneNodeFeature = Feature<Point, PhaseOneMapProperties>;

export type PhaseOneMapData = {
  site: PhaseOneFeature | null;
  areas: FeatureCollection<Polygon, PhaseOneMapProperties>;
  edges: FeatureCollection<LineString, PhaseOneMapProperties>;
  nodes: Array<PhaseOneNodeFeature & { schematicPosition: [number, number] }>;
  geographicBounds: GeographicBounds;
  sourceNodeCount: number;
  generatedNodeCount: number;
  warnings: string[];
};

export type GeographicBounds = { minLongitude: number; maxLongitude: number; minLatitude: number; maxLatitude: number };

export const phaseOneAreaCodes = ["DPG", "HPG", "RPG", "YPG"] as const;

export function projectPhaseOneMapData(collection: PhaseOneFeatureCollection): PhaseOneMapData {
  const bounds = getBounds(collection.features);
  const areas: PhaseOneAreaFeature[] = [];
  const edges: PhaseOneEdgeFeature[] = [];
  const nodes: Array<PhaseOneNodeFeature & { schematicPosition: [number, number] }> = [];
  let site: PhaseOneFeature | null = null;

  collection.features.forEach((feature) => {
    const projected = projectFeature(feature, bounds);
    if (projected.properties?.feature_type === "site") site = projected;
    if (projected.properties?.feature_type === "area" && projected.geometry.type === "Polygon") areas.push(projected as PhaseOneAreaFeature);
    if (projected.properties?.feature_type === "map_edge" && projected.geometry.type === "LineString") edges.push(projected as PhaseOneEdgeFeature);
    if (projected.properties?.feature_type === "map_node" && projected.geometry.type === "Point") {
      const [x, y] = projected.geometry.coordinates;
      nodes.push({ ...projected, geometry: projected.geometry as Point, schematicPosition: [y, x] } as PhaseOneNodeFeature & { schematicPosition: [number, number] });
    }
  });

  return {
    site,
    areas: { type: "FeatureCollection", features: areas },
    edges: { type: "FeatureCollection", features: edges },
    nodes: nodes,
    geographicBounds: bounds,
    sourceNodeCount: nodes.filter((node) => node.properties?.node_type !== "edge_endpoint" && node.properties?.node_type !== "junction").length,
    generatedNodeCount: nodes.filter((node) => node.properties?.node_type === "edge_endpoint" || node.properties?.node_type === "junction").length,
    warnings: [],
  };
}

export function projectPhaseOneLocation(mapData: PhaseOneMapData, location: { longitude: number; latitude: number }): [number, number] | null {
  const { minLongitude, maxLongitude, minLatitude, maxLatitude } = mapData.geographicBounds;
  if (location.longitude < minLongitude || location.longitude > maxLongitude || location.latitude < minLatitude || location.latitude > maxLatitude) return null;
  const x = ((location.longitude - minLongitude) / (maxLongitude - minLongitude)) * schematicImageWidth;
  const y = ((location.latitude - minLatitude) / (maxLatitude - minLatitude)) * schematicImageHeight;
  return [y, x];
}

export async function loadPhaseOneMapData(signal?: AbortSignal): Promise<PhaseOneMapData> {
  const response = await fetch(phaseOneGeoJsonUrl, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Phase 1 map data could not be loaded.");
  const collection = await response.json() as PhaseOneFeatureCollection;
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) throw new Error("Phase 1 map data is not a valid feature collection.");
  return projectPhaseOneMapData(collection);
}

export async function loadPhaseOneMapDataFromSupabase(): Promise<PhaseOneMapData> {
  const client = getBrowserSupabase();
  if (!client) throw new Error("Supabase is not configured.");

  const [{ data: sites, error: siteError }, { data: areas, error: areaError }, { data: nodes, error: nodeError }, { data: edges, error: edgeError }] = await Promise.all([
    client.from("site").select("site_id,site_name,boundary_geom").order("site_id"),
    client.from("area").select("area_id,site_id,area_code,area_name,area_category,boundary_geom").eq("area_category", "garden").in("area_code", [...phaseOneAreaCodes]),
    client.from("map_node").select("node_id,site_id,node_name,node_type,px_loc_x,px_loc_y,location_geom").order("node_id"),
    client.from("map_edge").select("edge_id,from_node_id,to_node_id,path_geom,distance_m,edge_type,is_restricted").order("edge_id"),
  ]);
  if (siteError) throw siteError;
  if (areaError) throw areaError;
  if (nodeError) throw nodeError;
  if (edgeError) throw edgeError;

  const site = sites?.find((candidate) => /forest lake memorial park/i.test(candidate.site_name)) || sites?.[0];
  if (!site) throw new Error("The configured cemetery site could not be found.");
  const siteId = site?.site_id;
  const features: PhaseOneFeature[] = [];
  const warnings: string[] = [];
  const siteGeometry = parseGeometry(site?.boundary_geom, "Polygon");
  if (site && siteGeometry?.type === "Polygon") features.push({ type: "Feature", id: String(site.site_id), properties: { id: String(site.site_id), feature_type: "site", name: site.site_name }, geometry: siteGeometry });

  for (const area of areas || []) {
    if (siteId !== undefined && area.site_id !== siteId) continue;
    const geometry = parseGeometry(area.boundary_geom, "Polygon");
    if (geometry?.type !== "Polygon") { warnings.push(`Area ${area.area_code || area.area_id} has no valid boundary.`); continue; }
    features.push({ type: "Feature", id: String(area.area_id), properties: { id: String(area.area_id), feature_type: "area", name: area.area_name, area_code: area.area_code }, geometry });
  }

  const includedNodeIds = new Set<number>();
  for (const node of nodes || []) {
    if (siteId !== undefined && node.site_id !== siteId) continue;
    const geometry = parseGeometry(node.location_geom, "Point");
    if (geometry?.type !== "Point") { warnings.push(`Node ${node.node_id} has no valid location.`); continue; }
    includedNodeIds.add(node.node_id);
    features.push({ type: "Feature", id: String(node.node_id), properties: { id: String(node.node_id), feature_type: "map_node", name: node.node_name, node_type: node.node_type }, geometry });
  }

  for (const edge of edges || []) {
    if (!includedNodeIds.has(edge.from_node_id) || !includedNodeIds.has(edge.to_node_id)) continue;
    const geometry = parseGeometry(edge.path_geom, "LineString");
    if (geometry?.type !== "LineString") { warnings.push(`Edge ${edge.edge_id} has no valid path.`); continue; }
    features.push({ type: "Feature", id: String(edge.edge_id), properties: { id: String(edge.edge_id), feature_type: "map_edge", edge_type: edge.edge_type === "road" || edge.edge_type === "entrance" ? "road" : "path", from_node_id: String(edge.from_node_id), to_node_id: String(edge.to_node_id), distance_m: edge.distance_m, is_restricted: Boolean(edge.is_restricted) }, geometry });
  }

  if (!features.some((feature) => feature.properties?.feature_type === "area") || !features.some((feature) => feature.properties?.feature_type === "map_edge")) throw new Error("The Supabase map network is not populated yet.");
  const projected = projectPhaseOneMapData({ type: "FeatureCollection", features });
  return { ...projected, warnings };
}

function projectFeature(feature: PhaseOneFeature, bounds: GeographicBounds): PhaseOneFeature {
  return { ...feature, geometry: projectGeometry(feature.geometry, bounds) };
}

function projectGeometry(geometry: Geometry, bounds: GeographicBounds): Geometry {
  switch (geometry.type) {
    case "Point": return { ...geometry, coordinates: projectPosition(geometry.coordinates, bounds) };
    case "MultiPoint": return { ...geometry, coordinates: geometry.coordinates.map((position) => projectPosition(position, bounds)) };
    case "LineString": return { ...geometry, coordinates: geometry.coordinates.map((position) => projectPosition(position, bounds)) };
    case "MultiLineString": return { ...geometry, coordinates: geometry.coordinates.map((line) => line.map((position) => projectPosition(position, bounds))) };
    case "Polygon": return { ...geometry, coordinates: geometry.coordinates.map((ring) => ring.map((position) => projectPosition(position, bounds))) };
    case "MultiPolygon": return { ...geometry, coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => ring.map((position) => projectPosition(position, bounds)))) };
    case "GeometryCollection": return { ...geometry, geometries: geometry.geometries.map((child) => projectGeometry(child, bounds)) };
  }
}

function projectPosition(position: Position, bounds: GeographicBounds): Position {
  const [longitude, latitude] = position;
  const x = ((longitude - bounds.minLongitude) / (bounds.maxLongitude - bounds.minLongitude)) * schematicImageWidth;
  const y = ((latitude - bounds.minLatitude) / (bounds.maxLatitude - bounds.minLatitude)) * schematicImageHeight;
  return [x, y];
}

function getBounds(features: PhaseOneFeature[]): GeographicBounds {
  const coordinates = features.flatMap((feature) => collectPositions(feature.geometry));
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  return { minLongitude, maxLongitude: maxLongitude === minLongitude ? minLongitude + 1 : maxLongitude, minLatitude, maxLatitude: maxLatitude === minLatitude ? minLatitude + 1 : maxLatitude };
}

function collectPositions(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case "Point": return [geometry.coordinates];
    case "MultiPoint": return geometry.coordinates;
    case "LineString": return geometry.coordinates;
    case "MultiLineString": return geometry.coordinates.flat();
    case "Polygon": return geometry.coordinates.flat();
    case "MultiPolygon": return geometry.coordinates.flat(2);
    case "GeometryCollection": return geometry.geometries.flatMap((child) => collectPositions(child));
  }
}

function parseGeometry(value: unknown, expectedType: "Point" | "LineString" | "Polygon"): Point | LineString | Polygon | null {
  if (!value) return null;
  if (typeof value === "object") {
    const candidate = value as { type?: unknown; coordinates?: unknown };
    if (candidate.type === expectedType && Array.isArray(candidate.coordinates)) return candidate as Point | LineString | Polygon;
  }
  if (typeof value !== "string") return null;
  const normalizedValue = value.replace(/^\s*SRID=\d+\s*;\s*/i, "");
  try {
    const parsed = JSON.parse(normalizedValue) as { type?: unknown; coordinates?: unknown };
    if (parsed.type === expectedType && Array.isArray(parsed.coordinates)) return parsed as Point | LineString | Polygon;
  } catch {
    // PostgREST may return a text geometry when the database output format is not GeoJSON.
  }
  const coordinateText = normalizedValue.replace(/^\s*[A-Z]+\s*\(/i, "").replace(/\)\s*$/, "");
  if (expectedType === "Point") {
    const point = coordinateText.trim().split(/\s+/).map(Number);
    return point.length >= 2 && point.every(Number.isFinite) ? { type: "Point", coordinates: [point[0], point[1]] } : null;
  }
  const groups = expectedType === "Polygon" ? coordinateText.replace(/^\(/, "").replace(/\)$/, "").split(/\)\s*,\s*\(/) : [coordinateText];
  const lines = groups.map((group) => group.replace(/[()]/g, "").split(",").map((pair) => pair.trim().split(/\s+/).map(Number).slice(0, 2)).filter((pair) => pair.length === 2 && pair.every(Number.isFinite)));
  if (!lines.length || lines.some((line) => !line.length)) return null;
  return expectedType === "LineString" ? { type: "LineString", coordinates: lines[0] } : { type: "Polygon", coordinates: lines };
}
