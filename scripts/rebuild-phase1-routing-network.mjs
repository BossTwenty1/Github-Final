import fs from "node:fs";
import path from "node:path";

const root = "C:/Users/Michael/gravenav/web";
const inputPath = path.join(root, "public", "maps", "forest-lake-phase1-cleaned-network.geojson");
const outputPath = path.join(root, "public", "maps", "forest-lake-phase1-routing-network.geojson");
const outputKmlPath = path.join(root, "public", "maps", "forest-lake-phase1-routing-network.kml");
const outputPreviewPath = path.join(root, "public", "maps", "forest-lake-phase1-routing-network-preview.svg");
const reportPath = path.join(root, "docs", "forest-lake-phase1-routing-network-review.md");

const SNAP_TOLERANCE_M = 6;
const NODE_DEDUPE_TOLERANCE_M = 0.75;
const INTERSECTION_TOLERANCE_M = 0.05;
const phaseOneAreas = new Set(["DPG", "HPG", "RPG", "YPG"]);

const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const features = source.features || [];
const site = features.find((feature) => feature.properties?.feature_type === "site");
const areas = features.filter((feature) => feature.properties?.feature_type === "area" && phaseOneAreas.has(feature.properties?.area_code));
const sourceNodes = features.filter((feature) => feature.properties?.feature_type === "map_node");
const sourceEdges = features.filter((feature) => feature.properties?.feature_type === "map_edge" && (feature.properties?.edge_type === "road" || feature.properties?.edge_type === "path"));

if (!sourceEdges.length) throw new Error("The current Phase 1 GeoJSON has no routing edges.");

const allCoordinates = features.flatMap((feature) => collectPositions(feature.geometry));
const center = allCoordinates.reduce((accumulator, [longitude, latitude]) => ({ longitude: accumulator.longitude + longitude, latitude: accumulator.latitude + latitude }), { longitude: 0, latitude: 0 });
center.longitude /= allCoordinates.length;
center.latitude /= allCoordinates.length;
const earthRadiusM = 6371008.8;
const latitudeRadians = center.latitude * Math.PI / 180;

const toXY = ([longitude, latitude]) => ({ x: (longitude - center.longitude) * Math.PI / 180 * earthRadiusM * Math.cos(latitudeRadians), y: (latitude - center.latitude) * Math.PI / 180 * earthRadiusM });
const fromXY = ({ x, y }) => [center.longitude + x / (earthRadiusM * Math.cos(latitudeRadians)) * 180 / Math.PI, center.latitude + y / earthRadiusM * 180 / Math.PI];
const add = (first, second) => ({ x: first.x + second.x, y: first.y + second.y });
const subtract = (first, second) => ({ x: first.x - second.x, y: first.y - second.y });
const scale = (point, factor) => ({ x: point.x * factor, y: point.y * factor });
const dot = (first, second) => first.x * second.x + first.y * second.y;
const cross = (first, second) => first.x * second.y - first.y * second.x;
const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);

function collectPositions(geometry) {
  if (!geometry) return [];
  switch (geometry.type) {
    case "Point": return [geometry.coordinates];
    case "LineString": return geometry.coordinates;
    case "Polygon": return geometry.coordinates.flat();
    case "MultiPoint": return geometry.coordinates;
    case "MultiLineString": return geometry.coordinates.flat();
    case "MultiPolygon": return geometry.coordinates.flat(2);
    case "GeometryCollection": return geometry.geometries.flatMap((child) => collectPositions(child));
    default: return [];
  }
}

function areaFromSourceName(value) {
  const parts = String(value || "").split("|");
  return phaseOneAreas.has(parts.at(-1)) ? parts.at(-1) : parts.find((part) => phaseOneAreas.has(part)) || "";
}

function makeLine(feature, index) {
  const coordinates = feature.geometry.coordinates.map((coordinate) => ({ coordinate, xy: toXY(coordinate) }));
  const segments = [];
  let totalLength = 0;
  for (let segmentIndex = 0; segmentIndex < coordinates.length - 1; segmentIndex += 1) {
    const length = distance(coordinates[segmentIndex].xy, coordinates[segmentIndex + 1].xy);
    segments.push({ segmentIndex, start: coordinates[segmentIndex], end: coordinates[segmentIndex + 1], startDistance: totalLength, length });
    totalLength += length;
  }
  return {
    id: String(feature.properties.id || `E${String(index + 1).padStart(3, "0")}`),
    edgeType: feature.properties.edge_type,
    sourceName: feature.properties.source_name || feature.properties.name || `Source edge ${index + 1}`,
    sourceFeature: feature,
    coordinates,
    segments,
    length: totalLength,
    areaCode: areaFromSourceName(feature.properties.source_name),
    splitPoints: [],
  };
}

