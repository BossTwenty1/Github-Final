"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { signOut } from "@/lib/auth-client";
import type { StaffAccount } from "@/lib/supabase/types";
import { localSupabaseConfig } from "@/lib/supabase/config";
import { AdminSidebar } from "./admin-sidebar";
import { StaffContext } from "./staff-context";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";

type AdminShellClientProps = {
  children: ReactNode;
  active: string;
  staff: StaffAccount;
};

export function AdminShellClient({ children, active, staff }: AdminShellClientProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const initials = staff.username
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "GN";

  async function logout() {
    setLoggingOut(true);
    await signOut();
    router.push("/admin/login");
  }

  function closeDrawer() {
    setSidebarOpen(false);
    menuButtonRef.current?.focus();
  }

  function trapDrawerFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !sidebarOpen || window.innerWidth >= 960) return;
    const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeDrawer();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [sidebarOpen]);

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-main-content">Skip to main content</a>
      <button
        aria-label="Close administrator navigation"
        className={`admin-dimmer ${sidebarOpen ? "admin-dimmer--open" : ""}`}
        onClick={closeDrawer}
        tabIndex={sidebarOpen ? 0 : -1}
        type="button"
      />
      <div
        aria-label="Administrator navigation drawer"
        aria-modal={sidebarOpen ? "true" : undefined}
        className={`admin-drawer ${sidebarOpen ? "admin-drawer--open" : ""}`}
        id="admin-navigation-drawer"
        onKeyDown={trapDrawerFocus}
        ref={drawerRef}
        role={sidebarOpen ? "dialog" : undefined}
      >
        <AdminSidebar
          active={active}
          onClose={closeDrawer}
          onLogout={logout}
          onNavigate={() => setSidebarOpen(false)}
          staff={staff}
        />
      </div>
      <div className="admin-main">
        <header className="admin-header">
          <Button
            aria-controls="admin-navigation-drawer"
            aria-expanded={sidebarOpen}
            aria-label="Open administrator navigation"
            className="admin-menu-button"
            icon="menu"
            onClick={() => setSidebarOpen(true)}
            ref={menuButtonRef}
            size="sm"
            variant="quiet"
          >
            <span className="sr-only">Open menu</span>
          </Button>
          <div className="admin-search">
            <Input
              aria-label="Search administrator records"
              icon="search"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
              placeholder="Search records, plots, or names..."
              value={search}
            />
            {search ? (
              <div className="admin-search-results" role="status">
                <p>Search the protected operational dataset in Burial Records.</p>
                <Link
                  href={`/admin/burial-records?query=${encodeURIComponent(search)}`}
                  onClick={() => setSearch("")}
                >
                  Search for “{search}”
                </Link>
              </div>
            ) : null}
          </div>
          <div className="admin-header__actions">
            <Link className="admin-public-link" href="/">
              <Icon name="arrowUpRight" size={16} />
              <span>Open Public Site</span>
            </Link>
            <span className="admin-environment-badge">{localSupabaseConfig.environmentLabel}</span>
            <Link
              aria-label="View administrator audit activity"
              className="admin-header-icon"
              href="/admin/audit-log"
            >
              <Icon name="bell" size={18} />
            </Link>
            <Link
              aria-label="Open administrator help"
              className="admin-header-icon admin-help-button"
              href="/admin/support"
            >
              <Icon name="help" size={18} />
            </Link>
            <ThemeToggle compact />
            <span className="admin-header__divider" />
            <span className="admin-header-profile" title={`Signed in as ${staff.username}`}>
              <span aria-hidden="true" className="admin-avatar">{initials}</span>
              <span className="admin-header-profile__copy">
                <strong>{staff.username}</strong>
                <span>{staff.role}</span>
              </span>
            </span>
            <button
              className="admin-logout-button"
              disabled={loggingOut}
              onClick={logout}
              type="button"
            >
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </header>
        <main className="admin-content" id="admin-main-content" tabIndex={-1}>
          <StaffContext.Provider value={staff}>{children}</StaffContext.Provider>
        </main>
      </div>
    </div>
  );
}
