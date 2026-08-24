import Link from "next/link";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RecordNotFoundPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = getParam(params?.query) || "that search";

  return <VisitorShell><Card className="not-found-card"><CardContent><span className="not-found-icon"><Icon name="search" size={44} /></span><h1>Record not found</h1><p>We couldn’t find a record matching <strong>“{query}”</strong>.</p><div className="suggestions"><p>Search suggestions</p><span><Icon name="userSearch" size={18} />Double-check the spelling of the name.</span><span><Icon name="records" size={18} />Try searching by the year of passing, if known.</span><span><Icon name="filter" size={18} />Use fewer search terms to broaden the results.</span></div><div className="not-found-actions"><Link href="/search"><Button className="button--full" icon="search" size="lg">Search again</Button></Link><Link href="/search"><Button className="button--full" icon="support" size="lg" variant="secondary">Contact cemetery staff</Button></Link></div></CardContent></Card></VisitorShell>;
}

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
