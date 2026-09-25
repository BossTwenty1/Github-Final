import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("..", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

test("Phase 1 static network contains only the four approved gardens", async () => {
  const map = JSON.parse(await read("public/maps/forest-lake-phase1-routing-network.geojson"));
  assert.equal(map.type, "FeatureCollection");
  const areas = map.features.filter((feature) => feature.properties?.feature_type === "area");
  assert.deepEqual(areas.map((feature) => feature.properties.area_code).sort(), ["DPG", "HPG", "RPG", "YPG"]);
  assert.ok(map.features.some((feature) => feature.properties?.feature_type === "map_edge"));
  assert.ok(map.features.some((feature) => feature.properties?.feature_type === "map_node"));
});

test("map edges reference existing network nodes", async () => {
  const map = JSON.parse(await read("public/maps/forest-lake-phase1-routing-network.geojson"));
  const nodeIds = new Set(map.features.filter((feature) => feature.properties?.feature_type === "map_node").map((feature) => String(feature.properties.id)));
  const edges = map.features.filter((feature) => feature.properties?.feature_type === "map_edge");
  assert.ok(edges.length > 0);
  for (const edge of edges) {
    assert.ok(nodeIds.has(String(edge.properties.from_node_id)));
    assert.ok(nodeIds.has(String(edge.properties.to_node_id)));
  }
});

test("routing edges form one connected Phase 1 component", async () => {
  const map = JSON.parse(await read("public/maps/forest-lake-phase1-routing-network.geojson"));
  const nodes = map.features.filter((feature) => feature.properties?.feature_type === "map_node");
  const edges = map.features.filter((feature) => feature.properties?.feature_type === "map_edge" && !feature.properties?.is_restricted);
  const adjacency = new Map(nodes.map((node) => [String(node.properties.id), new Set()]));
  for (const edge of edges) {
    const from = String(edge.properties.from_node_id);
    const to = String(edge.properties.to_node_id);
    if (!adjacency.has(from) || !adjacency.has(to)) continue;
    adjacency.get(from).add(to);
    adjacency.get(to).add(from);
  }
  const routable = nodes.filter((node) => adjacency.get(String(node.properties.id))?.size);
  const visited = new Set();
  let components = 0;
  for (const node of routable) {
    const id = String(node.properties.id);
    if (visited.has(id)) continue;
    components += 1;
    const queue = [id];
    visited.add(id);
    while (queue.length) {
      const current = queue.shift();
      for (const neighbor of adjacency.get(current) || []) if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  assert.equal(components, 1);
  assert.ok(routable.some((node) => node.properties.node_type === "entrance" || node.properties.node_type === "main_entrance"));
});

test("protected provisioning keeps the Auth admin key server-side", async () => {
  const route = await read("src/app/api/admin/accounts/provision/route.ts");
  assert.match(route, /process\.env\.SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_(?:SECRET|SERVICE_ROLE)/);
});

test("navigation requests browser geolocation", async () => {
  const source = await read("src/components/visitor/navigation-route-map.tsx");
  assert.match(source, /subscribeToLocation\(\s*navigator\.geolocation/);
});

test("photo uploads stay optional, validated, and recover from metadata failure", async () => {
  const source = await read("src/lib/supabase/admin-data.ts");
  assert.match(source, /image\/jpeg/);
  assert.match(source, /10 \* 1024 \* 1024/);
  assert.match(source, /storage\.from\(bucket\)\.remove/);
  assert.match(source, /approval_status: "pending"/);
  assert.match(source, /public_display: false/);
});

test("client-side sources never reference the private Auth admin key", async () => {
  for (const file of [
    "src/components/admin/admin-crud-pages.tsx",
    "src/components/admin/admin-page-content.tsx",
    "src/components/admin/admin-photo-uploader.tsx",
    "src/lib/supabase/admin-data.ts",
  ]) {
    const source = await read(file);
    assert.doesNotMatch(source, /process\.env\.SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)/);
  }
});

test("public queries and exports apply security boundaries", async () => {
  const publicData = await read("src/lib/supabase/public-data.ts");
  assert.match(publicData, /search_public_burials/);
  assert.match(publicData, /\.limit\(1000\)/);
  assert.match(publicData, /throw new PublicDataUnavailableError/);

  const report = await read("src/components/admin/admin-page-content.tsx");
  assert.match(report, /\[\\t\\r\\n \]\*\[=\+\\-@\]/);
  assert.match(report, /csvCell\(record\.burialId\)/);
  assert.match(report, /csvCell\(record\.recordStatus\)/);
});

test("auth callback data is scrubbed before session exchange", async () => {
  const authClient = await read("src/lib/auth-client.ts");
  const scrubIndex = authClient.indexOf("window.history.replaceState");
  const exchangeIndex = authClient.indexOf("exchangeCodeForSession");
  assert.ok(scrubIndex >= 0 && scrubIndex < exchangeIndex);

  const nextConfig = await read("next.config.ts");
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /X-Frame-Options/);
  assert.match(nextConfig, /Permissions-Policy/);
});

test("protected routes enforce staff authentication and role checks", async () => {
  const auth = await read("src/lib/auth.ts");
  assert.match(auth, /redirect\("\/admin\/login"\)/);
  assert.match(auth, /redirect\("\/admin\/unauthorized"\)/);
  assert.match(auth, /staff\.role !== requiredRole/);

  const provision = await read("src/app/api/admin/accounts/provision/route.ts");
  assert.match(provision, /staff\.role !== "ADMIN"/);
  assert.match(provision, /SUPABASE_SECRET_KEY/);
});

test("CI runs the same repository gates used before deployment", async () => {
  const workflow = await read(".github/workflows/ci.yml");
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npx tsc --noEmit/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm audit --omit=dev/);
});
