import Link from "next/link";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { SearchSubmitButton } from "@/components/visitor/search-submit-button";

type PublicSearchFormProps = {
  gardens: string[];
  query?: string;
  section?: string;
  year?: string;
};

export function PublicSearchForm({ gardens, query = "", section = "all", year = "any" }: PublicSearchFormProps) {
  return <form action="/results" className="public-search-form" method="get">
    <Input autoComplete="off" label="Name or plot code" maxLength={160} name="query" defaultValue={query} placeholder="Enter a name or plot code…" icon="search" />
    <div className="public-search-filters">
      <label className="input-field"><span className="input-label">Garden or section</span><span className="select-wrap"><Icon name="map" size={17} /><select className="input-control" defaultValue={section} name="section"><option value="all">All sections</option>{gardens.map((garden) => <option key={garden} value={garden}>{garden}</option>)}</select></span></label>
      <label className="input-field"><span className="input-label">Year of passing</span><span className="select-wrap"><Icon name="clock" size={17} /><select className="input-control" defaultValue={year} name="year"><option value="any">Any year</option><option value="1800-1899">1800–1899</option><option value="1900-1999">1900–1999</option><option value="2000-present">2000–present</option></select></span></label>
    </div>
    <SearchSubmitButton label="Search memorial records" />
    {gardens.length ? <div className="public-search-shortcuts" aria-label="Quick section searches"><span>Quick sections</span>{gardens.slice(0, 4).map((garden) => <Link href={`/results?${new URLSearchParams({ section: garden, year: "any", sort: "name", page: "1" })}`} key={garden}>{garden}</Link>)}</div> : null}
  </form>;
}
