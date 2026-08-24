"use client";

import { useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Input } from "@/components/ui/input";
import { searchAdminRecords } from "@/lib/admin-mock-data";

export function AdminShell({ children, active = "Dashboard" }: { children: ReactNode; active?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchResults = searchAdminRecords(search);

  return (
    <div className="admin-shell">
      <div className={`admin-dimmer ${sidebarOpen ? "admin-dimmer--open" : ""}`} onClick={() => setSidebarOpen(false)} />
      <div className={`admin-drawer ${sidebarOpen ? "admin-drawer--open" : ""}`}><AdminSidebar active={active} onNavigate={() => setSidebarOpen(false)} /></div>
      <div className="admin-main">
        <header className="admin-header">
          <Button aria-label="Open administrator navigation" className="admin-menu-button" onClick={() => setSidebarOpen(true)} size="sm" variant="quiet" icon="menu"><span className="sr-only">Open menu</span></Button>
          <div className="admin-search"><Input aria-label="Search administrator records" icon="search" onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)} placeholder="Search records, plots, or names..." value={search} />{search ? <div className="admin-search-results" role="status">{searchResults.length ? searchResults.map((record) => <a href={`/admin/burial-records?record=${record.id}`} key={record.id}><strong>{record.name}</strong><span>{record.id} · {record.plot}</span></a>) : <p>No mock administrator records match “{search}”.</p>}</div> : null}</div>
          <div className="admin-header__actions">
            <button aria-label="View notifications" className="icon-button" type="button"><Icon name="bell" size={20} /></button>
            <button aria-label="Open administrator help" className="icon-button admin-help-button" type="button"><Icon name="help" size={20} /></button>
            <span className="admin-header__divider" />
            <span aria-label="Signed in as Sarah Jenkins" className="admin-avatar">SJ</span>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
