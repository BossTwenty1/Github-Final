import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { Icon } from "@/components/ui/icons";

export function VisitorHeader() {
  return (
    <header className="visitor-header">
      <div className="visitor-header__inner">
        <Link href="/" aria-label="GraveNav home"><BrandLockup compact /></Link>
        <Link aria-label="Open visitor search and help" className="icon-button visitor-header__help" href="/search"><Icon name="help" size={22} /></Link>
      </div>
    </header>
  );
}
