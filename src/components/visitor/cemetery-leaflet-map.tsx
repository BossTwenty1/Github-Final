"use client";

import { useEffect, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Marker, Tooltip, ZoomControl, useMap } from "react-leaflet";
import { CRS, divIcon, type LeafletMouseEvent } from "leaflet";
import { schematicMapBounds } from "@/lib/map-layout";
import { loadPhaseOneMapData, projectPhaseOneLocation, type PhaseOneAreaFeature, type PhaseOneMapData } from "@/lib/phase1-map-data";
import type { PublicBurialRecord } from "@/lib/supabase/types";

const areaLabelIcon = divIcon({ className: "phase-one-area-label-anchor", html: "", iconSize: [1, 1], iconAnchor: [0, 0] });

type CemeteryLeafletMapProps = {
  records: PublicBurialRecord[];
  selectedPlot: string;
  onSelectPlot: (plot: string) => void;
  onSelectZone: (zone: string) => void;
};

export function CemeteryLeafletMap({ records, selectedPlot, onSelectPlot, onSelectZone }: CemeteryLeafletMapProps) {
  return <MapContainer aria-label="Forest Lake Memorial Park plan map" bounds={schematicMapBounds} crs={CRS.Simple} maxZoom={2} minZoom={-2} scrollWheelZoom zoomControl={false} zoomSnap={0.25} zoomDelta={0.25}>
    <ZoomControl position="topright" />
    <MapResetControl />
    <PhaseOneGeometryLayer onSelectPlot={onSelectPlot} onSelectZone={onSelectZone} records={records} selectedPlot={selectedPlot} />
  </MapContainer>;
}

function PhaseOneGeometryLayer({ onSelectPlot, onSelectZone, records, selectedPlot }: { onSelectPlot: (plot: string) => void; onSelectZone: (zone: string) => void; records: PublicBurialRecord[]; selectedPlot: string }) {
  const [mapData, setMapData] = useState<PhaseOneMapData | null>(null);
  const [showVectors, setShowVectors] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void loadPhaseOneMapData(controller.signal).then(setMapData).catch((reason: unknown) => {
      if (!(reason instanceof DOMException && reason.name === "AbortError")) setMapData(null);
    });
    return () => controller.abort();
  }, []);

  return <>
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
      {records.filter((record) => Boolean(record.location)).map((record) => {
        const position = record.location ? projectPhaseOneLocation(mapData, record.location) : null;
        if (!position) return null;
        const selected = selectedPlot === record.plot;
        return <CircleMarker center={position} eventHandlers={{ click: () => onSelectPlot(record.plot) }} key={record.id} pathOptions={{ color: selected ? "var(--map-selected)" : "var(--map-record)", fillColor: selected ? "var(--map-selected)" : "var(--map-record)", fillOpacity: 1, weight: 3 }} radius={selected ? 9 : 6} />;
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
