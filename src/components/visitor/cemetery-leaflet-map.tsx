"use client";

import { useEffect, useRef, useState } from "react";
import { CircleMarker, Polygon as LeafletPolygon, GeoJSON, MapContainer, Marker, Polyline, Tooltip, ZoomControl, useMap } from "react-leaflet";
import { CRS, divIcon, type LeafletMouseEvent } from "leaflet";
import { Alert } from "@/components/ui/alert";
import { schematicMapBounds } from "@/lib/map-layout";
import { loadPhaseOneMapData, projectPhaseOneLocation, type PhaseOneAreaFeature, type PhaseOneMapData } from "@/lib/phase1-map-data";
import type { PublicBurialRecord } from "@/lib/supabase/types";
import type { PhaseOneRoute } from "@/lib/phase1-routing";

const areaLabelIcon = divIcon({ className: "phase-one-area-label-anchor", html: "", iconSize: [1, 1], iconAnchor: [0, 0] });

type CemeteryLeafletMapProps = {
  selectedRecordId?: string;
  onSelectRecord?: (id: string) => void;
  userLocation?: import("@/lib/navigation-geo").GpsPosition | null;
  recenterRequest?: number;
  records: PublicBurialRecord[];
  selectedPlot: string;
  onSelectPlot: (plot: string) => void;
  onSelectZone: (zone: string) => void;
  mapData?: PhaseOneMapData | null;
  route?: PhaseOneRoute | null;
};

export function CemeteryLeafletMap({ records, selectedPlot, onSelectPlot, onSelectZone, mapData, route, userLocation, recenterRequest = 0, selectedRecordId, onSelectRecord }: CemeteryLeafletMapProps) {
  return <MapContainer aria-label="Forest Lake Memorial Park plan map" bounds={schematicMapBounds} crs={CRS.Simple} maxZoom={2} minZoom={-2} scrollWheelZoom zoomControl={false} zoomSnap={0.25} zoomDelta={0.25}>
    <ZoomControl position="topright" />
    <MapResetControl />
    {mapData && userLocation ? <UserLocationLayer mapData={mapData} location={userLocation} recenterRequest={recenterRequest} /> : null}
    <PhaseOneGeometryLayer initialMapData={mapData} onSelectPlot={onSelectPlot} onSelectZone={onSelectZone} records={records} route={route} selectedPlot={selectedPlot} selectedRecordId={selectedRecordId} onSelectRecord={onSelectRecord} />
  </MapContainer>;
}

function PhaseOneGeometryLayer({ initialMapData, onSelectPlot, onSelectZone, records, route, selectedPlot, selectedRecordId, onSelectRecord }: { initialMapData?: PhaseOneMapData | null; onSelectPlot: (plot: string) => void; onSelectZone: (zone: string) => void; records: PublicBurialRecord[]; route?: PhaseOneRoute | null; selectedPlot: string; selectedRecordId?: string; onSelectRecord?: (id: string) => void }) {
  const [loadedMapData, setLoadedMapData] = useState<PhaseOneMapData | null>(null);
  const [showVectors, setShowVectors] = useState(true);
  const mapData = initialMapData || loadedMapData;

  useEffect(() => {
    if (initialMapData) return;
    const controller = new AbortController();
    void loadPhaseOneMapData(controller.signal).then(setLoadedMapData).catch((reason: unknown) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setLoadedMapData(null);
    });
    return () => controller.abort();
  }, [initialMapData]);

  return <>
    {mapData?.warnings.length ? <Alert icon="alert" title="Map data needs review" variant="warning">{mapData.warnings.length} map feature{mapData.warnings.length === 1 ? "" : "s"} could not be displayed.</Alert> : null}
    <button aria-pressed={showVectors} className="phase-one-map-toggle" onClick={() => setShowVectors((visible) => !visible)} type="button">
      {showVectors ? "Hide KML roads and paths" : "Show KML roads and paths"}
    </button>
    {mapData ? <>
      <GeoJSON data={mapData.areas} onEachFeature={(feature, layer) => {
        const label = getAreaLabel(feature as PhaseOneAreaFeature);
        if (!label) return;
        layer.on("click", (event: LeafletMouseEvent) => {
          event.originalEvent.stopPropagation();
          onSelectZone(label);
        });
      }} style={(feature) => areaStyle(feature)} />
      {mapData.areas.features.map((feature) => {
        const label = getAreaLabel(feature);
        const position = getAreaLabelPosition(feature);
        if (!label || !position) return null;
        return <Marker icon={areaLabelIcon} key={`${feature.properties?.area_code || feature.id}-label`} position={position}>
          <Tooltip className="phase-one-area-label" direction="center" offset={[0, 0]} permanent>{label}</Tooltip>
        </Marker>;
      })}
      {showVectors ? <>
        <GeoJSON data={mapData.edges} style={(feature) => ({ color: feature?.properties?.edge_type === "road" ? "#59636a" : "#a9693d", opacity: 0.86, weight: feature?.properties?.edge_type === "road" ? 5 : 3 })} />
        {mapData.nodes.map((node) => <CircleMarker center={node.schematicPosition} key={node.properties?.id || node.id || node.schematicPosition.join("-")} pathOptions={{ color: node.properties?.node_type === "edge_endpoint" ? "#a9693d" : "#006b3c", fillColor: node.properties?.node_type === "edge_endpoint" ? "#f4b26a" : "#006b3c", fillOpacity: 0.95, weight: 2 }} radius={node.properties?.node_type === "edge_endpoint" ? 3 : 5} />)}
      </> : null}
      {route ? <Polyline positions={route.coordinates} pathOptions={{ color: "#0b6f48", opacity: 0.95, weight: 6 }} /> : null}
      {records.filter((record) => Boolean(record.location)).map((record) => {
        const position = record.location ? projectPhaseOneLocation(mapData, record.location) : null;
        if (!position) return null;
        const selected = selectedRecordId !== undefined ? selectedRecordId === record.id : selectedPlot === record.plot;
        return <CircleMarker center={position} eventHandlers={{ click: () => onSelectRecord ? onSelectRecord(record.id) : onSelectPlot(record.plot) }} key={record.id} pathOptions={{ color: selected ? "var(--map-selected)" : "var(--map-record)", fillColor: selected ? "var(--map-selected)" : "var(--map-record)", fillOpacity: 1, weight: 3 }} radius={selected ? 9 : 6}><Tooltip>{record.name} · {record.section} · {record.plot}</Tooltip></CircleMarker>;
      })}
    </> : null}
  </>;
}

