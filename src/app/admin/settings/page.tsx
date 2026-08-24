import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSettingsPage } from "@/components/admin/admin-page-content";

export default function AdminSettingsRoute() { return <AdminShell active="Settings"><AdminSettingsPage /></AdminShell>; }