const lines = sourceEdges.map(makeLine);
const lineSegments = lines.flatMap((line) => line.segments.map((segment) => ({ line, ...segment })));

function addSplit(line, segmentIndex, t, xy, kind) {
  const segment = line.segments[segmentIndex];
  const clampedT = Math.max(0, Math.min(1, t));
  const atDistance = segment.startDistance + segment.length * clampedT;
  const coordinate = fromXY(xy);
  if (line.splitPoints.some((point) => Math.abs(point.atDistance - atDistance) <= INTERSECTION_TOLERANCE_M)) return;
  line.splitPoints.push({ atDistance, xy, coordinate, kind });
}

for (const line of lines) {
  addSplit(line, 0, 0, line.segments[0].start.xy, "line_endpoint");
  const finalSegment = line.segments.at(-1);
  addSplit(line, finalSegment.segmentIndex, 1, finalSegment.end.xy, "line_endpoint");
  for (const vertex of line.coordinates.slice(1, -1)) {
    const segment = line.segments.find((candidate) => candidate.end === vertex);
    if (segment) addSplit(line, segment.segmentIndex, 1, vertex.xy, "source_vertex");
  }
}

function segmentIntersection(first, second) {
  const r = subtract(first.end.xy, first.start.xy);
  const s = subtract(second.end.xy, second.start.xy);
  const denominator = cross(r, s);
  if (Math.abs(denominator) < 1e-10) return null;
  const delta = subtract(second.start.xy, first.start.xy);
  const t = cross(delta, s) / denominator;
  const u = cross(delta, r) / denominator;
  if (t < -1e-8 || t > 1 + 1e-8 || u < -1e-8 || u > 1 + 1e-8) return null;
  return { xy: add(first.start.xy, scale(r, t)), firstT: t, secondT: u };
}

for (let firstIndex = 0; firstIndex < lineSegments.length; firstIndex += 1) {
  for (let secondIndex = firstIndex + 1; secondIndex < lineSegments.length; secondIndex += 1) {
    const first = lineSegments[firstIndex];
    const second = lineSegments[secondIndex];
    if (first.line === second.line) continue;
    const intersection = segmentIntersection(first, second);
    if (!intersection) continue;
    addSplit(first.line, first.segmentIndex, intersection.firstT, intersection.xy, "exact_intersection");
    addSplit(second.line, second.segmentIndex, intersection.secondT, intersection.xy, "exact_intersection");
  }
}

function nearestOnSegment(point, segment) {
  const vector = subtract(segment.end.xy, segment.start.xy);
  const lengthSquared = dot(vector, vector);
  const t = lengthSquared ? Math.max(0, Math.min(1, dot(subtract(point, segment.start.xy), vector) / lengthSquared)) : 0;
  const projected = add(segment.start.xy, scale(vector, t));
  return { distance: distance(point, projected), xy: projected, t };
}

function canInferConnection(sourceLine, targetLine) {
  if (sourceLine === targetLine) return false;
  if (sourceLine.edgeType === "path" && targetLine.edgeType === "path") return sourceLine.areaCode && sourceLine.areaCode === targetLine.areaCode;
  return true;
}

const inferredConnections = [];
for (const sourceLine of lines) {
  const endpoints = [sourceLine.segments[0].start, sourceLine.segments.at(-1).end];
  for (const endpoint of endpoints) {
    let best = null;
    for (const targetLine of lines) {
      if (!canInferConnection(sourceLine, targetLine)) continue;
      for (const targetSegment of targetLine.segments) {
        const candidate = nearestOnSegment(endpoint.xy, targetSegment);
        if (!best || candidate.distance < best.distance) best = { sourceLine, endpoint, targetLine, targetSegment, ...candidate };
      }
    }
    if (!best || best.distance <= INTERSECTION_TOLERANCE_M || best.distance > SNAP_TOLERANCE_M) continue;
    const duplicate = inferredConnections.some((connection) => connection.sourceLine === sourceLine && connection.endpoint === endpoint && connection.targetLine === best.targetLine && distance(connection.xy, best.xy) < 0.1);
    if (duplicate) continue;
    addSplit(best.targetLine, best.targetSegment.segmentIndex, best.t, best.xy, "inferred_connection");
    inferredConnections.push({ sourceLine, endpoint, targetLine: best.targetLine, xy: best.xy, distance: best.distance });
  }
}

