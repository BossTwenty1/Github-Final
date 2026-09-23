# Forest Lake Phase 1 KML cleanup

This output was generated from the supplied KML. The original KML was not modified. The cleaned site, garden, node, and edge geometry was imported into the existing hosted Supabase tables with the data-only SQL file in `docs/forest-lake-phase1-map-import.sql`.

## Included

- Phase 1 garden polygons: 4 (RPG, HPG, DPG, YPG)
- Road features retained: 4
- Walkway features retained: 14
- Source nodes retained: 13
- Derived exact line intersections: 1
- Output nodes, including endpoints: 41
- Output edges: 18

Butterfly Palm Garden and Majestic Palm Garden were excluded as Phase 2. No plot or gravesite features were present.

## Fixes applied

- Added clear KML folders for the site, gardens, roads, walkways, and nodes.
- Assigned unique output IDs: N### for nodes and E### for edges.
- Preserved the source road and walkway geometry.
- Added endpoint nodes and exact intersection nodes where geometry supports them.
- Added edge metadata linking each source line to its endpoint node IDs.

## Source issues retained for review

The source duplicate IDs were:

- NODE|N001: 3 source features
- PATH|W003: 3 source features
- PATH|W001: 3 source features
- PATH|W002: 3 source features
- PATH|W004: 3 source features
- PATH|W005: 2 source features

10 of 36 line endpoints were not within 5 m of another line. They remain as explicit endpoints instead of being moved or silently connected.

## Review files

- Preview: /maps/forest-lake-phase1-cleaned-network-preview.svg
- GeoJSON: /maps/forest-lake-phase1-cleaned-network.geojson
- KML: /maps/forest-lake-phase1-cleaned-network.kml

## Database mapping

- The location hierarchy used by GraveNav is now `site -> area/garden -> plot`.
- The hosted schema migration `supabase/migrations/20260829170000_use_area_directly_for_lots.sql` adds the direct `lot.area_id` relationship. New plots use that field; `block_id` remains nullable legacy compatibility for older records.
- The imported KML contains no official plot or gravesite records. Those must be created later by an administrator, with verified grave coordinates collected in the field.
- The schema migration was applied as a protected linked SQL query. `npx supabase db push` was not used.
