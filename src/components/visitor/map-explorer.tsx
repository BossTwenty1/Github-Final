"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import type { PublicBurialRecord } from "@/lib/supabase/types";

type MapExplorerProps = { initialPlot?: string; records: PublicBurialRecord[] };
type PlotButtonProps = { plot: string; selected: boolean; occupied: boolean; onSelect: (plot: string) => void; index: number };
const fallbackPlotIds = ["A-42", "A-12", "A-18", "A-27", "A-34", "B-18", "B-03", "B-11", "B-24", "B-31", "C-07", "C-14", "C-22", "C-30", "C-39", "D-04", "D-11", "D-18", "D-25", "D-32", "E-06", "E-15", "E-23", "E-31", "E-40"];

export function MapExplorer({ initialPlot = "A-42", records }: MapExplorerProps) {
  const [selectedPlot, setSelectedPlot] = useState(initialPlot);
  const selectedRecord = records.find((record) => record.plot === selectedPlot);
  const plots = records.length ? records.map((record) => record.plot) : fallbackPlotIds;

  return <div className="visitor-map-page">
    <div className="map-page-heading"><div><p className="visitor-kicker">Forest Lake Memorial Park</p><h1>Park map</h1><p>{records.length ? "Select an active public record to view its available location." : "No local coordinates are available yet, so the layout prototype remains visible."}</p></div><Badge variant="info" icon="location">{records.length ? "Public map data" : "Layout prototype"}</Badge></div>
    <div className="map-stage"><div className="map-label map-label--top">North Gardens</div><div className="map-label map-label--bottom">Whispering Pines</div><div className="map-road map-road--horizontal" /><div className="map-road map-road--vertical" /><div className="plot-grid plot-grid--top">{plots.slice(0, 15).map((plot, index) => <PlotButton key={plot} plot={plot} selected={selectedPlot === plot} occupied={records.some((record) => record.plot === plot)} onSelect={setSelectedPlot} index={index} />)}</div><div className="plot-grid plot-grid--bottom">{plots.slice(15).map((plot, index) => <PlotButton key={plot} plot={plot} selected={selectedPlot === plot} occupied={records.some((record) => record.plot === plot)} onSelect={setSelectedPlot} index={index} />)}</div><span className="map-pin"><Icon name="location" size={26} /></span><div className="map-controls"><button aria-label="Zoom in" type="button"><Icon name="plus" size={20} /></button><button aria-label="Zoom out" type="button"><Icon name="minus" size={20} /></button><button aria-label="Center map preview" type="button"><Icon name="target" size={20} /></button></div></div>
    <div className="map-legend"><span><i className="legend-dot legend-dot--occupied" />Active public record</span><span><i className="legend-dot legend-dot--available" />Prototype plot</span><span><i className="legend-dot legend-dot--selected" />Selected</span></div>
    <div className="map-cta"><div><p className="visitor-kicker">Selected plot</p><h2>{selectedRecord ? selectedRecord.plotLabel : `Plot ${selectedPlot}`}</h2>{selectedRecord ? <p>{selectedRecord.name} · {selectedRecord.location ? `GPS ${selectedRecord.locationVerified ? "verified" : "unverified"}` : selectedRecord.pixelLocation ? "Image-map position" : "Coordinate unavailable"}</p> : <p>Prototype plot · No active public record attached</p>}</div>{selectedRecord ? <Link href={`/navigation?id=${selectedRecord.id}`}><Button icon="walk">Start navigation</Button></Link> : <span className="map-cta__hint">Select an occupied plot for directions</span>}</div>
  </div>;
}

function PlotButton({ plot, selected, occupied, onSelect, index }: PlotButtonProps) {
  return <button aria-label={`${plot} ${occupied ? "occupied" : "available"}`} aria-pressed={selected} className={`map-plot ${occupied ? "map-plot--occupied" : "map-plot--available"} ${selected ? "map-plot--selected" : ""}`} onClick={() => onSelect(plot)} style={{ animationDelay: `${index * 18}ms` }} type="button" />;
}
