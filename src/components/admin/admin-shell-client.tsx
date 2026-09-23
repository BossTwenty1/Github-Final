"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ChangeEvent, ReactNode } from "react";
import { signOut } from "@/lib/auth-client";
import type { StaffAccount } from "@/lib/supabase/types";
import { localSupabaseConfig } from "@/lib/supabase/config";
import { AdminSidebar } from "./admin-sidebar";
import { StaffContext } from "./staff-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";

export function AdminShellClient({ children, active, staff }: { children: ReactNode; active: string; staff: StaffAccount }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const initials = staff.username.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "GN";

  async function logout() {
    setLoggingOut(true);
    await signOut();
    router.push("/admin/login");
  }

  return <div className="admin-shell">
    <div className={`admin-dimmer ${sidebarOpen ? "admin-dimmer--open" : ""}`} onClick={() => setSidebarOpen(false)} />
    <div className={`admin-drawer ${sidebarOpen ? "admin-drawer--open" : ""}`}><AdminSidebar active={active} role={staff.role} onLogout={logout} onNavigate={() => setSidebarOpen(false)} /></div>
    <div className="admin-main">
      <header className="admin-header">
        <Button aria-label="Open administrator navigation" className="admin-menu-button" onClick={() => setSidebarOpen(true)} size="sm" variant="quiet" icon="menu"><span className="sr-only">Open menu</span></Button>
        <div className="admin-search"><Input aria-label="Search administrator records" icon="search" onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} placeholder="Search records, plots, or names..." value={search} />{search ? <div className="admin-search-results" role="status"><p>Use Burial Records to search the protected operational dataset.</p><Link href={`/admin/burial-records?query=${encodeURIComponent(search)}`} onClick={() => setSearch("")}>Search for “{search}”</Link></div> : null}</div>
        <div className="admin-header__actions">
          <span className="admin-role-badge">{localSupabaseConfig.environmentLabel}</span>
          <span className="admin-role-badge">{staff.role}</span>
          <Link aria-label="View audit notifications" className="icon-button" href="/admin/audit-log"><Icon name="bell" size={20} /></Link>
          <Link aria-label="Open administrator help" className="icon-button admin-help-button" href="/admin/support"><Icon name="help" size={20} /></Link>
          <span className="admin-header__divider" />
          <span aria-label={`Signed in as ${staff.username}`} className="admin-avatar">{initials}</span>
          <button className="admin-logout-button" disabled={loggingOut} onClick={logout} type="button">{loggingOut ? "Signing out..." : "Sign out"}</button>
        </div>
      </header>
      <main className="admin-content"><StaffContext.Provider value={staff}>{children}</StaffContext.Provider></main>
    </div>
  </div>;
}
