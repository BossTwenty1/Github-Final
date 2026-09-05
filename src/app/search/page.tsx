import Link from "next/link";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { getPublicGardenNames } from "@/lib/supabase/public-data";

export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const gardens = await getPublicGardenNames();
  return <VisitorShell><div className="visitor-stack"><div className="visitor-page-heading"><p className="visitor-kicker">Find a record</p><h1>Search the cemetery</h1><p>Search by name or plot code, then use the map to find the right plot.</p></div><Card><CardHeader><CardTitle className="card-title-with-icon"><Icon className="text-green" name="search" size={22} />Find a gravesite</CardTitle></CardHeader><CardContent><form action="/results" className="visitor-search-form" method="get"><Input label="Name or plot code" name="query" placeholder="Enter a name or plot code" icon="userSearch" /><div className="filter-grid"><label className="input-field"><span className="input-label">Garden</span><select className="input-control" defaultValue="all" name="section"><option value="all">All gardens</option>{gardens.map((garden) => <option key={garden} value={garden}>{garden}</option>)}</select></label><label className="input-field"><span className="input-label">Year of passing</span><select className="input-control" defaultValue="any" name="year"><option value="any">Any year</option><option value="1800-1899">1800–1899</option><option value="1900-1999">1900–1999</option><option value="2000-present">2000–present</option></select></label></div><Button className="button--full" icon="search" size="lg" type="submit">Search gravesite</Button></form></CardContent></Card><Link className="subtle-link" href="/">← Back to home</Link></div></VisitorShell>;
}
