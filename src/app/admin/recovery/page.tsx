import { requireStaff } from "@/lib/auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { RecoveryPage } from "@/components/admin/recovery-page";
export default async function RecoveryRoute() {
  await requireStaff("ADMIN");
  return <AdminShell active="Recovery"><RecoveryPage /></AdminShell>;
}
