import type { ReactNode } from "react";
import { VisitorBottomNav } from "./visitor-bottom-nav";
import { VisitorHeader } from "./visitor-header";

export function VisitorShell({ children, wide = false, backHref, backLabel }: { children: ReactNode; wide?: boolean; backHref?: string; backLabel?: string }) {
  return <div className={`visitor-shell${wide ? " visitor-shell--wide" : ""}`}><a className="skip-link" href="#main-content">Skip to main content</a><VisitorHeader backHref={backHref} backLabel={backLabel} /><main className="visitor-main" id="main-content" tabIndex={-1}>{children}</main><VisitorBottomNav /></div>;
}
