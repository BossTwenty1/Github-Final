import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { localSupabaseConfig } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!localSupabaseConfig.configured) return response;

  const supabase = createServerClient(localSupabaseConfig.url, localSupabaseConfig.publishableKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  logAuthDiagnostic("proxy", {
    path: request.nextUrl.pathname,
    hasSession: Boolean(user),
    authError: Boolean(error),
  });
  return response;
}

function logAuthDiagnostic(event: string, details: Record<string, boolean | string>) {
  if (process.env.NODE_ENV !== "production") console.info(`[GraveNav auth] ${event}`, details);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/auth/:path*"],
};
