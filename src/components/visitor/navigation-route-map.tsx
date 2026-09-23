"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { findShortestPhaseOneRoute } from "@/lib/phase1-routing";
import { loadPhaseOneMapData, projectPhaseOneLocation, type PhaseOneMapData } from "@/lib/phase1-map-data";
import { nearPlot, usablePosition, subscribeToLocation, type GpsPosition } from "@/lib/navigation-geo";
import type { PublicBurialRecord } from "@/lib/supabase/types";

const CemeteryLeafletMap = dynamic(() => import("@/components/visitor/cemetery-leaflet-map").then((module) => module.CemeteryLeafletMap), {
  ssr: false, loading: () => <div className="map-loading">Loading cemetery layout…</div>,
});
export function NavigationRouteMap({ record }: { record: PublicBurialRecord }) {
  const [mapData, setMapData] = useState<PhaseOneMapData | null>(null);
  const [origin, setOrigin] = useState<GpsPosition | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [locationError, setLocationError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [recenter, setRecenter] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const controller = new AbortController();
    void loadPhaseOneMapData(controller.signal).then(setMapData).catch((reason) => {
      if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : "The map could not be loaded.");
    });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!enabled || !record.location || !navigator.geolocation) return;
    let active = true;
    const stopWatching = subscribeToLocation(navigator.geolocation, (next) => {
      if (!active) return;
      if (!usablePosition(next)) { setLocationError("Waiting for a fresh GPS reading."); return; }
      setOrigin(next); setLocationError(""); setNow(Date.now());
    }, (error) => {
      if (active) {
        setOrigin(null);
        setLocationError(error.code === 1 ? "Location permission was denied. You can follow the route from the main entrance." : "Your location is unavailable. Try again in an open area.");
      }
    });
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => { active = false; stopWatching(); window.clearInterval(timer); };
  }, [enabled, record.location]);
  const fresh = enabled && origin && usablePosition(origin, now) ? origin : null;
  const inside = fresh && mapData ? Boolean(projectPhaseOneLocation(mapData, fresh)) : false;
  const route = useMemo(() => enabled && mapData && record.location
    ? findShortestPhaseOneRoute(mapData, record.location, fresh && inside && fresh.accuracy <= 30 ? fresh : undefined)
    : null, [enabled, mapData, record.location, fresh, inside]);
  const isNear = fresh && record.location ? nearPlot(fresh, record.location, now) : false;
  const message = !enabled ? "Navigation stopped. Your location is no longer being watched."
    : !record.location ? "This gravesite does not yet have a recorded GPS coordinate."
    : loadError ? loadError
    : locationError || (origin && !fresh ? "Your last location is out of date. Waiting for a fresh reading."
    : fresh && !inside ? "You are outside the mapped area. The route starts at the main entrance."
    : fresh && fresh.accuracy > 30 ? "GPS accuracy is low. The route starts at the main entrance until a better reading is available."
    : fresh ? "Your position updates while you walk." : "Allow location access to navigate from your position. The main entrance is used while location is unavailable.");
  return <>
    <div className="navigation-map navigation-map--interactive">
      <CemeteryLeafletMap mapData={mapData} onSelectPlot={() => undefined} onSelectZone={() => undefined} records={[record]} route={route} selectedPlot={record.plot} userLocation={fresh} recenterRequest={recenter} />
    </div>
    <div className="navigation-back-actions">
      <Button disabled={!fresh || !inside} onClick={() => setRecenter((value) => value + 1)} variant="secondary">Recenter</Button>
      <Button onClick={() => { setEnabled((value) => !value); setOrigin(null); setLocationError(""); }}>{enabled ? "Stop navigation" : "Start navigation"}</Button>
    </div>
    <div aria-live="polite"><Alert title={isNear ? "You are near the plot—check the marker" : "Walking directions"} variant={isNear ? "success" : "info"}>{message}</Alert></div>
    {route ? <div className="fallback-card navigation-route-summary"><strong>Recorded path route{route.distanceM === null ? "" : " · approximately " + Math.round(route.distanceM) + " m along paths"}</strong>
      <ol>{route.instructions.map((instruction, index) => <li key={index}>{instruction}</li>)}<li>Continue to the end of the highlighted path near {record.plotLabel}.</li><li>The final approach is not verified. Check the plot label and use a visibly walkable approach; do not follow a shortcut through neighbouring graves.</li></ol>
    </div> : enabled && mapData && record.location ? <Alert title="No connected route">A connected route could not be found. Ask cemetery staff for help.</Alert> : null}
  </>;
}
