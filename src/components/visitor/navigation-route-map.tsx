"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Icon } from "@/components/ui/icons";
import {
  nearPlot,
  subscribeToLocation,
  usablePosition,
  type GpsPosition,
} from "@/lib/navigation-geo";
import {
  loadPhaseOneMapData,
  projectPhaseOneLocation,
  type PhaseOneMapData,
} from "@/lib/phase1-map-data";
import { findShortestPhaseOneRoute } from "@/lib/phase1-routing";
import { canNavigateToPublicRecord } from "@/lib/public-navigation";
import type { PublicBurialRecord } from "@/lib/supabase/types";

const CemeteryLeafletMap = dynamic(
  () =>
    import("@/components/visitor/cemetery-leaflet-map").then(
      (module) => module.CemeteryLeafletMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div aria-live="polite" className="map-loading">
        <span className="map-loading__spinner" />
        Loading cemetery layout…
      </div>
    ),
  },
);

export function NavigationRouteMap({
  record,
}: {
  record: PublicBurialRecord;
}) {
  const canNavigate = canNavigateToPublicRecord(record);
  const geolocationAvailable = useSyncExternalStore(
    subscribeToBrowserCapability,
    () => Boolean(navigator.geolocation),
    () => true,
  );
  const [mapData, setMapData] = useState<PhaseOneMapData | null>(null);
  const [origin, setOrigin] = useState<GpsPosition | null>(null);
  const [enabled, setEnabled] = useState(canNavigate);
  const [locationError, setLocationError] = useState("");
  const [locationErrorCode, setLocationErrorCode] =
    useState<number | null>(null);
  const [loadError, setLoadError] = useState("");
  const [recenter, setRecenter] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    void loadPhaseOneMapData(controller.signal)
      .then(setMapData)
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "The cemetery network could not be loaded.",
          );
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!canNavigate || !enabled || !record.location) return;
    if (!navigator.geolocation) return;

    let active = true;
    const stopWatching = subscribeToLocation(
      navigator.geolocation,
      (next) => {
        if (!active) return;

        if (!usablePosition(next)) {
          setLocationError("Waiting for a fresh GPS reading.");
          return;
        }

        setOrigin(next);
        setLocationError("");
        setLocationErrorCode(null);
        setNow(Date.now());
      },
      (error) => {
        if (!active) return;

        setOrigin(null);
        setLocationErrorCode(error.code);
        setLocationError(
          error.code === 1
            ? "Location permission was denied. Guidance will begin at the main entrance."
            : "Your location is unavailable. Try again in an open area.",
        );
      },
    );
    const timer = window.setInterval(() => setNow(Date.now()), 5000);

    return () => {
      active = false;
      stopWatching();
      window.clearInterval(timer);
    };
  }, [canNavigate, enabled, record.location]);

  const fresh =
    enabled && origin && usablePosition(origin, now) ? origin : null;
  const inside =
    fresh && mapData
      ? Boolean(projectPhaseOneLocation(mapData, fresh))
      : false;
  const route = useMemo(
    () =>
      canNavigate && enabled && mapData && record.location
        ? findShortestPhaseOneRoute(
            mapData,
            record.location,
            fresh && inside && fresh.accuracy <= 30 ? fresh : undefined,
          )
        : null,
    [canNavigate, enabled, mapData, record.location, fresh, inside],
  );
  const isNear = Boolean(
    fresh &&
      record.location &&
      nearPlot(fresh, record.location, now),
  );
  const state = navigationState({
    canNavigate,
    enabled,
    fresh,
    geolocationAvailable,
    inside,
    isNear,
    loadError,
    locationError,
    locationErrorCode,
    mapData,
    origin,
    route,
  });
  const eligibilityClassName =
    "gps-eligibility-badge gps-eligibility-badge--" +
    (canNavigate ? "verified" : "unavailable");

  function toggleNavigation() {
    setEnabled((value) => !value);
    setOrigin(null);
    setLocationError("");
    setLocationErrorCode(null);
  }

  return (
    <div className="gps-navigation-experience">
      <header className="gps-navigation-heading">
        <div>
          <p>Recorded-path guidance</p>
          <h1>Navigate to {record.plotLabel}</h1>
          <span>
            {record.name} · {record.section} · {record.row}
          </span>
        </div>
        <span
          className={eligibilityClassName}
        >
          <Icon
            name={canNavigate ? "verification" : "alert"}
            size={15}
          />
          {canNavigate ? "Verified destination" : "Navigation unavailable"}
        </span>
      </header>

      <div className="gps-navigation-workspace">
        <section aria-label="Navigation map" className="gps-map-column">
          <div className="gps-destination-strip">
            <span>
              <Icon name="location" size={18} />
            </span>
            <div>
              <small>Destination</small>
              <strong>
                {record.plotLabel} · {record.name}
              </strong>
            </div>
          </div>

          <div className="navigation-map navigation-map--interactive gps-map-stage">
            <CemeteryLeafletMap
              accessibleLabel={`Recorded cemetery route to ${record.plotLabel}`}
              mapData={mapData}
              onSelectPlot={() => undefined}
              onSelectZone={() => undefined}
              recenterRequest={recenter}
              records={[record]}
              route={route}
              selectedPlot={record.plot}
              userLocation={fresh}
            />
            <div
              aria-live="polite"
              className={`gps-map-status gps-map-status--${state.tone}`}
            >
              <span>
                <Icon name={state.icon} size={16} />
              </span>
              <div>
                <strong>{state.title}</strong>
                <small>{state.shortMessage}</small>
              </div>
            </div>
          </div>

          {canNavigate ? (
            <div className="gps-map-actions">
              <button
                className="map-control-action"
                disabled={!fresh || !inside}
                onClick={() => setRecenter((value) => value + 1)}
                type="button"
              >
                <Icon name="target" size={18} />
                Recenter on me
              </button>
              <button
                className={
                  enabled
                    ? "map-control-action map-control-action--stop"
                    : "map-control-action map-control-action--start"
                }
                onClick={toggleNavigation}
                type="button"
              >
                <Icon
                  name={enabled ? "close" : "navigation"}
                  size={18}
                />
                {enabled ? "Stop navigation" : "Start navigation"}
              </button>
            </div>
          ) : null}
        </section>

        <aside
          aria-label="Navigation status and directions"
          className="gps-navigation-sidebar"
        >
          <section
            aria-live="polite"
            className={`gps-status-card gps-status-card--${state.tone}`}
          >
            <span className="gps-status-card__icon">
              <Icon name={state.icon} size={24} />
            </span>
            <div>
              <p>{state.label}</p>
              <h2>{state.title}</h2>
              <span>{state.message}</span>
              {fresh ? (
                <small>
                  Reported accuracy: approximately{" "}
                  {Math.round(fresh.accuracy)} m · updates automatically
                </small>
              ) : null}
            </div>
          </section>

          {route ? (
            <section className="gps-route-card">
              <div className="gps-route-card__summary">
                <div>
                  <p>Recorded route</p>
                  <h2>
                    {route.distanceM === null
                      ? "Path available"
                      : `About ${Math.round(route.distanceM)} m`}
                  </h2>
                </div>
                <span>
                  <Icon name="walk" size={20} />
                  No ETA estimated
                </span>
              </div>

              <div className="gps-active-instruction">
                <span>
                  <Icon name="navigation" size={24} />
                </span>
                <div>
                  <strong>Follow the highlighted cemetery path</strong>
                  <p>
                    {route.startNodeName} to {route.targetNodeName}. The map
                    recalculates from a usable in-park GPS reading.
                  </p>
                </div>
              </div>

              <div className="gps-instruction-list">
                <div className="map-panel-heading">
                  <div>
                    <p>Recorded wayfinding</p>
                    <h3>Path instructions</h3>
                  </div>
                  <span>{Math.max(1, route.instructions.length)}</span>
                </div>
                <ol>
                  {route.instructions.length ? (
                    route.instructions.map((instruction, index) => (
                      <li key={`${instruction}-${index}`}>
                        <span>{index + 1}</span>
                        <p>{instruction}</p>
                      </li>
                    ))
                  ) : (
                    <li>
                      <span>1</span>
                      <p>
                        Continue along the highlighted recorded path toward{" "}
                        {route.targetNodeName}.
                      </p>
                    </li>
                  )}
                  <li>
                    <span>{route.instructions.length + 1}</span>
                    <p>
                      Stop at the end of the highlighted path near{" "}
                      {record.plotLabel}. Check the physical marker and use
                      only a visibly walkable final approach.
                    </p>
                  </li>
                </ol>
              </div>
            </section>
          ) : (
            <section className="gps-route-placeholder">
              <Icon name={canNavigate ? "map" : "shield"} size={24} />
              <div>
                <h2>
                  {canNavigate
                    ? "Route will appear on the map"
                    : "Exact guidance is safely locked"}
                </h2>
                <p>
                  {canNavigate
                    ? "A recorded route begins at the main entrance while " +
                      "GPS permission, accuracy, or position is unavailable."
                    : coordinateUnavailableMessage(record)}
                </p>
              </div>
            </section>
          )}

          <section className="gps-destination-card">
            <div className="map-panel-heading">
              <div>
                <p>Gravesite details</p>
                <h2>{record.name}</h2>
              </div>
              <Icon name="tree" size={22} />
            </div>

            <dl>
              <div>
                <dt>Garden</dt>
                <dd>{record.section}</dd>
              </div>
              <div>
                <dt>Block / row</dt>
                <dd>{record.row}</dd>
              </div>
              <div>
                <dt>Plot</dt>
                <dd>{record.plot}</dd>
              </div>
            </dl>

            <div className="gps-destination-actions">
              <Link
                className="button button--secondary"
                href={`/gravesite?id=${encodeURIComponent(record.id)}`}
              >
                <Icon name="records" size={17} />
                View gravesite
              </Link>
              <Link
                className="button button--secondary"
                href={`/map?plot=${encodeURIComponent(record.plot)}`}
              >
                <Icon name="map" size={17} />
                Back to map
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function subscribeToBrowserCapability() {
  return () => undefined;
}

type NavigationStateInput = {
  canNavigate: boolean;
  enabled: boolean;
  fresh: GpsPosition | null;
  geolocationAvailable: boolean;
  inside: boolean;
  isNear: boolean;
  loadError: string;
  locationError: string;
  locationErrorCode: number | null;
  mapData: PhaseOneMapData | null;
  origin: GpsPosition | null;
  route: ReturnType<typeof findShortestPhaseOneRoute>;
};

type NavigationPresentationState = {
  icon:
    | "alert"
    | "clock"
    | "location"
    | "map"
    | "shield"
    | "target"
    | "verification";
  label: string;
  message: string;
  shortMessage: string;
  title: string;
  tone: "danger" | "pending" | "ready" | "stopped" | "warning";
};

function navigationState(
  input: NavigationStateInput,
): NavigationPresentationState {
  if (!input.canNavigate) {
    return {
      icon: "shield",
      label: "Coordinate safety",
      title: "Navigation unavailable",
      shortMessage: "Destination is not verified",
      message:
        "This public memorial is not eligible for exact navigation. " +
        "Review its recorded garden and plot on the cemetery map instead.",
      tone: "warning",
    };
  }

  if (!input.enabled) {
    return {
      icon: "map",
      label: "Navigation stopped",
      title: "Location sharing is off",
      shortMessage: "GPS watch stopped",
      message:
        "Your browser location is no longer being watched. Start " +
        "navigation again when you are ready.",
      tone: "stopped",
    };
  }

  if (input.loadError) {
    return {
      icon: "alert",
      label: "Map unavailable",
      title: "The cemetery network could not load",
      shortMessage: "Route map unavailable",
      message: input.loadError,
      tone: "danger",
    };
  }

  if (input.isNear) {
    return {
      icon: "target",
      label: "Arrival check",
      title: "You are near the recorded plot",
      shortMessage: "Check the physical marker",
      message:
        "GPS indicates that you are near the destination. Confirm the plot " +
        "label and physical memorial marker before stopping.",
      tone: "ready",
    };
  }

  if (!input.geolocationAvailable) {
    return {
      icon: "location",
      label: "GPS unavailable",
      title: "Browser geolocation is unavailable",
      shortMessage: "Using main entrance",
      message:
        "This browser cannot provide a live location. Recorded-path " +
        "guidance begins at the main entrance.",
      tone: "warning",
    };
  }

  if (input.locationErrorCode === 1) {
    return {
      icon: "alert",
      label: "Location permission",
      title: "Location access was denied",
      shortMessage: "Using main entrance",
      message: input.locationError,
      tone: "warning",
    };
  }

  if (input.locationError) {
    return {
      icon: "location",
      label: "GPS unavailable",
      title: "Current location is unavailable",
      shortMessage: "Using main entrance",
      message: input.locationError,
      tone: "warning",
    };
  }

  if (input.origin && !input.fresh) {
    return {
      icon: "clock",
      label: "Location freshness",
      title: "Waiting for a fresh GPS reading",
      shortMessage: "Last reading is stale",
      message:
        "The last browser location is more than 30 seconds old. Guidance " +
        "remains anchored at the main entrance until a fresh reading arrives.",
      tone: "pending",
    };
  }

  if (input.fresh && !input.inside) {
    return {
      icon: "location",
      label: "Location boundary",
      title: "You are outside the mapped cemetery area",
      shortMessage: "Using main entrance",
      message:
        "The highlighted route begins at the recorded main entrance until " +
        "your position is inside the approved Phase 1 map.",
      tone: "warning",
    };
  }

  if (input.fresh && input.fresh.accuracy > 30) {
    return {
      icon: "alert",
      label: "GPS accuracy",
      title: "Waiting for a more accurate reading",
      shortMessage: `Accuracy about ${Math.round(input.fresh.accuracy)} m`,
      message:
        "Current accuracy is too low to route from your position. Guidance " +
        "remains anchored at the main entrance.",
      tone: "warning",
    };
  }

  if (input.fresh && input.route) {
    return {
      icon: "verification",
      label: "Live guidance",
      title: "Your position is updating",
      shortMessage: "Route follows recorded paths",
      message:
        "GraveNav is recalculating along the approved Phase 1 network as " +
        "usable GPS readings arrive.",
      tone: "ready",
    };
  }

  if (input.mapData && !input.route) {
    return {
      icon: "alert",
      label: "Route status",
      title: "No connected route is available",
      shortMessage: "Ask cemetery staff for help",
      message:
        "The approved network could not produce a connected path to this destination.",
      tone: "danger",
    };
  }

  return {
    icon: "clock",
    label: "Location request",
    title: "Waiting for your location",
    shortMessage: "Main entrance route is ready",
    message:
      "Allow browser location access to route from your position. Until " +
      "then, guidance begins at the recorded main entrance.",
    tone: "pending",
  };
}

function coordinateUnavailableMessage(record: PublicBurialRecord) {
  if (!record.location) {
    return "No public GPS destination is recorded for this memorial.";
  }

  if (record.coordinateStatus === "pending") {
    return "The coordinate is awaiting cemetery verification.";
  }

  if (record.coordinateStatus === "rejected") {
    return "The recorded coordinate did not pass cemetery verification.";
  }

  return "The destination is not eligible for exact navigation.";
}
