import Link from "next/link";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { getGravesiteById } from "@/lib/mock-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function GravesitePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const record = getGravesiteById(getParam(params?.id));

  if (!record) {
    redirect(`/record-not-found?query=${encodeURIComponent(getParam(params?.id) || "that gravesite")}`);
  }

  return <VisitorShell><div className="visitor-stack"><Link className="subtle-link" href="/results">← Back to search results</Link><div className="profile-heading"><p className="visitor-kicker">Gravesite profile</p><div className="profile-heading__row"><div><h1>{record.name}</h1><p>{record.dates}</p></div><Badge icon="verification" variant="success">{record.status} record</Badge></div></div><Card className="profile-card"><div className={`profile-media ${record.tone}`}><Icon name="tree" size={58} /></div><CardContent><div className="profile-location"><Icon name="location" size={20} /><div><span>{record.plotLabel}</span><p>{record.section} · {record.row}</p></div></div><div className="profile-details"><div><span>Burial date</span><strong>{record.burialDate}</strong></div><div><span>Record status</span><strong>{record.status}</strong></div></div></CardContent></Card><AlertProfile /><div className="profile-actions"><Link href={`/navigation?id=${record.id}`}><Button className="button--full" icon="walk" size="lg">Navigate to gravesite</Button></Link><Link href={`/map?plot=${record.plot}`}><Button className="button--full" icon="map" variant="secondary" size="lg">View on map</Button></Link></div></div></VisitorShell>;
}

function AlertProfile() { return <div className="profile-note"><Icon name="info" size={19} /><p>Placeholder profile content for the visual foundation. Final record fields will be determined with the approved data model.</p></div>; }

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
