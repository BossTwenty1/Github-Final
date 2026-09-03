import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { getPublicBurialRecords } from "@/lib/supabase/public-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = getParam(params?.query);
  const section = getParam(params?.section) || "all";
  const year = getParam(params?.year) || "any";
  const sort = getParam(params?.sort) === "newest" ? "newest" as const : "name" as const;
  const matches = await getPublicBurialRecords({ query, section, year, sort });
  if (!matches.length) redirect(`/record-not-found?query=${encodeURIComponent(query || "that name")}`);
  const searchLabel = query || "all records";

  return <VisitorShell><div className="visitor-stack"><form action="/results" className="results-search" method="get"><Input aria-label="Search results" defaultValue={query} name="query" placeholder="Search by name" icon="search" /><input name="section" type="hidden" value={section} /><input name="year" type="hidden" value={year} /><input name="sort" type="hidden" value={sort} /></form><div className="results-heading"><div><p className="visitor-kicker">Active public records</p><h1>Showing {matches.length} {matches.length === 1 ? "result" : "results"} for <span>“{searchLabel}”</span></h1></div><div className="results-controls"><Link href="/search"><Button icon="filter" size="sm" type="button" variant="secondary">Filter</Button></Link><Link href={`/results?query=${encodeURIComponent(query)}&section=${encodeURIComponent(section)}&year=${encodeURIComponent(year)}&sort=${sort === "newest" ? "name" : "newest"}`}><Button icon="sort" size="sm" type="button" variant="secondary">{sort === "newest" ? "Sort by name" : "Newest first"}</Button></Link></div></div><div className="results-list">{matches.map((result) => <Card className="result-card" key={result.id}><div className={`result-media ${result.tone}`}><Badge icon="verification" variant="success">Active</Badge><Icon className="result-media__stone" name="tree" size={46} /></div><div className="result-body"><h2>{result.name}</h2><p className="result-years">{result.dates}</p><span className="plot-pill"><Icon name="location" size={16} />{result.plotLabel}</span><p className="result-section">{result.section} · {result.row}</p><p className="result-section">{result.location ? `GPS location${result.locationVerified ? " verified" : " available; accuracy pending"}` : result.pixelLocation ? "Image-map location available" : "Location not recorded"}</p><div className="result-divider" /><Link href={`/gravesite?id=${result.id}`}><Button className="button--full" iconAfter="chevronRight" size="md">View gravesite</Button></Link></div></Card>)}</div><Link className="subtle-link" href="/search">← Refine search</Link></div></VisitorShell>;
}

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
