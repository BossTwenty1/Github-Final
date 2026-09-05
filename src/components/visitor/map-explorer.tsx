"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PublicBurialRecord } from "@/lib/supabase/types";

type MapExplorerProps = { initialPlot?: string; records: PublicBurialRecord[] };
const CemeteryLeafletMap = dynamic(() => import("./cemetery-leaflet-map").then((module) => module.CemeteryLeafletMap), { ssr: false, loading: () => <div className="map-loading">Loading cemetery layout…</div> });

export function MapExplorer({ initialPlot = "A-42", records }: MapExplorerProps) {
  const [selectedRecordId, setSelectedRecordId] = useState(records.find((record) => record.plot === initialPlot)?.id || records[0]?.id || "");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const selectedRecord = records.find((record) => record.id === selectedRecordId);

  return <div className="visitor-map-page">
    <div className="map-page-heading"><div><p className="visitor-kicker">Forest Lake Memorial Park · Cemetery Phase 1</p><h1>Park map</h1><p>{records.length ? "Select an active public record to view its available location." : "Explore the KML garden, roadway, walkway, and node geometry."}</p></div><Badge variant="info" icon="location">{records.length ? "Public map data" : "KML map data"}</Badge></div>
    <div className="map-stage map-stage--leaflet"><CemeteryLeafletMap onSelectPlot={() => undefined} onSelectZone={setSelectedZone} records={records} selectedPlot={selectedRecord?.plot || ""} selectedRecordId={selectedRecordId} onSelectRecord={setSelectedRecordId} /></div>
    <div className="map-disclaimer" role="note"><strong>{selectedZone || "KML map reference"}</strong><span>{selectedZone ? "Garden area selected. " : "KML geometry shows the Phase 1 gardens, roads, walkways, and nodes. "}GPS navigation stays unavailable until real coordinates are verified.</span></div>
    <div className="map-legend"><span><i className="legend-dot legend-dot--reference" />KML garden geometry</span><span><i className="legend-dot legend-dot--record" />Mapped public record</span><span><i className="legend-dot legend-dot--selected" />Selected record</span></div>
    {records.length ? <div className="map-plot-picker" aria-label="Public records on this page"><span className="map-plot-picker__label">Select a record</span>{records.map((record) => <button aria-pressed={selectedRecordId === record.id} className={selectedRecordId === record.id ? "map-plot-chip map-plot-chip--selected" : "map-plot-chip"} key={record.id} onClick={() => setSelectedRecordId(record.id)} type="button">{record.plot} · {record.section} · {record.name}{record.matchType === "similar" ? " (similar name)" : ""}</button>)}</div> : null}
    <div className="map-cta"><div><p className="visitor-kicker">Selected plot</p><h2>{selectedRecord ? selectedRecord.plotLabel : "No mapped record selected"}</h2>{selectedRecord ? <p>{selectedRecord.name} · {selectedRecord.location ? `GPS ${selectedRecord.locationVerified ? "verified" : "unverified"}` : selectedRecord.pixelLocation ? "Image-map position" : "Coordinate unavailable"}</p> : <p>Choose a public record to view its location details.</p>}</div>{selectedRecord ? <Link href={selectedRecord.location && selectedRecord.locationVerified ? `/navigation?id=${selectedRecord.id}` : `/gravesite?id=${selectedRecord.id}`}><Button icon={selectedRecord.location && selectedRecord.locationVerified ? "walk" : "records"}>{selectedRecord.location && selectedRecord.locationVerified ? "Start navigation" : "View record"}</Button></Link> : <span className="map-cta__hint">No route is shown without a mapped location</span>}</div>
  </div>;
}
