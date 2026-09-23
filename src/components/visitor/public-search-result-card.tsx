import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import type { PublicBurialRecord } from "@/lib/supabase/types";

export function PublicSearchResultCard({ record, returnTo }: { record: PublicBurialRecord; returnTo?: string }) {
  const destinationVerified = Boolean(record.location && record.locationVerified);
  const matchLabel = record.matchType === "similar" ? "Similar name" : record.matchType === "exact" ? "Exact match" : "Matching record";
  const locationLabel = destinationVerified ? "Verified destination" : record.coordinateStatus === "rejected" ? "Location not valid" : record.coordinateStatus === "pending" ? "Location pending" : "No GPS recorded";
  const locationDetail = destinationVerified ? "Location is verified. Open the record before starting guidance." : record.coordinateStatus === "rejected" ? "The recorded coordinate did not pass verification; exact guidance is unavailable." : record.coordinateStatus === "pending" ? "Coordinates are awaiting verification; exact guidance stays unavailable." : "No public coordinate is recorded for this memorial.";

  return <article className="public-result-card">
    <div className="public-result-card__top">
      <div aria-label="Memorial photo unavailable" className={`public-result-card__media ${record.tone}`} role="img"><Icon name="photos" size={27} /><span>Memorial record</span></div>
      <div className="public-result-card__identity">
        <div className="public-result-card__badges"><span className={`result-status result-status--${destinationVerified ? "verified" : "pending"}`}><Icon name={destinationVerified ? "verification" : record.coordinateStatus === "rejected" ? "alert" : "clock"} size={12} />{locationLabel}</span><span className="result-match">{matchLabel}</span></div>
        <h2>{record.name}</h2>
        <p className="public-result-card__years">{record.dates}</p>
        <div className="public-result-card__metadata"><span>{record.section}</span><span>{record.plotLabel}</span></div>
      </div>
    </div>
    <div className="public-result-card__detail"><Icon name={destinationVerified ? "location" : "records"} size={17} /><span>{locationDetail}</span></div>
    <dl className="public-result-card__facts"><div><dt>Burial date</dt><dd>{record.burialDate}</dd></div><div><dt>Record status</dt><dd>{record.status}</dd></div></dl>
    <Link className="public-result-card__action" href={`/gravesite?${new URLSearchParams({ id: record.id, ...(returnTo ? { returnTo } : {}) })}`}><Icon name="records" size={17} /><span>View {record.matchType === "similar" ? "suggested " : ""}gravesite</span><Icon name="chevronRight" size={16} /></Link>
  </article>;
}
