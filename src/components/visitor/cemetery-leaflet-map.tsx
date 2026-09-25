"use client";

import { CRS, divIcon, type LeafletMouseEvent } from "leaflet";
import { useEffect, useRef, useState } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polygon as LeafletPolygon,
  Polyline,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import { Icon } from "@/components/ui/icons";
import type { GpsPosition } from "@/lib/navigation-geo";
import { schematicMapBounds } from "@/lib/map-layout";
import {
  loadPhaseOneMapData,
  projectPhaseOneLocation,
  type PhaseOneAreaFeature,
  type PhaseOneMapData,
} from "@/lib/phase1-map-data";
import type { PhaseOneRoute } from "@/lib/phase1-routing";
import type { PublicBurialRecord } from "@/lib/supabase/types";

const areaLabelIcon = divIcon({
  className: "phase-one-area-label-anchor",
  html: "",
  iconSize: [1, 1],
  iconAnchor: [0, 0],
});

type CemeteryLeafletMapProps = {
  accessibleLabel?: string;
  selectedRecordId?: string;
  onSelectRecord?: (id: string) => void;
  userLocation?: GpsPosition | null;
  recenterRequest?: number;
  records: PublicBurialRecord[];
  selectedPlot: string;
  onSelectPlot: (plot: string) => void;
  onSelectZone: (zone: string) => void;
  mapData?: PhaseOneMapData | null;
  route?: PhaseOneRoute | null;
};

type PhaseOneGeometryLayerProps = {
  initialMapData?: PhaseOneMapData | null;
  onSelectPlot: (plot: string) => void;
  onSelectZone: (zone: string) => void;
  records: PublicBurialRecord[];
  route?: PhaseOneRoute | null;
  selectedPlot: string;
  selectedRecordId?: string;
  onSelectRecord?: (id: string) => void;
};

type UserLocationLayerProps = {
  mapData: PhaseOneMapData;
  location: GpsPosition;
  recenterRequest: number;
};

export function CemeteryLeafletMap({
  accessibleLabel = "Forest Lake Memorial Park plan map",
  records,
  selectedPlot,
  onSelectPlot,
  onSelectZone,
  mapData,
  route,
  userLocation,
  recenterRequest = 0,
  selectedRecordId,
  onSelectRecord,
}: CemeteryLeafletMapProps) {
  return (
    <MapContainer
      aria-label={accessibleLabel}
      bounds={schematicMapBounds}
      className="cemetery-leaflet-canvas"
      crs={CRS.Simple}
      maxZoom={2}
      minZoom={-2}
      scrollWheelZoom
      zoomControl={false}
      zoomDelta={0.25}
      zoomSnap={0.25}
    >
      <ZoomControl position="topright" />
      <MapResetControl />
      {mapData && userLocation ? (
        <UserLocationLayer
          location={userLocation}
          mapData={mapData}
          recenterRequest={recenterRequest}
        />
      ) : null}
      <PhaseOneGeometryLayer
        initialMapData={mapData}
        onSelectPlot={onSelectPlot}
        onSelectRecord={onSelectRecord}
        onSelectZone={onSelectZone}
        records={records}
        route={route}
        selectedPlot={selectedPlot}
        selectedRecordId={selectedRecordId}
      />
    </MapContainer>
  );
}

