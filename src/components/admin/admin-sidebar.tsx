import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import type { IconName } from "@/components/ui/icons";
import type { StaffRole } from "@/lib/supabase/types";
import { ThemeToggle } from "@/components/theme-toggle";

export const adminNavItems: Array<{ label: string; icon: IconName; href: string }> = [
  { label: "Dashboard", icon: "dashboard", href: "/admin" },
  { label: "Burial Records", icon: "records", href: "/admin/burial-records" },
  { label: "Cemetery Map", icon: "map", href: "/admin/cemetery-map" },
  { label: "Coordinate Verification", icon: "verification", href: "/admin/coordinate-verification" },
  { label: "Plot Management", icon: "grid", href: "/admin/plot-management" },
  { label: "Owner data", icon: "userSearch", href: "/admin/owner-data" },
  { label: "Photos", icon: "photos", href: "/admin/photos" },
  { label: "Reports", icon: "reports", href: "/admin/reports" },
  { label: "Audit Log", icon: "audit", href: "/admin/audit-log" },
  { label: "Recovery", icon: "audit", href: "/admin/recovery" },
  { label: "Settings", icon: "settings", href: "/admin/settings" },
];

export function AdminSidebar({ active, role, onNavigate, onLogout, onClose }: { active: string; role: StaffRole; onNavigate?: () => void; onLogout?: () => void; onClose?: () => void }) {
  const visibleItems = role === "ADMIN" ? [...adminNavItems.slice(0, -1), { label: "Account Management", icon: "users" as IconName, href: "/admin/accounts" }, adminNavItems[adminNavItems.length - 1]] : adminNavItems.filter((item) => !["Settings", "Recovery", "Coordinate Verification"].includes(item.label));
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__top"><div className="admin-sidebar__brand"><BrandLockup admin /></div>{onClose ? <button aria-label="Close administrator navigation" className="icon-button admin-sidebar__close" onClick={onClose} type="button"><Icon name="close" size={20} /></button> : null}</div>
      <nav aria-label="Administrator navigation" className="admin-nav">
        {visibleItems.map((item) => <Link className={cn("admin-nav-link", item.label === active && "admin-nav-link--active")} href={item.href} key={item.label} onClick={onNavigate}><Icon name={item.icon} size={20} /><span>{item.label}</span></Link>)}
      </nav>
      <div className="admin-sidebar__footer">
        <ThemeToggle />
        <Link className={cn("admin-nav-link", active === "Support" && "admin-nav-link--active")} href="/admin/support" onClick={onNavigate}><Icon name="support" size={20} /><span>Support</span></Link>
        <button className="admin-nav-link admin-nav-link--danger admin-nav-button" onClick={onLogout} type="button"><Icon name="logout" size={20} /><span>Log Out</span></button>
      </div>
    </aside>
  );
}
