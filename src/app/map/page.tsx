import { VisitorShell } from "@/components/visitor/visitor-shell";
import { MapExplorer } from "@/components/visitor/map-explorer";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { getPublicGardenNames, searchPublicBurials } from "@/lib/supabase/public-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MapPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const value = (key: string) => Array.isArray(params[key]) ? params[key][0] : params[key] || "";
  const query = (value("query") || value("plot")).slice(0, 160);
  const section = value("section") || "all";
  const requestedPage = Number(value("page"));
  const page = Number.isInteger(requestedPage) ? Math.max(1, Math.min(requestedPage, 10000)) : 1;
  const gardens = await getPublicGardenNames();
  let results;
  try { results = await searchPublicBurials({ query, section, page }); }
  catch { return <VisitorShell><Alert title="Map records are temporarily unavailable" variant="warning">Please reload the page to try again.</Alert></VisitorShell>; }
  const pageUrl = (next: number) => `/map?${new URLSearchParams({ query, section, page: String(next) })}`;
  return <VisitorShell>
    <form action="/map" className="results-controls" aria-label="Find records on the map">
      <label className="input-field"><span className="input-label">Name or plot code</span><input className="input-control" name="query" maxLength={160} defaultValue={query} placeholder="Search all public records" /></label>
      <label className="input-field"><span className="input-label">Garden</span><select className="input-control" name="section" defaultValue={section}><option value="all">All gardens</option>{gardens.map((garden) => <option key={garden}>{garden}</option>)}</select></label>
      <button className="button button--primary" type="submit">Find on map</button>
    </form>
    <p role="status">{results.total ? `Showing ${Math.min((page - 1) * results.pageSize + 1, results.total)}–${Math.min(page * results.pageSize, results.total)} of ${results.total} matching records. Markers represent this page.` : "No matching public records. Try another name, plot code, or garden."}</p>
    <MapExplorer key={`${query}:${section}:${page}`} records={results.items} />
    <nav className="map-pagination" aria-label="Map record pages">
      {page > 1 ? <Link href={pageUrl(page - 1)}>Previous records</Link> : null}
      <span>Page {page}</span>
      {page * results.pageSize < results.total ? <Link href={pageUrl(page + 1)}>Next records</Link> : null}
    </nav>
  </VisitorShell>;
}
