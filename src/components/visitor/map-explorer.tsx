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
  const [selectedPlot, setSelectedPlot] = useState(records.find((record) => record.plot === initialPlot)?.plot || records[0]?.plot || initialPlot);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const selectedRecord = records.find((record) => record.plot === selectedPlot);
  const plots = records.map((record) => record.plot);

  return <div className="visitor-map-page">
    <div className="map-page-heading"><div><p className="visitor-kicker">Forest Lake Memorial Park</p><h1>Park map</h1><p>{records.length ? "Select an active public record to view its available location." : "Explore the supplied cemetery plan and any verified public record locations."}</p></div><Badge variant="info" icon="location">{records.length ? "Public map data" : "Plan map reference"}</Badge></div>
    <div className="map-stage map-stage--leaflet"><CemeteryLeafletMap onSelectPlot={setSelectedPlot} onSelectZone={setSelectedZone} records={records} selectedPlot={selectedPlot} /></div>
    <div className="map-disclaimer" role="note"><strong>{selectedZone || "Plan reference"}</strong><span>{selectedZone ? "Garden area selected. " : "The supplied plan shows the gardens, roadways, walkways, and landmarks. "}GPS navigation stays unavailable until real coordinates are verified.</span></div>
    <div className="map-legend"><span><i className="legend-dot legend-dot--reference" />Supplied plan</span><span><i className="legend-dot legend-dot--record" />Mapped public record</span><span><i className="legend-dot legend-dot--selected" />Selected record</span></div>
    {plots.length ? <div className="map-plot-picker" aria-label="Active public records"><span className="map-plot-picker__label">Active records</span>{plots.map((plot) => <button aria-pressed={selectedPlot === plot} className={selectedPlot === plot ? "map-plot-chip map-plot-chip--selected" : "map-plot-chip"} key={plot} onClick={() => setSelectedPlot(plot)} type="button">{plot}</button>)}</div> : null}
    <div className="map-cta"><div><p className="visitor-kicker">Selected plot</p><h2>{selectedRecord ? selectedRecord.plotLabel : "No mapped record selected"}</h2>{selectedRecord ? <p>{selectedRecord.name} · {selectedRecord.location ? `GPS ${selectedRecord.locationVerified ? "verified" : "unverified"}` : selectedRecord.pixelLocation ? "Image-map position" : "Coordinate unavailable"}</p> : <p>Choose an active public record to view its available location details.</p>}</div>{selectedRecord ? <Link href={`/navigation?id=${selectedRecord.id}`}><Button icon="walk">Start navigation</Button></Link> : <span className="map-cta__hint">No route is shown without a mapped location</span>}</div>
  </div>;
}
