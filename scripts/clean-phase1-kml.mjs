import fs from "node:fs";
import path from "node:path";

const inputPath = "C:/Users/Michael/Downloads/FL KML file.kml";
const root = "C:/Users/Michael/gravenav/web";
const publicMaps = path.join(root, "public", "maps");
const docs = path.join(root, "docs");
const phaseOneAreas = new Set(["HPG", "RPG", "YPG", "DPG"]);
const nodeMatchToleranceM = 2;
const reportGapToleranceM = 5;

fs.mkdirSync(publicMaps, { recursive: true });
fs.mkdirSync(docs, { recursive: true });
const xml = fs.readFileSync(inputPath, "utf8");
const decode = (value) => value.replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
const tag = (body, name) => { const match = body.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i")); return match ? decode(match[1].trim()) : ""; };
const parseCoordinates = (body) => tag(body, "coordinates").split(/\s+/).filter(Boolean).map((value) => { const [lon, lat] = value.split(",").map(Number); return { lon, lat }; }).filter((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat));
const source = [...xml.matchAll(/<Placemark\b[\s\S]*?<\/Placemark>/gi)].map((match, index) => { const body = match[0]; const name = tag(body, "name") || `Unnamed ${index + 1}`; const type = body.match(/<Point\b/i) ? "Point" : body.match(/<LineString\b/i) ? "LineString" : body.match(/<Polygon\b/i) ? "Polygon" : "Other"; return { sourceIndex: index + 1, name, type, points: parseCoordinates(body) }; }).filter((item) => item.points.length);
const pipe = (name) => name.split("|").map((part) => part.trim());
const areaCode = (item) => pipe(item.name)[2] || "";
const selected = source.filter((item) => item.type === "Polygon" ? item.name === "Forest Lake" || (item.name.startsWith("AREA|") && phaseOneAreas.has(areaCode(item))) : item.type === "LineString" ? item.name.startsWith("ROADWAY|") || item.name.startsWith("PATH|") : item.type === "Point" && item.name.startsWith("NODE|"));
const site = selected.find((item) => item.type === "Polygon" && item.name === "Forest Lake");
const areas = selected.filter((item) => item.type === "Polygon" && item.name.startsWith("AREA|"));
const lines = selected.filter((item) => item.type === "LineString");
const sourceNodes = selected.filter((item) => item.type === "Point");
const isRoad = (item) => item.name.startsWith("ROADWAY|");
const isPath = (item) => item.name.startsWith("PATH|");
const displayName = (item) => { const name = item.name.includes("|") ? item.name.split("|").at(-1) : item.name; return name === "YellowPalm Garden" ? "Yellow Palm Garden" : name; };

const allPoints = selected.flatMap((item) => item.points);
const centerLon = allPoints.reduce((sum, point) => sum + point.lon, 0) / allPoints.length;
const centerLat = allPoints.reduce((sum, point) => sum + point.lat, 0) / allPoints.length;
const earthRadiusM = 6371008.8;
const toXY = (point) => ({ x: (point.lon - centerLon) * Math.PI / 180 * earthRadiusM * Math.cos(centerLat * Math.PI / 180), y: (point.lat - centerLat) * Math.PI / 180 * earthRadiusM });
const fromXY = (point) => ({ lon: centerLon + point.x / (earthRadiusM * Math.cos(centerLat * Math.PI / 180)) * 180 / Math.PI, lat: centerLat + point.y / earthRadiusM * 180 / Math.PI });
const distanceM = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a, value) => ({ x: a.x * value, y: a.y * value });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const segmentIntersection = (a, b) => { const r = subtract(a.b, a.a); const s = subtract(b.b, b.a); const denominator = cross(r, s); if (Math.abs(denominator) < 1e-9) return null; const delta = subtract(b.a, a.a); const t = cross(delta, s) / denominator; const u = cross(delta, r) / denominator; if (t < -1e-8 || t > 1 + 1e-8 || u < -1e-8 || u > 1 + 1e-8) return null; return add(a.a, scale(r, t)); };
const nearestOnSegment = (point, a, b) => { const segment = subtract(b, a); const length = segment.x ** 2 + segment.y ** 2; const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * segment.x + (point.y - a.y) * segment.y) / length)) : 0; const projected = add(a, scale(segment, t)); return { point: projected, distance: distanceM(point, projected) }; };
const segments = lines.flatMap((line) => line.points.slice(1).map((point, index) => ({ a: toXY(line.points[index]), b: toXY(point), line })));
const intersections = [];
for (let first = 0; first < segments.length; first += 1) for (let second = first + 1; second < segments.length; second += 1) { if (segments[first].line.sourceIndex === segments[second].line.sourceIndex) continue; const point = segmentIntersection(segments[first], segments[second]); if (point && !intersections.some((item) => distanceM(item.xy, point) <= nodeMatchToleranceM)) intersections.push({ xy: point, sources: [segments[first].line.name, segments[second].line.name] }); }

