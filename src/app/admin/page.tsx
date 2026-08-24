import { AdminShell } from "@/components/admin/admin-shell";
import { AdminFoundation } from "@/components/admin/admin-foundation";

export default function AdminPage() {
  return <AdminShell active="Dashboard"><AdminFoundation /></AdminShell>;
}