function MapResetControl() {
  const map = useMap();
  return <button aria-label="Reset map view" className="schematic-map-reset" onClick={() => map.fitBounds(schematicMapBounds)} type="button">Reset view</button>;
}

function areaStyle(feature: { properties?: { area_code?: string } } | undefined) {
  const fills: Record<string, string> = { DPG: "#e5c9ef", HPG: "#bfe3b9", RPG: "#c7e2f3", YPG: "#f4e8a4" };
  return { color: "#1d6244", fillColor: fills[feature?.properties?.area_code || ""] || "#cfe5d8", fillOpacity: 0.45, opacity: 0.95, weight: 2 };
}

function getAreaLabel(feature: PhaseOneAreaFeature) {
  return feature.properties?.area_code === "YPG" ? "Yellow Palm Garden" : feature.properties?.name;
}

function getAreaLabelPosition(feature: PhaseOneAreaFeature): [number, number] | null {
  const ring = feature.geometry.coordinates[0];
  if (!ring?.length) return null;
  const totals = ring.reduce((sum, [x, y]) => [sum[0] + x, sum[1] + y], [0, 0]);
  return [totals[1] / ring.length, totals[0] / ring.length];
}

function UserLocationLayer({ mapData, location, recenterRequest }: { mapData: PhaseOneMapData; location: import("@/lib/navigation-geo").GpsPosition; recenterRequest: number }) {
  const map = useMap();
  const lastRequest = useRef(-1);
  const position = projectPhaseOneLocation(mapData, location);
  const lat = position?.[0];
  const lon = position?.[1];
  useEffect(() => {
    if (lat !== undefined && lon !== undefined && lastRequest.current !== recenterRequest) {
      map.panTo([lat, lon]);
      lastRequest.current = recenterRequest;
    }
  }, [map, lat, lon, recenterRequest]);
  if (!position) return null;
  // Convert a geographic accuracy circle to this map's schematic coordinate system.
  const bounds = mapData.geographicBounds;
  const latitudeRadius = location.accuracy / 111320;
  const longitudeRadius = latitudeRadius / Math.max(0.01, Math.cos(location.latitude * Math.PI / 180));
  const ring: Array<[number, number]> = Array.from({ length: 48 }, (_, index) => {
    const angle = index * Math.PI * 2 / 48;
    const latitude = location.latitude + latitudeRadius * Math.sin(angle);
    const longitude = location.longitude + longitudeRadius * Math.cos(angle);
    return [
      (latitude - bounds.minLatitude) / (bounds.maxLatitude - bounds.minLatitude) * schematicMapBounds[1][0],
      (longitude - bounds.minLongitude) / (bounds.maxLongitude - bounds.minLongitude) * schematicMapBounds[1][1],
    ];
  });
  return <><LeafletPolygon positions={ring} pathOptions={{ color: "#1769aa", weight: 1, fillOpacity: 0.12 }} />
    <CircleMarker center={position} radius={7} pathOptions={{ color: "#fff", weight: 2, fillColor: "#1769aa", fillOpacity: 1 }}>
      <Tooltip permanent direction="top">You are here · accuracy about {Math.round(location.accuracy)} m</Tooltip>
    </CircleMarker></>;
}
