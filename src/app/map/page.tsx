import { Alert } from "@/components/ui/alert";
import { MapExplorer } from "@/components/visitor/map-explorer";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { getPublicGardenNames, searchPublicBurials } from "@/lib/supabase/public-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function MapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const value = (key: string) =>
    Array.isArray(params[key]) ? params[key][0] : params[key] || "";
  const query = (value("query") || value("plot")).slice(0, 160);
  const section = value("section") || "all";
  const requestedPage = Number(value("page"));
  const page = Number.isInteger(requestedPage)
    ? Math.max(1, Math.min(requestedPage, 10000))
    : 1;
  const gardens = await getPublicGardenNames();

  let results;
  try {
    results = await searchPublicBurials({ query, section, page });
  } catch {
    return (
      <VisitorShell wide>
        <section className="map-page-state">
          <Alert
            title="Map records are temporarily unavailable"
            variant="warning"
          >
            The cemetery layout is still available, but public memorial records
            could not be loaded. Reload the page to try again.
          </Alert>
        </section>
      </VisitorShell>
    );
  }

  const pageUrl = (next: number) =>
    `/map?${new URLSearchParams({ query, section, page: String(next) })}`;
  const firstResult = results.total
    ? Math.min((page - 1) * results.pageSize + 1, results.total)
    : 0;
  const lastResult = results.total
    ? Math.min(page * results.pageSize, results.total)
    : 0;
  const resultSummary = results.total
    ? `Showing ${firstResult}–${lastResult} of ${results.total} matching records.`
    : "No matching public records. Try another name, plot code, or garden.";

  return (
    <VisitorShell wide>
      <MapExplorer
        gardens={gardens}
        nextHref={
          page * results.pageSize < results.total
            ? pageUrl(page + 1)
            : undefined
        }
        page={page}
        previousHref={page > 1 ? pageUrl(page - 1) : undefined}
        query={query}
        records={results.items}
        resultSummary={resultSummary}
        section={section}
      />
    </VisitorShell>
  );
}
