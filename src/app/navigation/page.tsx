import Link from "next/link";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { getGravesiteById, getGravesiteByPlot, gravesites } from "@/lib/mock-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NavigationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const record = getGravesiteById(getParam(params?.id)) || getGravesiteByPlot(getParam(params?.plot)) || gravesites[0];

  return <VisitorShell><div className="navigation-page"><div className="navigation-map"><div className="navigation-map__label"><Icon name="location" size={18} />{record.plotLabel}</div><div className="navigation-map__route"><span className="navigation-map__start" /><span className="navigation-map__line" /><span className="navigation-map__destination"><Icon name="location" size={23} /></span></div><div className="map-road map-road--horizontal" /><div className="map-road map-road--vertical" /></div><Alert icon="info" title="Walking directions preview" variant="info">This is a mock route preview for {record.name}. No GPS or live location data is requested.</Alert><section className="navigation-panel"><p className="visitor-kicker">Walking directions</p><h1>Heading to {record.plotLabel}</h1><p className="navigation-eta">Estimated arrival in 2 minutes.</p><div className="fallback-card"><Icon name="walk" size={23} /><div><strong>Mock route summary</strong><p>Main entrance → {record.section} → {record.plotLabel}. Follow the marked path toward {record.row.toLowerCase()}.</p></div></div><div className="navigation-back-actions"><Link href={`/gravesite?id=${record.id}`}><Button className="button--full" icon="records" size="lg">View gravesite</Button></Link><Link href={`/map?plot=${record.plot}`}><Button className="button--full" icon="map" size="lg" variant="secondary">Back to map</Button></Link></div></section></div></VisitorShell>;
}

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
