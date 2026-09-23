import Link from "next/link";
import { VisitorShell } from "@/components/visitor/visitor-shell";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { getPublicGardenNames } from "@/lib/supabase/public-data";

export default async function HomePage() {
  const gardenNames = (await getPublicGardenNames()).slice(0, 3);

  return <VisitorShell wide><div className="visitor-home">
    <section className="stitch-hero">
      <div className="stitch-hero__copy">
        <h1>Find resting places <span>with dignity &amp; grace</span></h1>
        <p>Search Forest Lake Memorial Park records, confirm the resting plot, and open walking guidance when its destination has been verified.</p>
      </div>
      <div aria-hidden="true" className="stitch-radar">
        <span className="stitch-radar__grid" />
        <span className="stitch-radar__ring stitch-radar__ring--outer" />
        <span className="stitch-radar__ring stitch-radar__ring--inner" />
        <span className="stitch-radar__route" />
        <span className="stitch-radar__compass"><Icon name="navigation" size={22} /></span>
        <span className="stitch-radar__status"><i /> Verified destinations only</span>
        <span className="stitch-radar__pin"><Icon name="location" size={32} /><b>Destination</b></span>
        <span className="stitch-radar__label"><b>Forest Lake Memorial</b><small>Cemetery wayfinding</small></span>
      </div>
    </section>

    <section className="stitch-search-card" id="visitor-search">
      <form action="/results" className="visitor-search-form" method="get">
        <Input autoComplete="off" enterKeyHint="search" label="Locate a loved one's resting plot" name="query" placeholder="Enter deceased's first or last name…" icon="search" />
        <Button className="button--full" icon="navigation" size="lg" type="submit">Find gravesite &amp; navigate</Button>
      </form>
      {gardenNames.length ? <div className="quick-filters"><span>Quick:</span>{gardenNames.map((garden) => <Link href={`/results?section=${encodeURIComponent(garden)}`} key={garden}>{garden}</Link>)}</div> : null}
    </section>

    <section className="stitch-explore">
      <div className="stitch-section-heading"><h2>Explore Memorial Park</h2><Link href="/map">View map</Link></div>
      <div className="stitch-feature-track">
        <Link className="stitch-feature-card stitch-feature-card--map" href="/map">
          <span className="stitch-feature-visual"><Icon name="map" size={34} /><b>Official grounds map</b></span>
          <span><strong>Memorial Park Grounds Map</strong><small>Explore mapped pathways and open the cemetery navigation view.</small></span>
          <span className="stitch-feature-footer"><b>Live map</b><span>Open view <Icon name="chevronRight" size={13} /></span></span>
        </Link>
        <article className="stitch-feature-card stitch-feature-card--verification">
          <span className="stitch-feature-icon"><Icon name="verification" size={18} /></span>
          <span><small>Location integrity</small><strong>Verified-coordinate guidance</strong><p>Walking directions appear only when a gravesite destination has passed location verification.</p></span>
          <Link href="/search">Search records</Link>
        </article>
      </div>
    </section>

    <section className="stitch-how-it-works">
      <h2>How GraveNav works</h2>
      <ol>
        <li><span>1</span><div><strong>Search by name or plot number</strong><p>Query the public memorial registry using the details you know.</p></div></li>
        <li><span>2</span><div><strong>Confirm the memorial record</strong><p>Review the matching name, dates, section, and plot before continuing.</p></div></li>
        <li><span>3</span><div><strong>Start walking guidance</strong><p>Open the map and follow a route only when the destination is verified.</p></div></li>
      </ol>
    </section>

    <footer className="visitor-footer"><strong>GraveNav Albay</strong><p>Forest Lake Memorial Park, Bogtong, Legazpi City, Albay</p></footer>
  </div></VisitorShell>;
}
