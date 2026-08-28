import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentStaff } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";

const passwordSetupCookie = "gravenav_auth_flow";

export async function POST() {
  const supabase = await getServerSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const staff = await getCurrentStaff();
  const response = staff?.isActive && staff.accountStatus === "ACTIVE"
    ? NextResponse.json({ destination: "/admin", role: staff.role })
    : NextResponse.json({ destination: "/admin/unauthorized", error: "An active GraveNav account is required" }, { status: 403 });
  (await cookies()).set(passwordSetupCookie, "", { maxAge: 0, path: "/" });
  return response;
}