const nodes = [];
let nodeNumber = 1;
const addNode = (xy, properties) => { const existing = nodes.find((node) => distanceM(node.xy, xy) <= nodeMatchToleranceM); if (existing) { existing.source_names = [...new Set([...existing.source_names, ...(properties.source_names || [])])]; return existing; } const node = { id: `N${String(nodeNumber++).padStart(3, "0")}`, xy, source_names: properties.source_names || [], name: properties.name, node_type: properties.node_type }; nodes.push(node); return node; };
for (const item of sourceNodes) { const parts = pipe(item.name); addNode(toXY(item.points[0]), { name: displayName(item), node_type: (parts[3] || "landmark").toLowerCase(), source_names: [item.name] }); }
for (const item of intersections) addNode(item.xy, { name: `Derived junction ${String(nodeNumber).padStart(3, "0")}`, node_type: "junction", source_names: item.sources });
for (const line of lines) for (const point of [line.points[0], line.points.at(-1)]) addNode(toXY(point), { name: "Derived edge endpoint", node_type: "edge_endpoint", source_names: [line.name] });

const findNode = (point) => addNode(toXY(point), { name: "Derived edge endpoint", node_type: "edge_endpoint", source_names: [] });
const edgeFeatures = lines.map((line, index) => { const from = findNode(line.points[0]); const to = findNode(line.points.at(-1)); return { type: "Feature", properties: { id: `E${String(index + 1).padStart(3, "0")}`, feature_type: "map_edge", edge_type: isRoad(line) ? "road" : "path", source_name: line.name, from_node_id: from.id, to_node_id: to.id, phase: 1 }, geometry: { type: "LineString", coordinates: line.points.map((point) => [point.lon, point.lat]) } }; });
const feature = (properties, geometry) => ({ type: "Feature", properties, geometry });
const features = [];
if (site) features.push(feature({ id: "SITE-FL-LEG", feature_type: "site", name: "Forest Lake Memorial Park", phase: 1 }, { type: "Polygon", coordinates: [site.points.map((point) => [point.lon, point.lat])] }));
for (const area of areas) features.push(feature({ id: `AREA-FL-LEG-${areaCode(area)}`, feature_type: "area", area_code: areaCode(area), name: displayName(area), phase: 1 }, { type: "Polygon", coordinates: [area.points.map((point) => [point.lon, point.lat])] }));
for (const node of nodes) { const point = fromXY(node.xy); features.push(feature({ id: node.id, feature_type: "map_node", node_type: node.node_type, name: node.name, source_names: node.source_names, phase: 1 }, { type: "Point", coordinates: [point.lon, point.lat] })); }
features.push(...edgeFeatures);
fs.writeFileSync(path.join(publicMaps, "forest-lake-phase1-cleaned-network.geojson"), `${JSON.stringify({ type: "FeatureCollection", name: "Forest Lake Memorial Park Phase 1 cleaned network", features }, null, 2)}\n`);

