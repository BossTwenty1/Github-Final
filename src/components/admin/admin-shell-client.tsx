"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const initials = staff.username.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "GN";

  async function logout() {
    setLoggingOut(true);
    await signOut();
    router.push("/admin/login");
  }

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setSidebarOpen(false);
      menuButtonRef.current?.focus();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  return <div className="admin-shell">
    <a className="skip-link" href="#admin-main-content">Skip to main content</a>
    <button aria-label="Close administrator navigation" className={`admin-dimmer ${sidebarOpen ? "admin-dimmer--open" : ""}`} onClick={() => setSidebarOpen(false)} tabIndex={sidebarOpen ? 0 : -1} type="button" />
    <div className={`admin-drawer ${sidebarOpen ? "admin-drawer--open" : ""}`} id="admin-navigation-drawer" ref={drawerRef}><AdminSidebar active={active} role={staff.role} onClose={() => { setSidebarOpen(false); menuButtonRef.current?.focus(); }} onLogout={logout} onNavigate={() => setSidebarOpen(false)} /></div>
    <div className="admin-main">
      <header className="admin-header">
        <Button aria-controls="admin-navigation-drawer" aria-expanded={sidebarOpen} aria-label="Open administrator navigation" className="admin-menu-button" onClick={() => setSidebarOpen(true)} ref={menuButtonRef} size="sm" variant="quiet" icon="menu"><span className="sr-only">Open menu</span></Button>
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
      <main className="admin-content" id="admin-main-content" tabIndex={-1}><StaffContext.Provider value={staff}>{children}</StaffContext.Provider></main>
    </div>
  </div>;
}
