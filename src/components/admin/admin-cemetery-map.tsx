"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { loadPhaseOneMapData, loadPhaseOneMapDataFromSupabase, type PhaseOneMapData } from "@/lib/phase1-map-data";
import { getAdminRecords } from "@/lib/supabase/admin-data";
import type { AdminRecord, PublicBurialRecord } from "@/lib/supabase/types";

const CemeteryLeafletMap = dynamic(() => import("@/components/visitor/cemetery-leaflet-map").then((module) => module.CemeteryLeafletMap), {
  ssr: false,
  loading: () => <div className="map-loading">Loading cemetery layout…</div>,
});

export function AdminCemeteryMap() {
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [selectedPlot, setSelectedPlot] = useState("");
  const [selectedGarden, setSelectedGarden] = useState<string | null>(null);
  const [mapData, setMapData] = useState<PhaseOneMapData | null>(null);
  const [mapSource, setMapSource] = useState<"database" | "fallback" | "loading">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getAdminRecords().then((result) => {
      if (active) setRecords(result);
    }).catch((reason: unknown) => {
      if (active) setError(errorMessage(reason));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void loadPhaseOneMapDataFromSupabase().then((result) => {
      if (!active) return;
      setMapData(result);
      setMapSource("database");
    }).catch(() => loadPhaseOneMapData().then((result) => {
      if (!active) return;
      setMapData(result);
      setMapSource("fallback");
    }).catch((reason: unknown) => {
      if (!active) return;
      setMapSource("fallback");
      setError((current) => current || errorMessage(reason));
    }));
    return () => {
      active = false;
    };
  }, []);

  const mappedRecords = records.map(toPublicRecord);
  const selectedRecord = records.find((record) => record.plot === selectedPlot);
  const recordsWithGps = records.filter((record) => record.location);

  return <>
    {error ? <Alert title="Supabase data unavailable" variant="danger">{error}</Alert> : null}
    <div className="map-stage map-stage--leaflet admin-map-stage">
      <CemeteryLeafletMap
        onSelectPlot={setSelectedPlot}
        onSelectZone={setSelectedGarden}
        mapData={mapData}
        records={mappedRecords}
        selectedPlot={selectedPlot}
      />
    </div>
    <div className="map-disclaimer" role="note">
      <strong>{selectedRecord?.plot || selectedGarden || "Phase 1 map"}</strong>
      <span>{selectedRecord ? `${selectedRecord.name} selected. ` : selectedGarden ? "Garden area selected. " : "The Phase 1 network is loaded from the administrator data source. "}{mapSource === "database" ? "Source: Supabase map tables. " : mapSource === "fallback" ? "Source: local cleaned GeoJSON fallback. " : "Loading map source. "}Only real database GPS coordinates are plotted; missing coordinates are not fabricated.</span>
    </div>
    <div className="map-legend">
      <span><i className="legend-dot legend-dot--reference" />KML garden, road, and walkway geometry</span>
      <span><i className="legend-dot legend-dot--record" />Database GPS record</span>
      <span><i className="legend-dot legend-dot--selected" />Selected record</span>
    </div>
    <Alert icon="info" title="Coordinate policy" variant="info">This protected view shows the supplied Phase 1 geometry and existing database coordinates. Coordinate verification remains a separate administrator workflow.</Alert>
    {recordsWithGps.length ? <Card><Table caption="Burial records with GPS locations"><TableHead><TableRow><TableHeaderCell>Plot</TableHeaderCell><TableHeaderCell>Record</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Coordinate state</TableHeaderCell></TableRow></TableHead><TableBody>{recordsWithGps.map((record) => <TableRow key={record.burialId}><TableCell>{record.plot}</TableCell><TableCell>{record.name}<span className="table-secondary">{record.section}</span></TableCell><TableCell><Badge variant={record.recordStatus === "active" ? "success" : record.recordStatus === "pending" ? "warning" : "neutral"}>{record.recordStatus}</Badge></TableCell><TableCell><Badge variant={record.coordinateVerified ? "success" : "warning"}>{record.coordinateVerified ? "verified" : record.coordinateStatus}</Badge></TableCell></TableRow>)}</TableBody></Table></Card> : <EmptyState description="Add verified or unverified GPS coordinates to plots to see record markers here." icon="map" title="No coordinate-bearing records" />}
  </>;
}

function toPublicRecord(record: AdminRecord): PublicBurialRecord {
  return {
    id: String(record.burialId),
    name: record.name,
    birthDate: record.birthDate,
    deathDate: record.deathDate,
    dates: record.intermentDate || "Date not recorded",
    plot: record.plot,
    plotLabel: record.plot,
    section: record.section,
    row: "",
    burialDate: record.intermentDate || "",
    status: "Active",
    location: record.location,
    pixelLocation: record.pixelLocation,
    locationVerified: record.coordinateVerified,
    tone: "",
  };
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "The administrator map could not load its Supabase records.";
}
