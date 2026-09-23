import type { PhaseOneMapData } from "@/lib/phase1-map-data";
import { projectPhaseOneLocation } from "@/lib/phase1-map-data";

export type PhaseOneRoute = {
  coordinates: Array<[number, number]>;
  distanceM: number | null;
  startNodeName: string;
  targetNodeName: string;
  instructions: string[];
};

type NetworkNode = { id: string; name: string; position: [number, number]; nodeType: string };
type NetworkEdge = { to: string; cost: number; distanceM: number | null; coordinates: Array<[number, number]> };

export function findShortestPhaseOneRoute(mapData: PhaseOneMapData, destination: { longitude: number; latitude: number }, origin?: { longitude: number; latitude: number }): PhaseOneRoute | null {
  const targetPosition = projectPhaseOneLocation(mapData, destination);
  if (!targetPosition || !mapData.nodes.length || !mapData.edges.features.length) return null;
  const originPosition = origin ? projectPhaseOneLocation(mapData, origin) : null;
  if (origin && !originPosition) return null;

  const nodes = mapData.nodes.map((node) => ({
    id: String(node.properties?.id || node.id || ""),
    name: node.properties?.name || "Network point",
    position: node.schematicPosition,
    nodeType: node.properties?.node_type || "",
  })).filter((node) => node.id);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const adjacency = new Map<string, NetworkEdge[]>();
  const scale = getDistanceScale(mapData.edges.features);
  for (const edge of mapData.edges.features) {
    const from = String(edge.properties?.from_node_id || "");
    const to = String(edge.properties?.to_node_id || "");
    if (!nodeById.has(from) || !nodeById.has(to)) continue;
    if (edge.properties?.is_restricted) continue;
    const measuredDistance = typeof edge.properties?.distance_m === "number" && edge.properties.distance_m > 0 ? edge.properties.distance_m : null;
    const cost = measuredDistance ?? lineLength(edge.geometry.coordinates as Array<[number, number]>) * scale;
    const coordinates = edge.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
    addEdge(adjacency, from, { to, cost, distanceM: measuredDistance, coordinates });
    addEdge(adjacency, to, { to: from, cost, distanceM: measuredDistance, coordinates: [...coordinates].reverse() });
  }

  // Landmarks can be useful on the map without being routing vertices. Never
  // choose a disconnected landmark as the start or destination node.
  const routableNodes = nodes.filter((node) => (adjacency.get(node.id) || []).length > 0);
  const entranceNode = routableNodes.find((node) => node.nodeType === "entrance") || routableNodes.find((node) => /main entrance/i.test(node.name));
  const startNode = originPosition ? nearestNode(routableNodes, originPosition) : entranceNode;
  const targetNode = routableNodes.reduce<NetworkNode | null>((closest, node) => distanceSquared(node.position, targetPosition) < (closest ? distanceSquared(closest.position, targetPosition) : Number.POSITIVE_INFINITY) ? node : closest, null);
  if (!startNode || !targetNode) return null;

  const previous = new Map<string, { nodeId: string; edge: NetworkEdge }>();
  const distances = new Map<string, number>(routableNodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const distanceMeters = new Map<string, number | null>(routableNodes.map((node) => [node.id, 0]));
  const queue = new Set(routableNodes.map((node) => node.id));
  distances.set(startNode.id, 0);

  while (queue.size) {
    const current = [...queue].reduce<string | null>((best, id) => best === null || (distances.get(id) ?? Number.POSITIVE_INFINITY) < (distances.get(best) ?? Number.POSITIVE_INFINITY) ? id : best, null);
    if (!current || !Number.isFinite(distances.get(current))) break;
    queue.delete(current);
    if (current === targetNode.id) break;
    for (const edge of adjacency.get(current) || []) {
      if (!queue.has(edge.to)) continue;
      const nextDistance = (distances.get(current) || 0) + edge.cost;
      if (nextDistance >= (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(edge.to, nextDistance);
      previous.set(edge.to, { nodeId: current, edge });
      const currentMeters = distanceMeters.get(current) ?? null;
      distanceMeters.set(edge.to, currentMeters === null || edge.distanceM === null ? null : currentMeters + edge.distanceM);
    }
  }

  if (startNode.id !== targetNode.id && !previous.has(targetNode.id)) return null;
  const nodeIds = [targetNode.id];
  while (nodeIds[0] !== startNode.id) {
    const parent = previous.get(nodeIds[0]);
    if (!parent) return null;
    nodeIds.unshift(parent.nodeId);
  }

  const routeCoordinates: Array<[number, number]> = [];


  for (let index = 0; index < nodeIds.length - 1; index += 1) {
    const from = nodeIds[index];
    const to = nodeIds[index + 1];
    const traversal = previous.get(to);
    if (!traversal || traversal.nodeId !== from) continue;
    routeCoordinates.push(...(index === 0 ? traversal.edge.coordinates : traversal.edge.coordinates.slice(1)));
  }
  if (!routeCoordinates.length) routeCoordinates.push(...nodeIds.map((id) => nodeById.get(id)?.position).filter((position): position is [number, number] => Boolean(position)));
  // End at the recorded path. The final approach to the grave has not been surveyed.

  return {
    coordinates: routeCoordinates,
    distanceM: distanceMeters.get(targetNode.id) ?? null,
    startNodeName: originPosition ? "Your location" : startNode.name,
    targetNodeName: targetNode.name,
    instructions: nodeIds.map((id) => nodeById.get(id)).filter((node) => node && (node.nodeType === "landmark" || node.nodeType === "entrance") && !/^(N[0-9]+|network point)$/i.test(node.name)).map((node) => "Continue via " + node!.name + "."),
  };
}

function addEdge(adjacency: Map<string, NetworkEdge[]>, from: string, edge: NetworkEdge) {
  const edges = adjacency.get(from) || [];
  edges.push(edge);
  adjacency.set(from, edges);
}

function distanceSquared(first: [number, number], second: [number, number]) {
  return (first[0] - second[0]) ** 2 + (first[1] - second[1]) ** 2;
}

function lineLength(coordinates: Array<[number, number]>) {
  return coordinates.slice(1).reduce((total, coordinate, index) => total + Math.sqrt(distanceSquared(coordinates[index], coordinate)), 0);
}

function nearestNode(nodes: NetworkNode[], position: [number, number]) {
  return nodes.reduce<NetworkNode | null>((closest, node) => distanceSquared(node.position, position) < (closest ? distanceSquared(closest.position, position) : Number.POSITIVE_INFINITY) ? node : closest, null);
}

function getDistanceScale(edges: PhaseOneMapData["edges"]["features"]) {
  const ratios = edges.map((edge) => {
    const distanceM = edge.properties?.distance_m;
    const length = lineLength(edge.geometry.coordinates as Array<[number, number]>);
    return typeof distanceM === "number" && distanceM > 0 && length > 0 ? distanceM / length : null;
  }).filter((ratio): ratio is number => ratio !== null && Number.isFinite(ratio));
  if (!ratios.length) return 1;
  ratios.sort((first, second) => first - second);
  return ratios[Math.floor(ratios.length / 2)] || 1;
}
