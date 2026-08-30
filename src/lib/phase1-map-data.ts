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

export const phaseOneGeoJsonUrl = "/maps/forest-lake-phase1-cleaned-network.geojson";

export type PhaseOneMapProperties = {
  id?: string;
  feature_type?: "site" | "area" | "map_node" | "map_edge";
  name?: string;
  area_code?: string;
  node_type?: string;
  edge_type?: "road" | "path";
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
};

export type GeographicBounds = { minLongitude: number; maxLongitude: number; minLatitude: number; maxLatitude: number };

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
