import Link from "next/link";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";

export default function SearchPage() {
  return <VisitorShell><div className="visitor-stack"><div className="visitor-page-heading"><p className="visitor-kicker">Find a record</p><h1>Search the cemetery</h1><p>Search by name, then use the map to find the right plot.</p></div><Card><CardHeader><CardTitle className="card-title-with-icon"><Icon className="text-green" name="search" size={22} />Find a gravesite</CardTitle></CardHeader><CardContent><form action="/results" className="visitor-search-form" method="get"><Input label="Deceased name" name="query" placeholder="e.g. Eleanor Roosevelt" icon="userSearch" /><div className="filter-grid"><label className="input-field"><span className="input-label">Section</span><select className="input-control" defaultValue="all" name="section"><option value="all">All sections</option><option value="Section A">Section A</option><option value="Section B">Section B</option><option value="Section C">Section C</option></select></label><label className="input-field"><span className="input-label">Year of passing</span><select className="input-control" defaultValue="any" name="year"><option value="any">Any year</option><option value="1800-1899">1800–1899</option><option value="1900-1999">1900–1999</option></select></label></div><Button className="button--full" icon="search" size="lg" type="submit">Search gravesite</Button></form></CardContent></Card><Link className="subtle-link" href="/">← Back to home</Link></div></VisitorShell>;
}
