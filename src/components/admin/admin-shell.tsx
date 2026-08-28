import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth";
import { AdminShellClient } from "./admin-shell-client";

export async function AdminShell({ children, active = "Dashboard" }: { children: ReactNode; active?: string }) {
  const staff = await requireStaff();
  return <AdminShellClient active={active} staff={staff}>{children}</AdminShellClient>;
}
