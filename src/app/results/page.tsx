import Link from "next/link";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { searchPublicBurials } from "@/lib/supabase/public-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
export default async function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = getParam(params.query).slice(0, 160);
  const section = getParam(params.section) || "all";
  const year = getParam(params.year) || "any";
  const sort = getParam(params.sort) === "newest" ? "newest" : "name";
  const page = Math.max(1, Math.min(10000, Number.parseInt(getParam(params.page), 10) || 1));
  const url = (nextPage: number, nextSort = sort) => "/results?" + new URLSearchParams({ query, section, year, sort: nextSort, page: String(nextPage) });
  let result;
  try { result = await searchPublicBurials({ query, section, year, sort, page }); }
  catch { return <VisitorShell><Alert icon="alert" title="Search unavailable" variant="danger">Search is temporarily unavailable—try again. <Link href={url(page)}>Retry search</Link></Alert></VisitorShell>; }
  const { items, total, pageSize } = result;
  return <VisitorShell><div className="visitor-stack">
    <form action="/results" className="results-search" method="get">
      <Input aria-label="Name or plot code" defaultValue={query} maxLength={160} name="query" placeholder="Search by name or plot code" icon="search" />
      <input name="section" type="hidden" value={section} /><input name="year" type="hidden" value={year} /><input name="sort" type="hidden" value={sort} />
      <button className="button button--primary" type="submit">Search</button>
    </form>
    <div className="results-heading"><div><p className="visitor-kicker">Active public records</p><h1>{total} results for “{query || "all records"}”</h1><p>Exact matches appear first. Similar names are suggestions—check the dates, garden, and plot.</p></div>
      <div className="results-controls"><Link href="/search">Change filters</Link><Link href={url(1, sort === "newest" ? "name" : "newest")}>{sort === "newest" ? "Sort by name" : "Newest first"}</Link></div>
    </div>
    {!items.length ? <Alert title={total ? "No results on this page" : "No matching records"}>Try a shorter name, a plot code, or different filters. {total ? <Link href={url(1)}>Return to page 1</Link> : null}</Alert> : null}
    <div className="results-list">{items.map((record) => <Card className="result-card" key={record.id}><div className="result-body">
      <Badge variant={record.matchType === "similar" ? "warning" : "info"}>{record.matchType === "similar" ? "Similar name suggestion" : record.matchType === "exact" ? "Exact match" : "Matching record"}</Badge>
      <h2>{record.name}</h2><p className="result-years">{record.dates}</p>
      <p><strong>{record.plotLabel}</strong> · {record.section}</p><p>Burial date: {record.burialDate}</p>
      <p>{record.location ? record.locationVerified ? "GPS location verified" : "GPS location awaiting verification" : "Location not recorded"}</p>
      <Link className="button button--primary" href={"/gravesite?id=" + record.id}>View {record.matchType === "similar" ? "suggested " : ""}gravesite</Link>
    </div></Card>)}</div>
    <nav aria-label="Search result pages" className="results-controls">
      {page > 1 ? <Link rel="prev" href={url(page - 1)}>Previous</Link> : null}
      <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
      {page * pageSize < total ? <Link rel="next" href={url(page + 1)}>Next</Link> : null}
    </nav>
  </div></VisitorShell>;
}
function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
