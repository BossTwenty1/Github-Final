import { VisitorShell } from "@/components/visitor/visitor-shell";
import { MapExplorer } from "@/components/visitor/map-explorer";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MapPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const plot = params?.plot;
  return <VisitorShell><MapExplorer initialPlot={Array.isArray(plot) ? plot[0] || "A-42" : plot || "A-42"} /></VisitorShell>;
}
