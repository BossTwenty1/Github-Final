import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database-schema";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const isLocalSupabaseUrl = isLocalUrl(supabaseUrl);

export const localSupabaseConfig = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey,
  configured: Boolean(supabasePublishableKey),
  environment: isLocalSupabaseUrl ? "local" : "hosted",
  environmentLabel: isLocalSupabaseUrl ? "LOCAL" : "HOSTED DEVELOPMENT",
};

export const publicAppOrigin = getPublicAppOrigin();

let browserClient: SupabaseClient<Database> | null = null;

export function getBrowserSupabase() {
  if (!localSupabaseConfig.configured) return null;
  browserClient ??= createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
  return browserClient;
}

export function getPublicSupabase() {
  if (!localSupabaseConfig.configured) return null;
  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function isLocalUrl(value: string) {
  try {
    return ["127.0.0.1", "localhost", "::1"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function getPublicAppOrigin() {
  const configuredOrigin = process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
  try {
    const url = new URL(configuredOrigin);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported application origin");
    if (url.username || url.password) throw new Error("Credentials are not allowed in application origin");
    return url.origin;
  } catch {
    return "http://localhost:3000";
  }
}
