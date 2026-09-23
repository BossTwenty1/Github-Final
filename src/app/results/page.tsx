import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { PublicSearchResultCard } from "@/components/visitor/public-search-result-card";
import { SearchSubmitButton } from "@/components/visitor/search-submit-button";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { searchPublicBurials } from "@/lib/supabase/public-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ResultsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = getParam(params.query).slice(0, 160);
  const section = getParam(params.section) || "all";
  const year = getParam(params.year) || "any";
  const sort = getParam(params.sort) === "newest" ? "newest" : "name";
  const page = Math.max(1, Math.min(10000, Number.parseInt(getParam(params.page), 10) || 1));
  const url = (changes: Partial<{ query: string; section: string; year: string; sort: "name" | "newest"; page: number }> = {}) => "/results?" + new URLSearchParams({ query, section, year, sort, page: String(page), ...stringifyChanges(changes) });

  let result;
  try {
    result = await searchPublicBurials({ query, section, year, sort, page });
  } catch {
    return <VisitorShell wide><section className="public-results-state public-results-state--error"><span><Icon name="alert" size={27} /></span><h1>Search is temporarily unavailable</h1><p>The public registry could not be reached. Your search details are still preserved.</p><div><Link className="button button--primary" href={url()}>Try again</Link><Link className="button button--secondary" href="/search">Change search</Link></div></section></VisitorShell>;
  }

  const { items, total, pageSize } = result;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const resultLabel = total === 1 ? "record" : "records";

  return <VisitorShell wide><div className="public-results-page">
    <section aria-labelledby="results-title" className="public-results-toolbar">
      <form action="/results" className="public-results-search" method="get">
        <Icon className="public-results-search__icon" name="search" size={20} />
        <input aria-label="Search resting places" autoComplete="off" defaultValue={query} enterKeyHint="search" maxLength={160} name="query" placeholder="Search by name or plot code…" />
        {query ? <Link aria-label="Clear search" className="public-results-search__clear" href={url({ query: "", page: 1 })}><Icon name="close" size={17} /></Link> : null}
        <input name="section" type="hidden" value={section} /><input name="year" type="hidden" value={year} /><input name="sort" type="hidden" value={sort} />
        <SearchSubmitButton compact label="Search" />
      </form>
      <div className="public-results-summary"><h1 id="results-title"><span>Found</span> {total} {resultLabel}</h1><p>{query ? <>for “{query}”</> : "in the public memorial registry"}</p></div>
      <nav aria-label="Active search filters" className="public-results-filters">
        <Link className="filter-chip filter-chip--active" href={`/search?${new URLSearchParams({ query, section, year })}`}><Icon name="sliders" size={14} />{section === "all" ? "All sections" : section}<Icon name="chevronDown" size={14} /></Link>
        {year !== "any" ? <Link className="filter-chip" href={url({ year: "any", page: 1 })}><Icon name="clock" size={14} />{year}<Icon name="close" size={13} /></Link> : null}
        <Link className="filter-chip" href={url({ sort: sort === "newest" ? "name" : "newest", page: 1 })}><Icon name="sort" size={14} />{sort === "newest" ? "Newest first" : "Sort by name"}</Link>
      </nav>
    </section>

    {items.length ? <section aria-label="Search results" className="public-results-list">{items.map((record) => <PublicSearchResultCard key={record.id} record={record} returnTo={url()} />)}</section> : <section className="public-results-state"><span><Icon name="search" size={28} /></span><h2>{total ? "No records on this page" : "No matching memorial records"}</h2><p>{total ? "This page is outside the available result range." : "Try a shorter name, check the spelling, or search without section and year filters."}</p><div>{total ? <Link className="button button--primary" href={url({ page: 1 })}>Return to page 1</Link> : <Link className="button button--primary" href={`/search?${new URLSearchParams({ query, section, year })}`}>Adjust search</Link>}<Link className="button button--secondary" href="/">Return home</Link></div></section>}

    {total > 0 && items.length ? <nav aria-label="Search result pages" className="public-pagination">{page > 1 ? <Link href={url({ page: page - 1 })} rel="prev"><Icon name="chevronRight" size={16} />Previous</Link> : <span aria-disabled="true" className="public-pagination__disabled"><Icon name="chevronRight" size={16} />Previous</span>}<span>Page <b>{page}</b> of {pageCount}</span>{page < pageCount ? <Link href={url({ page: page + 1 })} rel="next">Next<Icon name="chevronRight" size={16} /></Link> : <span aria-disabled="true" className="public-pagination__disabled">Next<Icon name="chevronRight" size={16} /></span>}</nav> : null}

    <aside className="public-results-help"><span><Icon name="support" size={22} /></span><div><h2>Need help locating a plot?</h2><p>If a memorial is missing or its location is not verified, refine your search or ask cemetery staff to confirm the physical record.</p><Link href="/search">Refine this search <Icon name="chevronRight" size={14} /></Link></div></aside>
  </div></VisitorShell>;
}

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
function stringifyChanges(changes: Partial<{ query: string; section: string; year: string; sort: "name" | "newest"; page: number }>) { return Object.fromEntries(Object.entries(changes).map(([key, value]) => [key, String(value)])); }
