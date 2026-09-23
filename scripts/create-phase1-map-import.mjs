import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inputPath = path.join(root, "public", "maps", "forest-lake-phase1-cleaned-network.geojson");
const outputPath = path.join(root, "docs", "forest-lake-phase1-map-import.sql");
const collection = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const features = collection.features;
const site = features.find((feature) => feature.properties?.feature_type === "site");
const areas = features.filter((feature) => feature.properties?.feature_type === "area");
const nodes = features.filter((feature) => feature.properties?.feature_type === "map_node");
const edges = features.filter((feature) => feature.properties?.feature_type === "map_edge");

const sqlJson = (value) => `$geojson$${JSON.stringify(value)}$geojson$`;
const text = (value) => `'${String(value).replaceAll("'", "''")}'`;
const nodeType = (value) => {
  const type = String(value || "").toLowerCase();
  if (type.includes("entrance")) return "entrance";
  if (type.includes("landmark")) return "landmark";
  return "junction";
};
const nodeName = (node) => {
  const properties = node.properties || {};
  if (properties.node_type === "edge_endpoint") return `${properties.name || "Mapped endpoint"} (${properties.id})`;
  return properties.name || properties.id;
};

if (!site || areas.length !== 4 || nodes.length === 0 || edges.length === 0) throw new Error("The Phase 1 GeoJSON does not contain the expected site, four areas, nodes, and edges.");

const lines = [
  "-- GraveNav Phase 1 map data import generated from the cleaned KML GeoJSON.",
  "-- Data-only import: no tables, columns, policies, or functions are changed.",
  "-- Review the read-only checks before committing this transaction in hosted Supabase.",
  "-- The import uses existing site_id 1 and does not create plots, lots, graves, owners, sectors, or blocks.",
  "",
  "select site_id, site_name, address, (boundary_geom is not null) as already_has_boundary",
  "from public.site where site_id = 1;",
  "",
  "begin;",
  "",
  "do $$",
  "declare site_count integer;",
  "begin",
  "  select count(*) into site_count from public.site where site_id = 1;",
  "  if site_count <> 1 then raise exception 'Expected exactly one Forest Lake site row with site_id 1'; end if;",
  "end $$;",
  "",
  `update public.site set boundary_geom = st_setsrid(st_geomfromgeojson(${sqlJson(site.geometry)}), 4326)::extensions.geography, updated_at = current_timestamp where site_id = 1;`,
  "",
  "do $$",
  "declare area_id_value bigint;",
  "begin",
];

for (const area of areas) {
  const properties = area.properties;
  lines.push(`  select area_id into area_id_value from public.area where site_id = 1 and area_code = ${text(properties.area_code)} limit 1;`);
  lines.push("  if area_id_value is null then");
  lines.push(`    insert into public.area (site_id, area_code, area_name, area_category, boundary_geom) values (1, ${text(properties.area_code)}, ${text(properties.name)}, 'garden', st_setsrid(st_geomfromgeojson(${sqlJson(area.geometry)}), 4326)::extensions.geography) returning area_id into area_id_value;`);
  lines.push("  else");
  lines.push(`    update public.area set area_name = ${text(properties.name)}, area_category = 'garden', boundary_geom = st_setsrid(st_geomfromgeojson(${sqlJson(area.geometry)}), 4326)::extensions.geography where area_id = area_id_value;`);
  lines.push("  end if;");
}

lines.push("end $$;", "", "create temporary table _phase1_node_map (source_id text primary key, node_id bigint not null) on commit drop;", "");

for (const node of nodes) {
  const properties = node.properties;
  const geometry = node.geometry;
  const sourceId = properties.id;
  const type = nodeType(properties.node_type);
  const name = nodeName(node);
  lines.push("do $$");
  lines.push("declare matched_node_id bigint;");
  lines.push("begin");
  lines.push(`  select node_id into matched_node_id from public.map_node where site_id = 1 and node_name = ${text(name)} and node_type = ${text(type)} and location_geom is not null and st_dwithin(location_geom, st_setsrid(st_geomfromgeojson(${sqlJson(geometry)}), 4326)::extensions.geography, 0.5) limit 1;`);
  lines.push("  if matched_node_id is null then");
  lines.push(`    insert into public.map_node (site_id, node_name, node_type, location_geom) values (1, ${text(name)}, ${text(type)}, st_setsrid(st_geomfromgeojson(${sqlJson(geometry)}), 4326)::extensions.geography) returning node_id into matched_node_id;`);
  lines.push("  end if;");
  lines.push(`  insert into _phase1_node_map (source_id, node_id) values (${text(sourceId)}, matched_node_id) on conflict (source_id) do update set node_id = excluded.node_id;`);
  lines.push("end $$;", "");
}

for (const edge of edges) {
  const properties = edge.properties;
  const geometry = edge.geometry;
  const edgeType = properties.edge_type === "road" ? "road" : "path";
  lines.push("do $$");
  lines.push("declare from_id bigint; to_id bigint; geometry_value extensions.geography; already_exists boolean;");
  lines.push("begin");
  lines.push(`  select node_id into from_id from _phase1_node_map where source_id = ${text(properties.from_node_id)};`);
  lines.push(`  select node_id into to_id from _phase1_node_map where source_id = ${text(properties.to_node_id)};`);
  lines.push(`  geometry_value := st_setsrid(st_geomfromgeojson(${sqlJson(geometry)}), 4326)::extensions.geography;`);
  lines.push("  if from_id is null or to_id is null or from_id = to_id then raise exception 'Missing or invalid node mapping for Phase 1 edge'; end if;");
  lines.push(`  select exists(select 1 from public.map_edge where from_node_id = from_id and to_node_id = to_id and edge_type = ${text(edgeType)} and path_geom is not null and st_dwithin(path_geom, geometry_value, 0.5)) into already_exists;`);
  lines.push("  if not already_exists then");
  lines.push(`    insert into public.map_edge (from_node_id, to_node_id, path_geom, distance_m, edge_type, is_restricted) values (from_id, to_id, geometry_value, st_length(geometry_value), ${text(edgeType)}, false);`);
  lines.push("  end if;");
  lines.push("end $$;", "");
}

lines.push(
  "-- Read-only verification before commit:",
  "select count(*) as phase1_garden_rows from public.area where site_id = 1 and area_code in ('RPG', 'HPG', 'DPG', 'YPG');",
  "select count(*) as phase1_map_nodes from public.map_node where site_id = 1;",
  "select edge_type, count(*) as edge_count from public.map_edge where edge_type in ('road', 'path') group by edge_type order by edge_type;",
  "-- If the checks are correct, run COMMIT. Otherwise run ROLLBACK.",
  "commit;",
  "",
  "-- Post-commit verification:",
  "select site_id, st_geometrytype(boundary_geom::extensions.geometry) as boundary_type, st_srid(boundary_geom::extensions.geometry) as boundary_srid, st_isvalid(boundary_geom::extensions.geometry) as boundary_valid from public.site where site_id = 1;",
  "select area_code, area_name, st_geometrytype(boundary_geom::extensions.geometry) as area_type, st_srid(boundary_geom::extensions.geometry) as area_srid, st_isvalid(boundary_geom::extensions.geometry) as area_valid from public.area where site_id = 1 and area_code in ('RPG', 'HPG', 'DPG', 'YPG') order by area_code;",
);

fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ outputPath, gardens: areas.length, nodes: nodes.length, edges: edges.length }));
