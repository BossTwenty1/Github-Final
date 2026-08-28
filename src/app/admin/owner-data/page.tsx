import { AdminShell } from "@/components/admin/admin-shell";
import { AdminOwnerDataPage } from "@/components/admin/admin-page-content";

export default function AdminOwnerDataRoute() {
  return <AdminShell active="Owner data"><AdminOwnerDataPage /></AdminShell>;
}
