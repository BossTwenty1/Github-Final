import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { localSupabaseConfig, publicAppOrigin } from "@/lib/supabase/config";

export async function POST(request: Request) {
  const actorClient = await getServerSupabase();
  if (!actorClient) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  const { data: { user } } = await actorClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const staff = await getCurrentStaff();
  if (!staff) return NextResponse.json({ error: "An active GraveNav account is required" }, { status: 403 });
  if (staff.role !== "ADMIN" || staff.accountStatus !== "ACTIVE" || !staff.isActive) return NextResponse.json({ error: "Only active ADMIN accounts may provision accounts" }, { status: 403 });

  const authAdminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!authAdminKey) return NextResponse.json({ error: "Protected Auth Admin provisioning is not configured for the active Supabase environment" }, { status: 503 });

  let body: { email?: string; username?: string; role?: string };
  try {
    body = await request.json() as { email?: string; username?: string; role?: string };
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required" }, { status: 400 });
  }

  const email = body.email?.trim();
  const username = body.username?.trim();
  const role = body.role?.trim().toUpperCase();
  if (!email || !username || (role !== "ADMIN" && role !== "MANAGER")) return NextResponse.json({ error: "Email, username, and ADMIN or MANAGER role are required" }, { status: 400 });

  const adminClient = createClient(localSupabaseConfig.url, authAdminKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const redirectTo = new URL("/auth/callback", publicAppOrigin);
  redirectTo.searchParams.set("type", "invite");
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: redirectTo.toString() });
  if (inviteError || !invited.user) return NextResponse.json({ error: "The Supabase Auth invitation could not be created" }, { status: 400 });

  const { error: accountError } = await actorClient.rpc("admin_create_account", { p_account_id: invited.user.id, p_username: username, p_role_name: role });
  if (accountError) {
    const { error: cleanupError } = await adminClient.auth.admin.deleteUser(invited.user.id);
    if (cleanupError) return NextResponse.json({ error: "The account record could not be created and the Auth invitation needs administrator cleanup" }, { status: 500 });
    return NextResponse.json({ error: "The Auth invitation was rolled back because the account record could not be created" }, { status: 400 });
  }
  return NextResponse.json({ ok: true, accountStatus: "PENDING" });
}
