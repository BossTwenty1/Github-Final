"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { getGravesiteByPlot, gravesites } from "@/lib/mock-data";

type MapExplorerProps = { initialPlot?: string };
type PlotButtonProps = { plot: string; selected: boolean; occupied: boolean; onSelect: (plot: string) => void; index: number };

const plotIds = ["A-42", "A-12", "A-18", "A-27", "A-34", "B-18", "B-03", "B-11", "B-24", "B-31", "C-07", "C-14", "C-22", "C-30", "C-39", "D-04", "D-11", "D-18", "D-25", "D-32", "E-06", "E-15", "E-23", "E-31", "E-40"];
const recordPlots = new Set(gravesites.map((record) => record.plot));

export function MapExplorer({ initialPlot = "A-42" }: MapExplorerProps) {
  const [selectedPlot, setSelectedPlot] = useState(initialPlot);
  const selectedRecord = getGravesiteByPlot(selectedPlot);

  return (
    <div className="visitor-map-page">
      <div className="map-page-heading">
        <div><p className="visitor-kicker">Forest Lake Memorial Park</p><h1>Park map</h1><p>Choose a mock plot to view its record and begin a navigation preview.</p></div>
        <Badge variant="info" icon="location">Visitor map</Badge>
      </div>
      <div className="map-stage">
        <div className="map-label map-label--top">North Gardens</div>
        <div className="map-label map-label--bottom">Whispering Pines</div>
        <div className="map-road map-road--horizontal" />
        <div className="map-road map-road--vertical" />
        <div className="plot-grid plot-grid--top">{plotIds.slice(0, 15).map((plot, index) => <PlotButton key={plot} plot={plot} selected={selectedPlot === plot} occupied={recordPlots.has(plot)} onSelect={setSelectedPlot} index={index} />)}</div>
        <div className="plot-grid plot-grid--bottom">{plotIds.slice(15).map((plot, index) => <PlotButton key={plot} plot={plot} selected={selectedPlot === plot} occupied={recordPlots.has(plot)} onSelect={setSelectedPlot} index={index} />)}</div>
        <span className="map-pin"><Icon name="location" size={26} /></span>
        <div className="map-controls"><button aria-label="Zoom in" type="button"><Icon name="plus" size={20} /></button><button aria-label="Zoom out" type="button"><Icon name="minus" size={20} /></button><button aria-label="Center map preview" type="button"><Icon name="target" size={20} /></button></div>
      </div>
      <div className="map-legend"><span><i className="legend-dot legend-dot--occupied" />Occupied</span><span><i className="legend-dot legend-dot--available" />Available</span><span><i className="legend-dot legend-dot--selected" />Selected</span></div>
      <div className="map-cta"><div><p className="visitor-kicker">Selected plot</p><h2>{selectedRecord ? selectedRecord.plotLabel : `Plot ${selectedPlot}`}</h2>{selectedRecord ? <p>{selectedRecord.name} · {selectedRecord.section}</p> : <p>Available mock plot · No record attached</p>}</div>{selectedRecord ? <Link href={`/navigation?id=${selectedRecord.id}`}><Button icon="walk">Start navigation</Button></Link> : <span className="map-cta__hint">Select an occupied plot for directions</span>}</div>
    </div>
  );
}

function PlotButton({ plot, selected, occupied, onSelect, index }: PlotButtonProps) {
  return <button aria-label={`${plot} ${occupied ? "occupied" : "available"}`} aria-pressed={selected} className={`map-plot ${occupied ? "map-plot--occupied" : "map-plot--available"} ${selected ? "map-plot--selected" : ""}`} onClick={() => onSelect(plot)} style={{ animationDelay: `${index * 18}ms` }} type="button" />;
}
