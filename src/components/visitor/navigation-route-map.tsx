"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Icon } from "@/components/ui/icons";
import { findShortestPhaseOneRoute, type PhaseOneRoute } from "@/lib/phase1-routing";
import { loadPhaseOneMapData, type PhaseOneMapData } from "@/lib/phase1-map-data";
import type { PublicBurialRecord } from "@/lib/supabase/types";

const CemeteryLeafletMap = dynamic(() => import("@/components/visitor/cemetery-leaflet-map").then((module) => module.CemeteryLeafletMap), {
  ssr: false,
  loading: () => <div className="map-loading">Loading cemetery layout…</div>,
});

export function NavigationRouteMap({ record }: { record: PublicBurialRecord }) {
  const [mapData, setMapData] = useState<PhaseOneMapData | null>(null);
  const [route, setRoute] = useState<PhaseOneRoute | null>(null);
  const [origin, setOrigin] = useState<{ longitude: number; latitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"pending" | "ready" | "unavailable">(() => typeof navigator !== "undefined" && navigator.geolocation ? "pending" : "unavailable");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((position) => {
      if (!active) return;
      setOrigin({ longitude: position.coords.longitude, latitude: position.coords.latitude });
      setLocationStatus("ready");
    }, () => { if (active) setLocationStatus("unavailable"); }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 });
    void loadPhaseOneMapData().then((data) => {
      if (!active) return;
      setMapData(data);
      setRoute(record.location ? findShortestPhaseOneRoute(data, record.location) : null);
    }).catch((reason: unknown) => {
      if (!active) return;
      setLoadError(reason instanceof Error ? reason.message : "The map could not be loaded.");
    });
    return () => {
      active = false;
    };
  }, [record.location]);

  const displayedRoute = mapData && record.location ? findShortestPhaseOneRoute(mapData, record.location, origin || undefined) : route;

  const routeMessage = !record.location
    ? "Routing is unavailable because this record does not have a GPS coordinate."
    : loadError
      ? "The verified Phase 1 network could not be loaded."
        : locationStatus === "pending"
          ? "Requesting your location to calculate directions…"
          : !mapData
        ? "Preparing the verified Phase 1 network…"
        : displayedRoute
          ? `Route found from ${displayedRoute.startNodeName} to ${displayedRoute.targetNodeName}${displayedRoute.distanceM === null ? "." : ` · approximately ${Math.round(displayedRoute.distanceM)} m.`}`
          : "No connected route was found in the verified Phase 1 network.";

  return <>
    <div className="navigation-map navigation-map--interactive">
      <CemeteryLeafletMap mapData={mapData} onSelectPlot={() => undefined} onSelectZone={() => undefined} records={[record]} route={displayedRoute} selectedPlot={record.plot} />
      <div className="navigation-map__label"><Icon name="location" size={18} />{record.plotLabel}</div>
    </div>
    <Alert icon="walk" title="Walking directions" variant={displayedRoute ? "success" : "info"}>{routeMessage} {locationStatus === "unavailable" ? "Allow location access for directions from your current position; the main entrance is used as a fallback." : "The route follows recorded Phase 1 road and walkway segments, with a short connection from your position to the network and from the network to the grave."}</Alert>
  </>;
}