function PhaseOneGeometryLayer({
  initialMapData,
  onSelectPlot,
  onSelectZone,
  records,
  route,
  selectedPlot,
  selectedRecordId,
  onSelectRecord,
}: PhaseOneGeometryLayerProps) {
  const [loadedMapData, setLoadedMapData] =
    useState<PhaseOneMapData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [showVectors, setShowVectors] = useState(true);
  const mapData = initialMapData || loadedMapData;

  useEffect(() => {
    if (initialMapData) return;

    const controller = new AbortController();
    void loadPhaseOneMapData(controller.signal)
      .then((data) => {
        setLoadedMapData(data);
        setLoadError("");
      })
      .catch((reason: unknown) => {
        const requestWasAborted =
          reason instanceof DOMException && reason.name === "AbortError";

        if (!requestWasAborted) {
          setLoadedMapData(null);
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "The cemetery network could not be loaded.",
          );
        }
      });

    return () => controller.abort();
  }, [initialMapData]);

  return (
    <>
      {!mapData && !loadError ? (
        <div aria-live="polite" className="map-layer-state">
          <span className="map-loading__spinner" />
          <strong>Loading cemetery network…</strong>
        </div>
      ) : null}

      {loadError ? (
        <div
          className="map-layer-state map-layer-state--error"
          role="alert"
        >
          <Icon name="alert" size={21} />
          <strong>Map network unavailable</strong>
          <span>{loadError}</span>
        </div>
      ) : null}

      {mapData?.warnings.length ? (
        <div className="map-data-warning" role="status">
          <Icon name="alert" size={16} />
          {mapData.warnings.length} map feature
          {mapData.warnings.length === 1 ? "" : "s"} could not be displayed.
        </div>
      ) : null}

      <button
        aria-pressed={showVectors}
        className="phase-one-map-toggle"
        onClick={() => setShowVectors((visible) => !visible)}
        type="button"
      >
        <Icon name="map" size={16} />
        {showVectors ? "Hide paths" : "Show paths"}
      </button>

      {mapData ? (
        <>
          <GeoJSON
            data={mapData.areas}
            onEachFeature={(feature, layer) => {
              const label = getAreaLabel(feature as PhaseOneAreaFeature);
              if (!label) return;

              layer.on("click", (event: LeafletMouseEvent) => {
                event.originalEvent.stopPropagation();
                onSelectZone(label);
              });
            }}
            style={(feature) => areaStyle(feature)}
          />

          {mapData.areas.features.map((feature) => {
            const label = getAreaLabel(feature);
            const position = getAreaLabelPosition(feature);
            if (!label || !position) return null;

            const markerKey = feature.properties?.area_code || feature.id;

            return (
              <Marker
                icon={areaLabelIcon}
                key={`${markerKey}-label`}
                position={position}
              >
                <Tooltip
                  className="phase-one-area-label"
                  direction="center"
                  offset={[0, 0]}
                  permanent
                >
                  {label}
                </Tooltip>
              </Marker>
            );
          })}

          {showVectors ? (
            <>
              <GeoJSON
                data={mapData.edges}
                style={(feature) => ({
                  color:
                    feature?.properties?.edge_type === "road"
                      ? "var(--map-road-edge)"
                      : "var(--map-walkway)",
                  opacity: 0.9,
                  weight:
                    feature?.properties?.edge_type === "road" ? 5 : 3,
                })}
              />
              {mapData.nodes.map((node) => {
                const isEndpoint =
                  node.properties?.node_type === "edge_endpoint";
                const nodeKey =
                  node.properties?.id ||
                  node.id ||
                  node.schematicPosition.join("-");

                return (
                  <CircleMarker
                    center={node.schematicPosition}
                    key={nodeKey}
                    pathOptions={{
                      color: isEndpoint
                        ? "var(--map-walkway)"
                        : "var(--map-node)",
                      fillColor: isEndpoint
                        ? "var(--map-node-endpoint)"
                        : "var(--map-node)",
                      fillOpacity: 0.95,
                      weight: 2,
                    }}
                    radius={isEndpoint ? 3 : 5}
                  />
                );
              })}
            </>
          ) : null}

          {route ? (
            <Polyline
              pathOptions={{
                color: "var(--map-route)",
                opacity: 0.98,
                weight: 7,
              }}
              positions={route.coordinates}
            />
          ) : null}

          {records
            .filter((record) => Boolean(record.location))
            .map((record) => {
              const position = record.location
                ? projectPhaseOneLocation(mapData, record.location)
                : null;
              if (!position) return null;

              const selected =
                selectedRecordId !== undefined
                  ? selectedRecordId === record.id
                  : selectedPlot === record.plot;
              const markerColor = selected
                ? "var(--map-selected)"
                : "var(--map-record)";

              return (
                <CircleMarker
                  center={position}
                  eventHandlers={{
                    click: () =>
                      onSelectRecord
                        ? onSelectRecord(record.id)
                        : onSelectPlot(record.plot),
                  }}
                  key={record.id}
                  pathOptions={{
                    color: markerColor,
                    fillColor: markerColor,
                    fillOpacity: 1,
                    weight: 3,
                  }}
                  radius={selected ? 9 : 6}
                >
                  <Tooltip>
                    {record.name} · {record.section} · {record.plot}
                  </Tooltip>
                </CircleMarker>
              );
            })}
        </>
      ) : null}
    </>
  );
}

