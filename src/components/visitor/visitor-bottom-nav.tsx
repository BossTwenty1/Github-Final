"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icons";
import type { IconName } from "@/components/ui/icons";

const destinations: Array<{ id: string; label: string; icon: IconName; href: string }> = [
  { id: "home", label: "Home", icon: "home", href: "/" },
  { id: "search", label: "Search", icon: "search", href: "/search" },
  { id: "map", label: "Map", icon: "map", href: "/map" },
];

function activeDestination(pathname: string) {
  if (pathname === "/") return "home";
  if (["/search", "/results", "/record-not-found", "/gravesite"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return "search";
  if (["/map", "/navigation"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) return "map";
  return null;
}

export function VisitorBottomNav() {
  const pathname = usePathname() || "/";
  const active = activeDestination(pathname);

  return (
    <nav aria-label="Visitor navigation" className="visitor-bottom-nav">
      <div className="visitor-bottom-nav__inner">
        {destinations.map((destination) => {
          const isActive = destination.id === active;
          return <Link aria-current={isActive ? "page" : undefined} className={cn("visitor-nav-link", isActive && "visitor-nav-link--active")} href={destination.href} key={destination.id}><Icon name={destination.icon} size={19} /><span>{destination.label}</span></Link>;
        })}
      </div>
    </nav>
  );
}