const existingNodes = sourceNodes.map((feature) => ({
  id: String(feature.properties.id || feature.id || ""),
  name: feature.properties.name || "Network point",
  nodeType: feature.properties.node_type || "",
  sourceNames: Array.isArray(feature.properties.source_names) ? feature.properties.source_names : [],
  coordinate: feature.geometry.coordinates,
  xy: toXY(feature.geometry.coordinates),
})).filter((node) => node.id);
const nodes = existingNodes.map((node) => ({ ...node, used: false }));
let nextNodeNumber = Math.max(0, ...nodes.map((node) => Number(node.id.replace(/^N/, "")) || 0)) + 1;

function nodeForPoint(point, kind, label) {
  const existing = nodes.find((node) => distance(node.xy, point.xy) <= NODE_DEDUPE_TOLERANCE_M);
  if (existing) {
    existing.used = true;
    if (kind === "exact_intersection" || kind === "inferred_junction") {
      existing.nodeType = "junction";
      existing.name = label || (kind === "inferred_junction" ? "Reviewed near-endpoint junction" : existing.name);
    }
    return existing;
  }
  const node = {
    id: `N${String(nextNodeNumber++).padStart(3, "0")}`,
    name: label || "Derived routing point",
    nodeType: kind === "exact_intersection" || kind === "inferred_junction" ? "junction" : "edge_endpoint",
    sourceNames: [],
    coordinate: point.coordinate,
    xy: point.xy,
    used: true,
  };
  nodes.push(node);
  return node;
}

function lineCoordinatesBetween(line, firstPoint, secondPoint) {
  const coordinates = [firstPoint.coordinate];
  for (const vertex of line.coordinates) {
    const vertexDistance = line.segments.reduce((found, segment) => segment.end === vertex ? segment.startDistance + segment.length : found, null);
    if (vertexDistance !== null && vertexDistance > firstPoint.atDistance + INTERSECTION_TOLERANCE_M && vertexDistance < secondPoint.atDistance - INTERSECTION_TOLERANCE_M) coordinates.push(vertex.coordinate);
  }
  coordinates.push(secondPoint.coordinate);
  return coordinates.filter((coordinate, index) => index === 0 || coordinate[0] !== coordinates[index - 1][0] || coordinate[1] !== coordinates[index - 1][1]);
}

const rebuiltEdges = [];
let edgeNumber = 1;
for (const line of lines) {
  const points = [...line.splitPoints].sort((first, second) => first.atDistance - second.atDistance);
  for (let index = 0; index < points.length - 1; index += 1) {
    const first = points[index];
    const second = points[index + 1];
    const fromNode = nodeForPoint(first, first.kind, first.kind === "exact_intersection" ? `Junction ${line.id}` : undefined);
    const toNode = nodeForPoint(second, second.kind, second.kind === "exact_intersection" ? `Junction ${line.id}` : undefined);
    if (fromNode.id === toNode.id) continue;
    const segmentCoordinates = lineCoordinatesBetween(line, first, second);
    rebuiltEdges.push({
      type: "Feature",
      properties: {
        id: `E${String(edgeNumber++).padStart(3, "0")}`,
        feature_type: "map_edge",
        edge_type: line.edgeType,
        source_name: line.sourceName,
        derived_segment_of: line.id,
        from_node_id: fromNode.id,
        to_node_id: toNode.id,
        phase: 1,
        is_restricted: Boolean(line.sourceFeature.properties?.is_restricted),
        distance_m: Number(segmentCoordinates.slice(1).reduce((total, coordinate, coordinateIndex) => total + distance(toXY(segmentCoordinates[coordinateIndex]), toXY(coordinate)), 0).toFixed(2)),
        connection_status: first.kind === "exact_intersection" || second.kind === "exact_intersection" ? "confirmed_geometry" : "source_geometry",
      },
      geometry: { type: "LineString", coordinates: segmentCoordinates },
    });
  }
}