function MapResetControl() {
  const map = useMap();

  return (
    <button
      aria-label="Reset map view"
      className="schematic-map-reset"
      onClick={() => map.fitBounds(schematicMapBounds)}
      type="button"
    >
      <Icon name="target" size={16} />
      Reset view
    </button>
  );
}

function areaStyle(
  feature: { properties?: { area_code?: string } } | undefined,
) {
  const fills: Record<string, string> = {
    DPG: "var(--map-zone-date)",
    HPG: "var(--map-zone-hawaiian)",
    RPG: "var(--map-zone-royal)",
    YPG: "var(--map-zone-yellow)",
  };

  return {
    color: "var(--map-zone-border)",
    fillColor:
      fills[feature?.properties?.area_code || ""] || "var(--map-zone-default)",
    fillOpacity: 0.52,
    opacity: 0.95,
    weight: 2,
  };
}

function getAreaLabel(feature: PhaseOneAreaFeature) {
  return feature.properties?.area_code === "YPG"
    ? "Yellow Palm Garden"
    : feature.properties?.name;
}

function getAreaLabelPosition(
  feature: PhaseOneAreaFeature,
): [number, number] | null {
  const ring = feature.geometry.coordinates[0];
  if (!ring?.length) return null;

  const totals = ring.reduce(
    (sum, [x, y]) => [sum[0] + x, sum[1] + y],
    [0, 0],
  );
  return [totals[1] / ring.length, totals[0] / ring.length];
}

function UserLocationLayer({
  mapData,
  location,
  recenterRequest,
}: UserLocationLayerProps) {
  const map = useMap();
  const lastRequest = useRef(-1);
  const position = projectPhaseOneLocation(mapData, location);
  const lat = position?.[0];
  const lon = position?.[1];

  useEffect(() => {
    const shouldRecenter =
      lat !== undefined &&
      lon !== undefined &&
      lastRequest.current !== recenterRequest;

    if (shouldRecenter) {
      map.panTo([lat, lon]);
      lastRequest.current = recenterRequest;
    }
  }, [map, lat, lon, recenterRequest]);

  if (!position) return null;

  // Convert a geographic accuracy circle to this map's schematic coordinate system.
  const bounds = mapData.geographicBounds;
  const latitudeRadius = location.accuracy / 111320;
  const latitudeRadians = (location.latitude * Math.PI) / 180;
  const longitudeRadius =
    latitudeRadius / Math.max(0.01, Math.cos(latitudeRadians));
  const ring: Array<[number, number]> = Array.from(
    { length: 48 },
    (_, index) => {
      const angle = (index * Math.PI * 2) / 48;
      const latitude =
        location.latitude + latitudeRadius * Math.sin(angle);
      const longitude =
        location.longitude + longitudeRadius * Math.cos(angle);

      return [
        ((latitude - bounds.minLatitude) /
          (bounds.maxLatitude - bounds.minLatitude)) *
          schematicMapBounds[1][0],
        ((longitude - bounds.minLongitude) /
          (bounds.maxLongitude - bounds.minLongitude)) *
          schematicMapBounds[1][1],
      ];
    },
  );

  return (
    <>
      <LeafletPolygon
        pathOptions={{
          color: "var(--map-user)",
          fillColor: "var(--map-user)",
          fillOpacity: 0.12,
          weight: 1,
        }}
        positions={ring}
      />
      <CircleMarker
        center={position}
        pathOptions={{
          color: "var(--map-user-ring)",
          fillColor: "var(--map-user)",
          fillOpacity: 1,
          weight: 2,
        }}
        radius={7}
      >
        <Tooltip direction="top" permanent>
          You are here · accuracy about {Math.round(location.accuracy)} m
        </Tooltip>
      </CircleMarker>
    </>
  );
}
