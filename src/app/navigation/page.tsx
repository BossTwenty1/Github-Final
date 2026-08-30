import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { getPublicBurialRecord, getPublicBurialRecordByPlot } from "@/lib/supabase/public-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NavigationPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const record = await getPublicBurialRecord(getParam(params?.id)) || await getPublicBurialRecordByPlot(getParam(params?.plot));
  if (!record) redirect(`/record-not-found?query=${encodeURIComponent(getParam(params?.id) || getParam(params?.plot) || "that gravesite")}`);
  return <VisitorShell><div className="navigation-page"><div className="navigation-map"><Image alt="Forest Lake Memorial Park Phase 1 map reference" className="navigation-map__image" fill priority sizes="(max-width: 760px) 100vw, 760px" src="/maps/forest-lake-phase1-cleaned-network-preview.svg" unoptimized /><div className="navigation-map__label"><Icon name="location" size={18} />{record.plotLabel}</div></div><Alert icon="info" title="Walking directions preview" variant="info">This preview uses the supplied Phase 1 garden, roadway, walkway, and node geometry. {record.location ? "An existing database coordinate is attached to this public record." : "No GPS coordinate is recorded for this public record."} Turn-by-turn routing remains unavailable until the network connections and grave coordinate are verified.</Alert><section className="navigation-panel"><p className="visitor-kicker">Walking directions</p><h1>Heading to {record.plotLabel}</h1><p className="navigation-eta">Follow the marked path through {record.section} when routing data is verified.</p><div className="fallback-card"><Icon name="walk" size={23} /><div><strong>Route summary</strong><p>Main entrance → {record.section} → {record.plotLabel}. {record.locationVerified ? "Coordinate verified." : "Coordinate availability is shown without treating verification as a visibility gate."}</p></div></div><div className="navigation-back-actions"><Link href={`/gravesite?id=${record.id}`}><Button className="button--full" icon="records" size="lg">View gravesite</Button></Link><Link href={`/map?plot=${encodeURIComponent(record.plot)}`}><Button className="button--full" icon="map" size="lg" variant="secondary">Back to map</Button></Link></div></section></div></VisitorShell>;
}

function getParam(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