for (const connection of inferredConnections) {
  const sourcePoint = { coordinate: connection.endpoint.coordinate, xy: connection.endpoint.xy };
  const targetPoint = { coordinate: fromXY(connection.xy), xy: connection.xy };
  const fromNode = nodeForPoint(sourcePoint, "inferred_connection");
  const toNode = nodeForPoint(targetPoint, "inferred_junction", `Reviewed junction ${connection.targetLine.id}`);
  if (fromNode.id === toNode.id) continue;
  rebuiltEdges.push({
    type: "Feature",
    properties: {
      id: `E${String(edgeNumber++).padStart(3, "0")}`,
      feature_type: "map_edge",
      edge_type: "path",
      source_name: `DERIVED|${connection.sourceLine.id}|${connection.targetLine.id}|near-endpoint connection`,
      derived: true,
      derived_from: `${connection.sourceLine.id} -> ${connection.targetLine.id}`,
      from_node_id: fromNode.id,
      to_node_id: toNode.id,
      distance_m: Number(connection.distance.toFixed(2)),
      snap_distance_m: Number(connection.distance.toFixed(2)),
      connection_status: "inferred_near_endpoint_reviewed_from_supplied_geometry",
      phase: 1,
      is_restricted: false,
    },
    geometry: { type: "LineString", coordinates: [sourcePoint.coordinate, targetPoint.coordinate] },
  });
}

const nodeFeatures = nodes.map((node) => ({
  type: "Feature",
  properties: { id: node.id, feature_type: "map_node", node_type: node.nodeType, name: node.name, source_names: node.sourceNames, phase: 1 },
  geometry: { type: "Point", coordinates: node.coordinate },
}));
const outputFeatures = [
  ...(site ? [{ ...site, properties: { ...site.properties, phase: 1 } }] : []),
  ...areas.map((area) => ({ ...area, properties: { ...area.properties, phase: 1 } })),
  ...nodeFeatures,
  ...rebuiltEdges,
];
fs.writeFileSync(outputPath, `${JSON.stringify({ type: "FeatureCollection", name: "Forest Lake Memorial Park Phase 1 verified routing review network", features: outputFeatures }, null, 2)}\n`);

function xmlEscape(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function kmlGeometry(geometry) {
  const coordinateText = (coordinates) => coordinates.map(([longitude, latitude]) => `${longitude},${latitude},0`).join(" ");
  if (geometry.type === "Point") return `<Point><coordinates>${coordinateText([geometry.coordinates])}</coordinates></Point>`;
  if (geometry.type === "Polygon") return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinateText(geometry.coordinates[0])}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
  return `<LineString><tessellate>1</tessellate><coordinates>${coordinateText(geometry.coordinates)}</coordinates></LineString>`;
}
function kmlPlacemark(feature) {
  const properties = feature.properties || {};
  const label = properties.feature_type === "area" ? `AREA|FL-LEG|${properties.area_code}|${properties.name}` : properties.feature_type === "map_node" ? `NODE|FL-LEG|${properties.id}|${properties.node_type}|${properties.name}` : `${properties.edge_type === "road" ? "ROAD" : "PATH"}|FL-LEG|${properties.id}|${properties.source_name || properties.name || "routing segment"}`;
  const data = Object.entries(properties).map(([key, value]) => `<Data name="${xmlEscape(key)}"><value>${xmlEscape(Array.isArray(value) ? value.join("; ") : value)}</value></Data>`).join("");
  return `<Placemark><name>${xmlEscape(label)}</name><ExtendedData>${data}</ExtendedData>${kmlGeometry(feature.geometry)}</Placemark>`;
}
const kmlFolder = (name, items) => `<Folder><name>${name}</name>${items.map(kmlPlacemark).join("")}</Folder>`;
fs.writeFileSync(outputKmlPath, `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Forest Lake Phase 1 routing review network</name>${kmlFolder("01_GARDENS", areas)}${kmlFolder("04_ROADS", rebuiltEdges.filter((edge) => edge.properties.edge_type === "road"))}${kmlFolder("05_WALKWAYS", rebuiltEdges.filter((edge) => edge.properties.edge_type === "path"))}${kmlFolder("06_NODES", nodeFeatures)}</Document></kml>\n`);

