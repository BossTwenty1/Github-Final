import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = new URL("..", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

test("Phase 1 static network contains only the four approved gardens", async () => {
  const map = JSON.parse(await read("public/maps/forest-lake-phase1-cleaned-network.geojson"));
  assert.equal(map.type, "FeatureCollection");
  const areas = map.features.filter((feature) => feature.properties?.feature_type === "area");
  assert.deepEqual(areas.map((feature) => feature.properties.area_code).sort(), ["DPG", "HPG", "RPG", "YPG"]);
  assert.ok(map.features.some((feature) => feature.properties?.feature_type === "map_edge"));
  assert.ok(map.features.some((feature) => feature.properties?.feature_type === "map_node"));
});

test("map edges reference existing network nodes", async () => {
  const map = JSON.parse(await read("public/maps/forest-lake-phase1-cleaned-network.geojson"));
  const nodeIds = new Set(map.features.filter((feature) => feature.properties?.feature_type === "map_node").map((feature) => String(feature.properties.id)));
  const edges = map.features.filter((feature) => feature.properties?.feature_type === "map_edge");
  assert.ok(edges.length > 0);
  for (const edge of edges) {
    assert.ok(nodeIds.has(String(edge.properties.from_node_id)));
    assert.ok(nodeIds.has(String(edge.properties.to_node_id)));
  }
});

test("protected provisioning keeps the Auth admin key server-side", async () => {
  const route = await read("src/app/api/admin/accounts/provision/route.ts");
  assert.match(route, /process\.env\.SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_SUPABASE_(?:SECRET|SERVICE_ROLE)/);
});

test("navigation requests browser geolocation", async () => {
  const source = await read("src/components/visitor/navigation-route-map.tsx");
  assert.match(source, /navigator\.geolocation\.getCurrentPosition/);
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
  assert.match(publicData, /const PUBLIC_RESULT_LIMIT = 1000/);
  assert.match(publicData, /request = request\.limit\(PUBLIC_RESULT_LIMIT\)/);
  assert.match(publicData, /safeRequest = safeRequest\.limit\(PUBLIC_RESULT_LIMIT\)/);

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
