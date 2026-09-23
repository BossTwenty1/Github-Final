import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { PublicSearchForm } from "@/components/visitor/public-search-form";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { getPublicGardenNames } from "@/lib/supabase/public-data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const gardens = await getPublicGardenNames();
  const query = getParam(params.query).slice(0, 160);
  const section = getParam(params.section) || "all";
  const year = getParam(params.year) || "any";

  return <VisitorShell wide><div className="public-search-page">
    <Link className="public-back-link" href="/"><Icon name="chevronRight" size={15} />Home</Link>
    <header className="public-search-heading"><span className="public-search-heading__icon"><Icon name="search" size={25} /></span><div><h1>Search memorial records</h1><p>Enter a name or plot code, then narrow the public registry by section or year.</p></div></header>
    <section aria-labelledby="search-form-title" className="public-search-panel"><div className="public-search-panel__intro"><p className="visitor-kicker">Find a resting place</p><h2 id="search-form-title">Who are you looking for?</h2><p>Partial names are welcome. Similar-name suggestions are clearly marked in the results.</p></div><PublicSearchForm gardens={gardens} query={query} section={section} year={year} /></section>
    <aside className="public-search-guidance"><span><Icon name="shield" size={20} /></span><div><h2>Public information only</h2><p>Search results contain approved memorial fields. Administrator details and unverified destination coordinates remain protected.</p></div></aside>
  </div></VisitorShell>;
}

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
