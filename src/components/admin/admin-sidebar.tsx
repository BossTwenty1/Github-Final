import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import type { IconName } from "@/components/ui/icons";

export const adminNavItems: Array<{ label: string; icon: IconName; href: string }> = [
  { label: "Dashboard", icon: "dashboard", href: "/admin" },
  { label: "Burial Records", icon: "records", href: "/admin/burial-records" },
  { label: "Cemetery Map", icon: "map", href: "/admin/cemetery-map" },
  { label: "Coordinate Verification", icon: "verification", href: "/admin/coordinate-verification" },
  { label: "Plot Management", icon: "grid", href: "/admin/plot-management" },
  { label: "Photos", icon: "photos", href: "/admin/photos" },
  { label: "Reports", icon: "reports", href: "/admin/reports" },
  { label: "Audit Log", icon: "audit", href: "/admin/audit-log" },
  { label: "Settings", icon: "settings", href: "/admin/settings" },
];

export function AdminSidebar({ active, onNavigate }: { active: string; onNavigate?: () => void }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand"><BrandLockup admin /></div>
      <nav aria-label="Administrator navigation" className="admin-nav">
        {adminNavItems.map((item) => <Link className={cn("admin-nav-link", item.label === active && "admin-nav-link--active")} href={item.href} key={item.label} onClick={onNavigate}><Icon name={item.icon} size={20} /><span>{item.label}</span></Link>)}
      </nav>
      <div className="admin-sidebar__footer">
        <Link className={cn("admin-nav-link", active === "Support" && "admin-nav-link--active")} href="/admin/support" onClick={onNavigate}><Icon name="support" size={20} /><span>Support</span></Link>
        <Link className="admin-nav-link admin-nav-link--danger" href="/admin" onClick={onNavigate}><Icon name="logout" size={20} /><span>Log Out</span></Link>
      </div>
    </aside>
  );
}
