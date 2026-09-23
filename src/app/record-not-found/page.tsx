import Link from "next/link";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { Icon, type IconName } from "@/components/ui/icons";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const suggestions: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: "userSearch", title: "Check spelling", body: "Double-check the spelling of the first or last name." },
  { icon: "clock", title: "Try an approximate year", body: "Add a year of passing if it is known." },
  { icon: "filter", title: "Broaden the search", body: "Use fewer words or search only by last name." },
  { icon: "grid", title: "Use a plot or section", body: "Search by a recorded plot code when one is available." },
];

export default async function RecordNotFoundPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = getParam(params.query).slice(0, 160) || "that search";
  const searchHref = `/search?${new URLSearchParams({ query: query === "that search" ? "" : query })}`;

  return <VisitorShell backHref={searchHref} backLabel="Return to search" wide><section aria-labelledby="not-found-title" className="record-not-found">
    <div className="record-not-found__mark"><Icon name="search" size={38} /><span><Icon name="tree" size={15} /></span></div>
    <h1 id="not-found-title">Record not found</h1>
    <p className="record-not-found__message">We couldn’t find a cemetery record matching <strong>“{query}”</strong>.</p>
    <div className="record-not-found__suggestions"><div className="record-not-found__suggestion-title"><Icon name="info" size={18} /><h2>Search suggestions</h2></div><ul>{suggestions.map((suggestion) => <li key={suggestion.title}><span><Icon name={suggestion.icon} size={18} /></span><div><strong>{suggestion.title}</strong><p>{suggestion.body}</p></div></li>)}</ul></div>
    <Link className="button button--primary button--lg record-not-found__action" href={searchHref}><Icon name="search" size={20} /><span>Search again</span></Link>
    <p className="record-not-found__help"><Icon name="support" size={18} />Need assistance? Cemetery staff can confirm records in person when public search details are incomplete.</p>
  </section></VisitorShell>;
}

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
