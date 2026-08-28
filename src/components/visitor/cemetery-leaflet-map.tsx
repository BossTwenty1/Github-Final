"use client";

import { useEffect, useRef } from "react";
import { CircleMarker, ImageOverlay, MapContainer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import { CRS } from "leaflet";
import { schematicImageHeight, schematicImageWidth, schematicMapBounds, schematicZones } from "@/lib/map-layout";
import type { PublicBurialRecord } from "@/lib/supabase/types";

type CemeteryLeafletMapProps = {
  records: PublicBurialRecord[];
  selectedPlot: string;
  onSelectPlot: (plot: string) => void;
  onSelectZone: (zone: string) => void;
};

type GrassHitbox = {
  gridHeight: number;
  gridWidth: number;
  labels: Int16Array;
};

export function CemeteryLeafletMap({ records, selectedPlot, onSelectPlot, onSelectZone }: CemeteryLeafletMapProps) {
  return <MapContainer aria-label="Forest Lake Memorial Park plan map" bounds={schematicMapBounds} crs={CRS.Simple} maxZoom={2} minZoom={-2} scrollWheelZoom zoomControl={false} zoomSnap={0.25} zoomDelta={0.25}>
    <ZoomControl position="topright" />
    <MapResetControl />
    <GreenGrassClickControl onSelectZone={onSelectZone} />
    <ImageOverlay alt="Vector coordinate layer for the cemetery plan" className="schematic-plan-overlay schematic-plan-overlay--vector" interactive={false} url="/maps/legazpi-color.svg" bounds={schematicMapBounds} zIndex={1} />
    <ImageOverlay alt="Illustrated Forest Lake Memorial Park layout" className="schematic-plan-overlay schematic-plan-overlay--visual" interactive={false} url="/maps/legazpi-visual.png" bounds={schematicMapBounds} zIndex={2} />
    {records.map((record) => {
      const position = record.pixelLocation && record.pixelLocation.x <= schematicImageWidth && record.pixelLocation.y <= schematicImageHeight ? [schematicImageHeight - record.pixelLocation.y, record.pixelLocation.x] as [number, number] : null;
      if (!position) return null;
      return <CircleMarker key={record.id} center={position} eventHandlers={{ click: () => onSelectPlot(record.plot) }} pathOptions={{ color: selectedPlot === record.plot ? "var(--map-selected)" : "var(--map-record)", fillColor: selectedPlot === record.plot ? "var(--map-selected)" : "var(--map-record)", fillOpacity: 1, weight: 3 }} radius={selectedPlot === record.plot ? 9 : 6} />;
    })}
  </MapContainer>;
}

function MapResetControl() {
  const map = useMap();
  return <button aria-label="Reset map view" className="schematic-map-reset" onClick={() => map.fitBounds(schematicMapBounds)} type="button">Reset view</button>;
}

function GreenGrassClickControl({ onSelectZone }: { onSelectZone: (zone: string) => void }) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const hitboxRef = useRef<GrassHitbox | null>(null);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      hitboxRef.current = buildGrassHitbox(image);
    };
    image.src = "/maps/legazpi-visual.png";
    return () => {
      imageRef.current = null;
      hitboxRef.current = null;
    };
  }, []);

  useMapEvents({ click: (event) => {
    const image = imageRef.current;
    if (!image) {
      onSelectZone("");
      return;
    }

    const imageX = event.latlng.lng;
    const imageY = schematicImageHeight - event.latlng.lat;
    const pixelX = imageX * image.naturalWidth / schematicImageWidth;
    const pixelY = imageY * image.naturalHeight / schematicImageHeight;
    if (pixelX < 0 || pixelY < 0 || pixelX >= image.naturalWidth || pixelY >= image.naturalHeight) {
      onSelectZone("");
      return;
    }

    const hitbox = hitboxRef.current;
    if (!hitbox) {
      onSelectZone("");
      return;
    }

    const cellX = Math.floor(pixelX * hitbox.gridWidth / image.naturalWidth);
    const cellY = Math.floor(pixelY * hitbox.gridHeight / image.naturalHeight);
    const centerIndex = cellY * hitbox.gridWidth + cellX;
    const centerLabel = hitbox.labels[centerIndex];
    if (centerLabel >= 0) {
      onSelectZone(schematicZones[centerLabel].label);
      return;
    }

    const nearbyLabels = new Map<number, number>();
    for (let y = Math.max(0, cellY - 1); y <= Math.min(hitbox.gridHeight - 1, cellY + 1); y += 1) {
      for (let x = Math.max(0, cellX - 1); x <= Math.min(hitbox.gridWidth - 1, cellX + 1); x += 1) {
        const label = hitbox.labels[y * hitbox.gridWidth + x];
        if (label >= 0) nearbyLabels.set(label, (nearbyLabels.get(label) || 0) + 1);
      }
    }
    const nearbyLabel = [...nearbyLabels.entries()].sort((left, right) => right[1] - left[1])[0];
    if (!nearbyLabel || nearbyLabel[1] < 4) {
      onSelectZone("");
      return;
    }

    onSelectZone(schematicZones[nearbyLabel[0]].label);
  }});
  return null;
}

