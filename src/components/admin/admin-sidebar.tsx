import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { StaffAccount } from "@/lib/supabase/types";

type AdminNavItem = {
  label: string;
  icon: IconName;
  href: string;
  adminOnly?: boolean;
  managerHidden?: boolean;
};

const mainNavItems: AdminNavItem[] = [
  { label: "Dashboard", icon: "dashboard", href: "/admin" },
  { label: "Burial Records", icon: "records", href: "/admin/burial-records" },
  { label: "Cemetery Map", icon: "map", href: "/admin/cemetery-map" },
  {
    label: "Coordinate Verification",
    icon: "verification",
    href: "/admin/coordinate-verification",
    managerHidden: true,
  },
  { label: "Plot Management", icon: "grid", href: "/admin/plot-management" },
  { label: "Owner data", icon: "userSearch", href: "/admin/owner-data" },
  { label: "Photos", icon: "photos", href: "/admin/photos" },
];

const systemNavItems: AdminNavItem[] = [
  { label: "Reports", icon: "reports", href: "/admin/reports" },
  { label: "Audit Log", icon: "audit", href: "/admin/audit-log" },
  { label: "Recovery", icon: "audit", href: "/admin/recovery", adminOnly: true },
  {
    label: "Account Management",
    icon: "users",
    href: "/admin/accounts",
    adminOnly: true,
  },
  {
    label: "Settings",
    icon: "settings",
    href: "/admin/settings",
    managerHidden: true,
  },
];

export const adminNavItems = [...mainNavItems, ...systemNavItems];

type AdminSidebarProps = {
  active: string;
  staff: StaffAccount;
  onNavigate?: () => void;
  onLogout?: () => void;
  onClose?: () => void;
};

export function AdminSidebar({
  active,
  staff,
  onNavigate,
  onLogout,
  onClose,
}: AdminSidebarProps) {
  const initials = staff.username
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "GN";

  function isVisible(item: AdminNavItem) {
    if (item.adminOnly) return staff.role === "ADMIN";
    if (item.managerHidden) return staff.role !== "MANAGER";
    return true;
  }

  function renderLinks(items: AdminNavItem[]) {
    return items.filter(isVisible).map((item) => {
      const isActive = item.label === active;
      return (
        <Link
          aria-current={isActive ? "page" : undefined}
          className={cn("admin-nav-link", isActive && "admin-nav-link--active")}
          href={item.href}
          key={item.label}
          onClick={onNavigate}
        >
          <Icon name={item.icon} size={18} />
          <span>{item.label}</span>
          {isActive ? <span aria-hidden="true" className="admin-nav-current" /> : null}
        </Link>
      );
    });
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__top">
        <div className="admin-sidebar__brand">
          <span className="admin-brand-mark"><Icon name="tree" size={21} /></span>
          <span className="admin-brand-copy">
            <strong>GraveNav <span className="brand-admin-badge">Admin</span></strong>
            <span>Cemetery Management</span>
          </span>
        </div>
        {onClose ? (
          <button
            aria-label="Close administrator navigation"
            className="icon-button admin-sidebar__close"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" size={20} />
          </button>
        ) : null}
      </div>

      <div className="admin-sidebar__body">
        <div className="admin-nav-group">
          <p className="admin-nav-label">Main menu</p>
          <nav aria-label="Primary administrator navigation" className="admin-nav">
            {renderLinks(mainNavItems)}
          </nav>
        </div>
        <div className="admin-nav-group">
          <p className="admin-nav-label">Management &amp; system</p>
          <nav aria-label="Administrator management navigation" className="admin-nav">
            {renderLinks(systemNavItems)}
          </nav>
        </div>
      </div>

      <div className="admin-sidebar__footer">
        <nav aria-label="Administrator support navigation">
          <Link
            aria-current={active === "Support" ? "page" : undefined}
            className={cn(
              "admin-nav-link",
              active === "Support" && "admin-nav-link--active",
            )}
            href="/admin/support"
            onClick={onNavigate}
          >
            <Icon name="support" size={18} />
            <span>Support</span>
          </Link>
          <button
            className="admin-nav-link admin-nav-link--danger admin-nav-button"
            onClick={onLogout}
            type="button"
          >
            <Icon name="logout" size={18} />
            <span>Log Out</span>
          </button>
        </nav>
        <div className="admin-profile-card">
          <span aria-hidden="true" className="admin-avatar admin-profile-card__avatar">
            {initials}
          </span>
          <span className="admin-profile-card__copy">
            <strong>{staff.username}</strong>
            <span>{staff.role === "ADMIN" ? "Administrator" : "Manager"}</span>
          </span>
          <Icon name="more" size={18} />
        </div>
      </div>
    </aside>
  );
}
