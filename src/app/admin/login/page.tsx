import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { getCurrentStaff } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLoginPage() {
  const staff = await getCurrentStaff();
  if (staff?.isActive && staff.accountStatus === "ACTIVE") redirect("/admin");

  return <AdminLoginForm />;
}