const bounds = collectPositions({ type: "GeometryCollection", geometries: outputFeatures.map((feature) => feature.geometry) }).reduce((result, [longitude, latitude]) => ({ minLongitude: Math.min(result.minLongitude, longitude), maxLongitude: Math.max(result.maxLongitude, longitude), minLatitude: Math.min(result.minLatitude, latitude), maxLatitude: Math.max(result.maxLatitude, latitude) }), { minLongitude: Infinity, maxLongitude: -Infinity, minLatitude: Infinity, maxLatitude: -Infinity });
const svgWidth = 1400;
const svgHeight = 930;
const margin = 60;
const scaleX = (svgWidth - margin * 2) / (bounds.maxLongitude - bounds.minLongitude);
const scaleY = (svgHeight - margin * 2) / (bounds.maxLatitude - bounds.minLatitude);
const svgScale = Math.min(scaleX, scaleY);
const project = ([longitude, latitude]) => [margin + (longitude - bounds.minLongitude) * svgScale, svgHeight - margin - (latitude - bounds.minLatitude) * svgScale];
const pathData = (coordinates, close = false) => `${coordinates.map((coordinate, index) => { const [x, y] = project(coordinate); return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ")}${close ? " Z" : ""}`;
const gardenColors = { DPG: "#e6d7ef", HPG: "#d6edd1", RPG: "#d5e7f3", YPG: "#f2edc8" };
const gardenSvg = areas.map((area) => `<path d="${pathData(area.geometry.coordinates[0], true)}" fill="${gardenColors[area.properties.area_code] || "#edf2ed"}" stroke="#397052" stroke-width="2"/><text x="${project(area.geometry.coordinates[0][Math.floor(area.geometry.coordinates[0].length / 2)])[0].toFixed(1)}" y="${(project(area.geometry.coordinates[0][Math.floor(area.geometry.coordinates[0].length / 2)])[1] - 8).toFixed(1)}" class="garden-label">${xmlEscape(area.properties.name)}</text>`).join("");
const roadSvg = rebuiltEdges.filter((edge) => edge.properties.edge_type === "road").map((edge) => `<path d="${pathData(edge.geometry.coordinates)}" class="road"/>`).join("");
const walkwaySvg = rebuiltEdges.filter((edge) => edge.properties.edge_type === "path").map((edge) => `<path d="${pathData(edge.geometry.coordinates)}" class="walkway ${edge.properties.derived ? "derived-connection" : ""}"/>`).join("");
const nodeSvg = nodeFeatures.filter((node) => node.properties.node_type === "junction" || node.properties.node_type === "entrance").map((node) => { const [x, y] = project(node.geometry.coordinates); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" class="junction"/><text x="${(x + 10).toFixed(1)}" y="${(y - 10).toFixed(1)}" class="node-label">${xmlEscape(node.properties.name)}</text>`; }).join("");
const summary = `<text x="60" y="35" class="title">Forest Lake Phase 1 routing review</text><text x="60" y="58" class="subtitle">Roads, walkways, junctions, and derived near-endpoint connections</text><g transform="translate(60 850)"><line x1="0" y1="0" x2="50" y2="0" class="road"/><text x="65" y="6" class="legend">Roadway</text><line x1="180" y1="0" x2="230" y2="0" class="walkway"/><text x="245" y="6" class="legend">Walkway</text><line x1="370" y1="0" x2="420" y2="0" class="walkway derived-connection"/><text x="435" y="6" class="legend">Derived connection to review</text><circle cx="690" cy="0" r="6" class="junction"/><text x="705" y="6" class="legend">Junction / entrance</text></g>`;
fs.writeFileSync(outputPreviewPath, `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" role="img" aria-labelledby="title desc"><title id="title">Forest Lake Phase 1 routing review</title><desc id="desc">Phase 1 garden polygons, roadways, walkways, junctions, and derived near-endpoint connections.</desc><style>.road{fill:none;stroke:#4e5a60;stroke-width:12;stroke-linecap:round;stroke-linejoin:round}.walkway{fill:none;stroke:#b97843;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.derived-connection{stroke:#b45309;stroke-dasharray:8 6}.garden-label{font:600 18px Arial,sans-serif;fill:#164f32;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:5px}.node-label{font:600 13px Arial,sans-serif;fill:#174c32;paint-order:stroke;stroke:#fff;stroke-width:4px}.junction{fill:#0b6b3a;stroke:#fff;stroke-width:2}.title{font:700 24px Arial,sans-serif;fill:#20352a}.subtitle,.legend{font:14px Arial,sans-serif;fill:#355247}</style><rect width="100%" height="100%" fill="#edf4ef"/>${gardenSvg}${roadSvg}${walkwaySvg}${nodeSvg}${summary}</svg>\n`);

const adjacency = new Map(nodes.map((node) => [node.id, new Set()]));
for (const edge of rebuiltEdges) {
  adjacency.get(edge.properties.from_node_id)?.add(edge.properties.to_node_id);
  adjacency.get(edge.properties.to_node_id)?.add(edge.properties.from_node_id);
}
const components = [];
const seen = new Set();
for (const node of nodes.filter((candidate) => adjacency.get(candidate.id)?.size)) {
  if (seen.has(node.id)) continue;
  const queue = [node.id];
  const component = [];
  seen.add(node.id);
  while (queue.length) {
    const current = queue.shift();
    component.push(current);
    for (const neighbor of adjacency.get(current) || []) if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
  }
  components.push(component);
}
const entrance = nodes.find((node) => node.nodeType === "entrance" && adjacency.get(node.id)?.size) || nodes.find((node) => /main entrance/i.test(node.name) && adjacency.get(node.id)?.size);
const reachable = new Set();
if (entrance) {
  const queue = [entrance.id];
  reachable.add(entrance.id);
  while (queue.length) for (const neighbor of adjacency.get(queue.shift()) || []) if (!reachable.has(neighbor)) { reachable.add(neighbor); queue.push(neighbor); }
}
const areaReachability = areas.map((area) => {
  const ring = area.geometry.coordinates[0];
  const centroid = ring.reduce((accumulator, [longitude, latitude]) => ({ longitude: accumulator.longitude + longitude, latitude: accumulator.latitude + latitude }), { longitude: 0, latitude: 0 });
  centroid.longitude /= ring.length;
  centroid.latitude /= ring.length;
  const nearest = nodes.filter((node) => adjacency.get(node.id)?.size).reduce((closest, node) => !closest || distance(node.xy, toXY([centroid.longitude, centroid.latitude])) < distance(closest.xy, toXY([centroid.longitude, centroid.latitude])) ? node : closest, null);
  return { code: area.properties.area_code, reachable: Boolean(nearest && reachable.has(nearest.id)), nearestNode: nearest?.id || null };
});
const derivedConnections = rebuiltEdges.filter((edge) => edge.properties.derived);
const report = `# Forest Lake Phase 1 routing network review\n\nGenerated from the current project GeoJSON. The source geometry was preserved; the output splits lines at exact intersections and adds only near-endpoint connections within ${SNAP_TOLERANCE_M} m.\n\n## Output\n\n- Phase 1 gardens: ${areas.length}\n- Roadway segments: ${rebuiltEdges.filter((edge) => edge.properties.edge_type === "road").length}\n- Walkway segments: ${rebuiltEdges.filter((edge) => edge.properties.edge_type === "path" && !edge.properties.derived).length}\n- Derived near-endpoint connections: ${derivedConnections.length}\n- Routing nodes: ${nodes.filter((node) => adjacency.get(node.id)?.size).length}\n- Junction nodes: ${nodes.filter((node) => node.nodeType === "junction").length}\n- Connected routing components: ${components.length}\n- Isolated routing nodes: ${nodes.filter((node) => !adjacency.get(node.id)?.size).length}\n- Entrance found: ${entrance ? "yes" : "no"}\n\n## Garden reachability from the entrance\n\n${areaReachability.map((area) => `- ${area.code}: ${area.reachable ? "reachable" : "not reachable"}${area.nearestNode ? ` via ${area.nearestNode}` : ""}`).join("\n")}\n\n## Review-required connections\n\nThe ${derivedConnections.length} dashed connections are inferred from nearby endpoints and are retained in the network so the graph can be reviewed. They are not grave-to-path connectors and are not survey confirmation.\n\n${derivedConnections.map((edge) => `- ${edge.properties.derived_from}: ${edge.properties.snap_distance_m} m`).join("\n") || "- None."}\n\nThe final grave connection remains pending until verified grave coordinates and the actual access point for each grave are collected.\n\n## Review files\n\n- GeoJSON: /maps/forest-lake-phase1-routing-network.geojson\n- KML: /maps/forest-lake-phase1-routing-network.kml\n- Preview: /maps/forest-lake-phase1-routing-network-preview.svg\n`;
fs.writeFileSync(reportPath, report);

console.log(JSON.stringify({ gardens: areas.length, roadwaySegments: rebuiltEdges.filter((edge) => edge.properties.edge_type === "road").length, walkwaySegments: rebuiltEdges.filter((edge) => edge.properties.edge_type === "path" && !edge.properties.derived).length, derivedConnections: derivedConnections.length, routingNodes: nodes.filter((node) => adjacency.get(node.id)?.size).length, junctions: nodes.filter((node) => node.nodeType === "junction").length, connectedComponents: components.length, isolatedRoutingNodes: nodes.filter((node) => !adjacency.get(node.id)?.size).length, entrance: Boolean(entrance), areaReachability }, null, 2));
