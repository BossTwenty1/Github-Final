import { redirect } from "next/navigation";
import { NavigationRouteMap } from "@/components/visitor/navigation-route-map";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { getPublicBurialRecord, getPublicBurialRecordByPlot } from "@/lib/supabase/public-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NavigationPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const id = getParam(params.id);
  const plot = getParam(params.plot);
  const record =
    (await getPublicBurialRecord(id)) ||
    (await getPublicBurialRecordByPlot(plot));

  if (!record) {
    const query = id || plot || "that gravesite";
    redirect(`/record-not-found?${new URLSearchParams({ query })}`);
  }

  return (
    <VisitorShell
      backHref={`/gravesite?id=${encodeURIComponent(record.id)}`}
      backLabel="Back to gravesite profile"
      wide
    >
      <NavigationRouteMap record={record} />
    </VisitorShell>
  );
}

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}