function buildGrassHitbox(image: HTMLImageElement): GrassHitbox | null {
  const cellSize = 2;
  const gridWidth = Math.ceil(image.naturalWidth / cellSize);
  const gridHeight = Math.ceil(image.naturalHeight / cellSize);
  const canvas = document.createElement("canvas");
  canvas.width = gridWidth;
  canvas.height = gridHeight;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, gridWidth, gridHeight);
  const pixels = context.getImageData(0, 0, gridWidth, gridHeight).data;
  const labels = new Int16Array(gridWidth * gridHeight);
  labels.fill(-2);
  for (let index = 0; index < labels.length; index += 1) {
    const red = pixels[index * 4];
    const green = pixels[index * 4 + 1];
    const blue = pixels[index * 4 + 2];
    if (green > red + 16 && green > blue + 35 && red > 60) labels[index] = -1;
  }

  const seeds = schematicZones.flatMap((zone, zoneIndex) => {
    const anchor = {
      x: zone.labelPosition[1] * gridWidth / schematicImageWidth,
      y: (schematicImageHeight - zone.labelPosition[0]) * gridHeight / schematicImageHeight,
      zoneIndex,
    };
    if (zone.id !== "dpg") return [anchor];
    return [
      anchor,
      { x: 620 * gridWidth / schematicImageWidth, y: 520 * gridHeight / schematicImageHeight, zoneIndex },
    ];
  });
  const queue = new Int32Array(labels.length);
  for (let startY = 0; startY < gridHeight; startY += 1) {
    for (let startX = 0; startX < gridWidth; startX += 1) {
      const startIndex = startY * gridWidth + startX;
      if (labels[startIndex] !== -1) continue;

      let head = 0;
      let tail = 0;
      let sumX = 0;
      let sumY = 0;
      queue[tail++] = startIndex;
      labels[startIndex] = -3;
      while (head < tail) {
        const index = queue[head++];
        const x = index % gridWidth;
        const y = Math.floor(index / gridWidth);
        sumX += x;
        sumY += y;
        for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as Array<[number, number]>) {
          if (nextX < 0 || nextX >= gridWidth || nextY < 0 || nextY >= gridHeight) continue;
          const nextIndex = nextY * gridWidth + nextX;
          if (labels[nextIndex] !== -1) continue;
          labels[nextIndex] = -3;
          queue[tail++] = nextIndex;
        }
      }

      const centerX = sumX / tail;
      const centerY = sumY / tail;
      let nearestSeed = seeds[0].zoneIndex;
      let nearestDistance = Number.POSITIVE_INFINITY;
      seeds.forEach((seed) => {
        const distance = Math.hypot(centerX - seed.x, centerY - seed.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestSeed = seed.zoneIndex;
        }
      });
      if (nearestDistance > 180) {
        for (let index = 0; index < tail; index += 1) labels[queue[index]] = -2;
      } else {
        for (let index = 0; index < tail; index += 1) labels[queue[index]] = nearestSeed;
      }
    }
  }

  return { gridHeight, gridWidth, labels };
}