const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const coordText = (coords) => coords.map((point) => `${point[0]},${point[1]},0`).join(" ");
const kmlGeometry = (geometry) => geometry.type === "Point" ? `<Point><coordinates>${coordText([geometry.coordinates])}</coordinates></Point>` : geometry.type === "LineString" ? `<LineString><tessellate>1</tessellate><coordinates>${coordText(geometry.coordinates)}</coordinates></LineString>` : `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordText(geometry.coordinates[0])}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
const kmlFeature = (item) => { const p = item.properties; const label = p.feature_type === "site" ? "SITE|FL-LEG|BOUNDARY|Forest Lake Memorial Park" : p.feature_type === "area" ? `AREA|FL-LEG|${p.area_code}|${p.name}` : p.feature_type === "map_node" ? `NODE|FL-LEG|${p.id}|${p.node_type}|${p.name}` : `${p.edge_type === "road" ? "ROAD" : "PATH"}|FL-LEG|${p.id}|${p.source_name}`; const description = Object.entries(p).map(([key, value]) => `<Data name="${esc(key)}"><value>${esc(Array.isArray(value) ? value.join("; ") : value)}</value></Data>`).join(""); return `<Placemark><name>${esc(label)}</name><ExtendedData>${description}</ExtendedData>${kmlGeometry(item.geometry)}</Placemark>`; };
const folder = (name, items) => `<Folder><name>${name}</name>${items.map(kmlFeature).join("")}</Folder>`;
const kml = `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Forest Lake Memorial Park Phase 1 cleaned network</name>${folder("00_SITE", features.filter((item) => item.properties.feature_type === "site"))}${folder("01_GARDENS", features.filter((item) => item.properties.feature_type === "area"))}${folder("04_ROADS", features.filter((item) => item.properties.edge_type === "road"))}${folder("05_WALKWAYS", features.filter((item) => item.properties.edge_type === "path"))}${folder("06_NODES", features.filter((item) => item.properties.feature_type === "map_node"))}</Document></kml>\n`;
fs.writeFileSync(path.join(publicMaps, "forest-lake-phase1-cleaned-network.kml"), kml);

const bounds = allPoints.reduce((result, point) => ({ minLon: Math.min(result.minLon, point.lon), maxLon: Math.max(result.maxLon, point.lon), minLat: Math.min(result.minLat, point.lat), maxLat: Math.max(result.maxLat, point.lat) }), { minLon: Infinity, maxLon: -Infinity, minLat: Infinity, maxLat: -Infinity });
const width = 1400; const height = 950; const margin = 70; const drawingScale = Math.min((width - margin * 2) / (bounds.maxLon - bounds.minLon), (height - margin * 2) / (bounds.maxLat - bounds.minLat));
const project = ([lon, lat]) => [margin + (lon - bounds.minLon) * drawingScale, height - margin - (lat - bounds.minLat) * drawingScale];
const pathData = (coords, close = false) => `${coords.map((point, index) => { const [x, y] = project(point); return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(" ")}${close ? " Z" : ""}`;
const colors = { DPG: "#e6d7ef", HPG: "#d6edd1", RPG: "#d5e7f3", YPG: "#f2edc8" };
const areaPreview = features.filter((item) => item.properties.feature_type === "area").map((item) => `<path d="${pathData(item.geometry.coordinates[0], true)}" fill="${colors[item.properties.area_code] || "#edf2ed"}" stroke="#496f5c" stroke-width="2"/><text x="${project(item.geometry.coordinates[0][Math.floor(item.geometry.coordinates[0].length / 2)])[0].toFixed(1)}" y="${project(item.geometry.coordinates[0][Math.floor(item.geometry.coordinates[0].length / 2)])[1].toFixed(1)}" class="label">${esc(item.properties.name)}</text>`).join("");
const roadsPreview = edgeFeatures.filter((item) => item.properties.edge_type === "road").map((item) => `<path d="${pathData(item.geometry.coordinates)}" class="road"/>`).join("");
const pathsPreview = edgeFeatures.filter((item) => item.properties.edge_type === "path").map((item) => `<path d="${pathData(item.geometry.coordinates)}" class="walkway"/>`).join("");
const nodesPreview = features.filter((item) => item.properties.feature_type === "map_node").map((item) => { const [x, y] = project(item.geometry.coordinates); const derived = item.properties.node_type === "junction" || item.properties.node_type === "edge_endpoint"; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${derived ? 4 : 6}" class="${derived ? "derived" : "source"}"/>`; }).join("");
const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><style>.road{fill:none;stroke:#59636a;stroke-width:13;stroke-linecap:round;stroke-linejoin:round}.walkway{fill:none;stroke:#b47b52;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}.label{font:600 18px Arial,sans-serif;fill:#174c32;text-anchor:middle;paint-order:stroke;stroke:#fff;stroke-width:5px}.source{fill:#0b6b3a;stroke:#fff;stroke-width:2}.derived{fill:#d97706;stroke:#fff;stroke-width:1.5}</style><rect width="100%" height="100%" fill="#edf4ef"/>${site ? `<path d="${pathData(site.points.map((point) => [point.lon, point.lat]), true)}" fill="#f8faf8" stroke="#315946" stroke-width="2"/>` : ""}${areaPreview}${roadsPreview}${pathsPreview}${nodesPreview}<text x="35" y="40" font-family="Arial" font-size="20" font-weight="700" fill="#25352c">Forest Lake Phase 1 cleaned geometry</text></svg>\n`;
fs.writeFileSync(path.join(publicMaps, "forest-lake-phase1-cleaned-network-preview.svg"), svg);

const lineEndpoints = lines.flatMap((line) => [{ point: toXY(line.points[0]), line }, { point: toXY(line.points.at(-1)), line }]);
let nearOtherLine = 0;
for (const endpoint of lineEndpoints) { let nearest = Infinity; for (const segment of segments) if (segment.line !== endpoint.line) nearest = Math.min(nearest, nearestOnSegment(endpoint.point, segment.a, segment.b).distance); if (nearest <= reportGapToleranceM) nearOtherLine += 1; }
const duplicateIds = new Map();
for (const item of [...sourceNodes, ...lines]) { const parts = pipe(item.name); if (parts.length >= 3) duplicateIds.set(`${parts[0]}|${parts[2]}`, (duplicateIds.get(`${parts[0]}|${parts[2]}`) || 0) + 1); }
const duplicateRows = [...duplicateIds.entries()].filter(([, count]) => count > 1).map(([id, count]) => `- ${id}: ${count} source features`).join("\n") || "- None.";
const report = `# Forest Lake Phase 1 KML cleanup\n\nThis output was generated from the supplied KML. The original KML was not modified and no Supabase data was changed.\n\n## Included\n\n- Phase 1 garden polygons: ${areas.length} (${areas.map(areaCode).join(", ")})\n- Road features retained: ${lines.filter(isRoad).length}\n- Walkway features retained: ${lines.filter(isPath).length}\n- Source nodes retained: ${sourceNodes.length}\n- Derived exact line intersections: ${intersections.length}\n- Output nodes, including endpoints: ${nodes.length}\n- Output edges: ${edgeFeatures.length}\n\nButterfly Palm Garden and Majestic Palm Garden were excluded as Phase 2. No plot or gravesite features were present.\n\n## Fixes applied\n\n- Added clear KML folders for the site, gardens, roads, walkways, and nodes.\n- Assigned unique output IDs: N### for nodes and E### for edges.\n- Preserved the source road and walkway geometry.\n- Added endpoint nodes and exact intersection nodes where geometry supports them.\n- Added edge metadata linking each source line to its endpoint node IDs.\n\n## Source issues retained for review\n\nThe source duplicate IDs were:\n\n${duplicateRows}\n\n${lineEndpoints.length - nearOtherLine} of ${lineEndpoints.length} line endpoints were not within ${reportGapToleranceM} m of another line. They remain as explicit endpoints instead of being moved or silently connected.\n\n## Review files\n\n- Preview: /maps/forest-lake-phase1-cleaned-network-preview.svg\n- GeoJSON: /maps/forest-lake-phase1-cleaned-network.geojson\n- KML: /maps/forest-lake-phase1-cleaned-network.kml\n`;
fs.writeFileSync(path.join(docs, "forest-lake-phase1-kml-cleanup.md"), report);
console.log(JSON.stringify({ gardens: areas.length, roads: lines.filter(isRoad).length, walkways: lines.filter(isPath).length, sourceNodes: sourceNodes.length, derivedIntersections: intersections.length, outputNodes: nodes.length, outputEdges: edgeFeatures.length }, null, 2));
