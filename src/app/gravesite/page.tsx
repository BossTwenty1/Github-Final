import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icons";
import { getPublicBurialRecord } from "@/lib/supabase/public-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function GravesitePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const record = await getPublicBurialRecord(getParam(params?.id));
  if (!record) redirect(`/record-not-found?query=${encodeURIComponent(getParam(params?.id) || "that gravesite")}`);
  return <VisitorShell><div className="visitor-stack"><Link className="subtle-link" href="/results">← Back to search results</Link><div className="profile-heading"><p className="visitor-kicker">Public gravesite profile</p><div className="profile-heading__row"><div><h1>{record.name}</h1><p>{record.dates}</p></div><Badge icon="verification" variant="success">Active record</Badge></div></div><Card className="profile-card"><div className={`profile-media ${record.tone}`}><Icon name="tree" size={58} /></div><CardContent><div className="profile-location"><Icon name="location" size={20} /><div><span>{record.plotLabel}</span><p>{record.section} · {record.row}</p></div></div><div className="profile-details"><div><span>Burial date</span><strong>{record.burialDate}</strong></div><div><span>Location</span><strong>{record.location ? "GPS available" : record.pixelLocation ? "Map position available" : "Not recorded"}</strong></div></div></CardContent></Card><AlertProfile record={record} /><div className="profile-actions"><Link href={`/navigation?id=${record.id}`}><Button className="button--full" icon="walk" size="lg">Navigate to gravesite</Button></Link><Link href={`/map?plot=${encodeURIComponent(record.plot)}`}><Button className="button--full" icon="map" variant="secondary">View on map</Button></Link></div></div></VisitorShell>;
}

function AlertProfile({ record }: { record: NonNullable<Awaited<ReturnType<typeof getPublicBurialRecord>>> }) { return <div className="profile-note"><Icon name="info" size={19} /><p>{record.location ? `Existing GPS location is available${record.locationVerified ? " and verified" : ", but its accuracy is still pending verification"}.` : record.pixelLocation ? "An existing image-map location is available. GPS coordinates have not been collected." : "Location coordinates are not recorded yet; the cemetery map prototype remains available."}</p></div>; }
function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
