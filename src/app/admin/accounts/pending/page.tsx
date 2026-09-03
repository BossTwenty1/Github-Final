import { AdminShell } from "@/components/admin/admin-shell";
import { AdminAccountsPage } from "@/components/admin/admin-page-content";
import { requireStaff } from "@/lib/auth";

export default async function AdminPendingAccountsRoute() {
  await requireStaff("ADMIN");
  return <AdminShell active="Account Management"><AdminAccountsPage pendingOnly /></AdminShell>;
}
