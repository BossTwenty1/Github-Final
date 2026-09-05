import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database-schema";
import { localSupabaseConfig } from "./config";

export async function getServerSupabase(): Promise<SupabaseClient<Database> | null> {
  if (!localSupabaseConfig.configured) return null;

  const cookieStore = await cookies();
  return createServerClient<Database>(localSupabaseConfig.url, localSupabaseConfig.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always mutate cookies. Proxy refreshes them.
        }
      },
    },
  });
}
