import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { SetPasswordForm } from "@/components/auth/set-password-form";

export default async function SetPasswordPage() {
  const supabase = await getServerSupabase();
  if (!supabase) redirect("/admin/login?error=config");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login?error=auth_callback");

  return <SetPasswordForm />;
}
