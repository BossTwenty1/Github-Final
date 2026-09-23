import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { Icon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { VisitorDesktopNav } from "./visitor-bottom-nav";

export function VisitorHeader({ backHref, backLabel = "Go back" }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="visitor-header">
      <div className="visitor-header__inner">
        <div className="visitor-header__brand">{backHref ? <Link aria-label={backLabel} className="icon-button visitor-header__back" href={backHref}><Icon name="arrowLeft" size={21} /></Link> : null}<Link href="/" aria-label="GraveNav home"><BrandLockup compact /></Link></div>
        <VisitorDesktopNav />
        <div className="visitor-header__actions"><ThemeToggle compact /><Link aria-label="Park information and search help" className="icon-button visitor-header__help" href="/search"><Icon name="info" size={19} /></Link></div>
      </div>
    </header>
  );
}
