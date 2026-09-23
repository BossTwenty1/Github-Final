import Link from "next/link";
import { redirect } from "next/navigation";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { Button } from "@/components/ui/button";
import { NavigationRouteMap } from "@/components/visitor/navigation-route-map";
import { getPublicBurialRecord, getPublicBurialRecordByPlot } from "@/lib/supabase/public-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NavigationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const record = await getPublicBurialRecord(getParam(params?.id)) || await getPublicBurialRecordByPlot(getParam(params?.plot));
  if (!record) redirect(`/record-not-found?query=${encodeURIComponent(getParam(params?.id) || getParam(params?.plot) || "that gravesite")}`);
  return <VisitorShell><div className="navigation-page"><NavigationRouteMap record={record} /><section className="navigation-panel"><p className="visitor-kicker">Walking directions</p><h1>Heading to {record.plotLabel}</h1><p className="navigation-eta">Follow the recorded Phase 1 network to the selected gravesite location.</p><div className="fallback-card"><div><strong>Route summary</strong><p>Main entrance → {record.section} → {record.plotLabel}. {record.locationVerified ? "Coordinate verified." : record.location ? "Coordinate available but not yet verified." : "Coordinate not recorded yet."}</p></div></div><div className="navigation-back-actions"><Link href={`/gravesite?id=${record.id}`}><Button className="button--full" icon="records" size="lg">View gravesite</Button></Link><Link href={`/map?plot=${encodeURIComponent(record.plot)}`}><Button className="button--full" icon="map" size="lg" variant="secondary">Back to map</Button></Link></div></section></div></VisitorShell>;
}

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
