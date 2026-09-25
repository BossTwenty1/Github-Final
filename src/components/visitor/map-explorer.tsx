"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icons";
import { canNavigateToPublicRecord } from "@/lib/public-navigation";
import type { PublicBurialRecord } from "@/lib/supabase/types";

type MapExplorerProps = {
  gardens: string[];
  initialPlot?: string;
  nextHref?: string;
  page: number;
  previousHref?: string;
  query: string;
  records: PublicBurialRecord[];
  resultSummary: string;
  section: string;
};

const CemeteryLeafletMap = dynamic(
  () =>
    import("./cemetery-leaflet-map").then(
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

export function MapExplorer({
  gardens,
  initialPlot = "A-42",
  nextHref,
  page,
  previousHref,
  query,
  records,
  resultSummary,
  section,
}: MapExplorerProps) {
  const initialRecordId =
    records.find((record) => record.plot === initialPlot)?.id ||
    records[0]?.id ||
    "";
  const [selectedRecordId, setSelectedRecordId] =
    useState(initialRecordId);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const selectedRecord = records.find(
    (record) => record.id === selectedRecordId,
  );
  const canNavigate = selectedRecord
    ? canNavigateToPublicRecord(selectedRecord)
    : false;
  const destinationStatusClassName =
    "map-destination-status map-destination-status--" +
    (canNavigate ? "verified" : "unavailable");
  const destinationActionClassName =
    "button " +
    (canNavigate ? "button--primary" : "button--secondary") +
    " button--lg";

  return (
    <div className="public-map-experience">
      <header className="public-map-heading">
        <div>
          <p>Forest Lake Memorial Park</p>
          <h1>Cemetery map</h1>
          <span>
            Explore the approved Phase 1 gardens and recorded paths. Select a
            public memorial to review its available location.
          </span>
        </div>
        <span className="map-source-badge">
          <Icon name="verification" size={15} />
          Approved Phase 1 network
        </span>
      </header>

      <div className="public-map-workspace">
        <section
          aria-label="Interactive cemetery map"
          className="public-map-canvas-column"
        >
          <div className="map-stage map-stage--leaflet public-map-stage">
            <CemeteryLeafletMap
              onSelectPlot={() => undefined}
              onSelectRecord={setSelectedRecordId}
              onSelectZone={setSelectedZone}
              records={records}
              selectedPlot={selectedRecord?.plot || ""}
              selectedRecordId={selectedRecordId}
            />
            <div className="map-stage-caption">
              <Icon name="map" size={16} />
              <span>{selectedZone || "Cemetery Phase 1"}</span>
            </div>
          </div>

          <div className="public-map-context">
            <div className="map-disclaimer" role="note">
              <Icon name="info" size={18} />
              <div>
                <strong>
                  {selectedZone || "Recorded cemetery network"}
                </strong>
                <span>
                  {selectedZone
                    ? "Garden area selected. "
                    : "The map shows approved garden, road, walkway, and node geometry. "}
                  Exact navigation remains available only for verified public
                  coordinates.
                </span>
              </div>
            </div>

            <div aria-label="Map legend" className="map-legend">
              <span>
                <i className="legend-dot legend-dot--reference" />
                Garden
              </span>
              <span>
                <i className="legend-line legend-line--road" />
                Road or path
              </span>
              <span>
                <i className="legend-dot legend-dot--record" />
                Memorial
              </span>
              <span>
                <i className="legend-dot legend-dot--selected" />
                Selected
              </span>
            </div>
          </div>
        </section>

        <aside
          aria-label="Map search and selected destination"
          className="public-map-sidebar"
        >
          <section className="map-search-panel">
            <div className="map-panel-heading">
              <div>
                <p>Find a memorial</p>
                <h2>Search this map</h2>
              </div>
              <Icon name="search" size={21} />
            </div>

            <form action="/map" className="map-search-form">
              <label>
                <span>Name or plot code</span>
                <span className="map-search-control">
                  <Icon name="search" size={18} />
                  <input
                    autoComplete="off"
                    defaultValue={query}
                    enterKeyHint="search"
                    maxLength={160}
                    name="query"
                    placeholder="Name or plot code…"
                  />
                </span>
              </label>

              <label>
                <span>Garden</span>
                <span className="map-search-control">
                  <Icon name="map" size={18} />
                  <select defaultValue={section} name="section">
                    <option value="all">All gardens</option>
                    {gardens.map((garden) => (
                      <option key={garden} value={garden}>
                        {garden}
                      </option>
                    ))}
                  </select>
                </span>
              </label>

              <button className="button button--primary" type="submit">
                <Icon name="search" size={17} />
                Find on map
              </button>
            </form>

            <p
              aria-live="polite"
              className="map-result-summary"
              role="status"
            >
              {resultSummary}
            </p>
          </section>

          <section className="map-record-panel">
            <div className="map-panel-heading">
              <div>
                <p>Visible records</p>
                <h2>
                  {records.length
                    ? "Choose a destination"
                    : "No destinations found"}
                </h2>
              </div>
              <span>{records.length}</span>
            </div>

            {records.length ? (
              <div
                aria-label="Public records on this page"
                className="map-record-list"
              >
                {records.map((record) => {
                  const selected = selectedRecordId === record.id;
                  const verified = canNavigateToPublicRecord(record);
                  const optionClassName = selected
                    ? "map-record-option map-record-option--selected"
                    : "map-record-option";
                  const statusClassName =
                    "map-record-option__status " +
                    "map-record-option__status--" +
                    (verified ? "verified" : "unavailable");

                  return (
                    <button
                      aria-pressed={selected}
                      className={optionClassName}
                      key={record.id}
                      onClick={() => setSelectedRecordId(record.id)}
                      type="button"
                    >
                      <span className="map-record-option__marker">
                        <Icon
                          name={verified ? "location" : "records"}
                          size={17}
                        />
                      </span>
                      <span>
                        <strong>{record.name}</strong>
                        <small>
                          {record.section} · {record.plotLabel}
                        </small>
                      </span>
                      <span
                        className={statusClassName}
                      >
                        {verified ? "Verified" : "Map only"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="map-empty-state">
                <Icon name="search" size={24} />
                <p>
                  Adjust the name, plot code, or garden to find a public
                  record.
                </p>
              </div>
            )}
          </section>

          <section
            aria-live="polite"
            className="map-destination-card"
          >
            <div className="map-panel-heading">
              <div>
                <p>Selected memorial</p>
                <h2>
                  {selectedRecord
                    ? selectedRecord.plotLabel
                    : "No memorial selected"}
                </h2>
              </div>
              <span
                className={destinationStatusClassName}
              >
                <Icon
                  name={canNavigate ? "verification" : "info"}
                  size={14}
                />
                {canNavigate ? "Navigation ready" : "Map reference"}
              </span>
            </div>

            {selectedRecord ? (
              <>
                <div className="map-destination-person">
                  <span className="map-destination-person__icon">
                    <Icon name="tree" size={22} />
                  </span>
                  <div>
                    <strong>{selectedRecord.name}</strong>
                    <span>{selectedRecord.dates}</span>
                  </div>
                </div>

                <dl>
                  <div>
                    <dt>Garden</dt>
                    <dd>{selectedRecord.section}</dd>
                  </div>
                  <div>
                    <dt>Plot</dt>
                    <dd>{selectedRecord.plot}</dd>
                  </div>
                </dl>

                <p>{destinationMessage(selectedRecord)}</p>
                <Link
                  className={destinationActionClassName}
                  href={
                    canNavigate
                      ? `/navigation?id=${encodeURIComponent(selectedRecord.id)}`
                      : `/gravesite?id=${encodeURIComponent(selectedRecord.id)}`
                  }
                >
                  <Icon
                    name={canNavigate ? "navigation" : "records"}
                    size={18}
                  />
                  {canNavigate ? "Start navigation" : "View gravesite"}
                </Link>
              </>
            ) : (
              <p>
                Choose a public record to view its cemetery location details.
              </p>
            )}
          </section>

          <nav
            aria-label="Map record pages"
            className="map-pagination"
          >
            <span>
              {previousHref ? (
                <Link href={previousHref} rel="prev">
                  <Icon name="arrowLeft" size={15} />
                  Previous
                </Link>
              ) : (
                <span aria-disabled="true">Previous</span>
              )}
            </span>
            <strong>Page {page}</strong>
            <span>
              {nextHref ? (
                <Link href={nextHref} rel="next">
                  Next
                  <Icon name="chevronRight" size={15} />
                </Link>
              ) : (
                <span aria-disabled="true">Next</span>
              )}
            </span>
          </nav>
        </aside>
      </div>
    </div>
  );
}

function destinationMessage(record: PublicBurialRecord) {
  if (
    record.location &&
    record.locationVerified &&
    record.coordinateStatus === "verified"
  ) {
    return "This public coordinate is verified and eligible for recorded-path guidance.";
  }

  if (record.coordinateStatus === "pending") {
    return (
      "A coordinate exists, but navigation remains unavailable while " +
      "cemetery verification is pending."
    );
  }

  if (record.coordinateStatus === "rejected") {
    return (
      "The recorded coordinate did not pass verification, so exact " +
      "guidance remains unavailable."
    );
  }

  return (
    "No public GPS destination is recorded. The garden and plot remain " +
    "available as map references."
  );
}
