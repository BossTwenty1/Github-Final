import type { ReactNode } from "react";
import { VisitorBottomNav } from "./visitor-bottom-nav";
import { VisitorHeader } from "./visitor-header";

export function VisitorShell({ children }: { children: ReactNode }) {
  return <div className="visitor-shell"><VisitorHeader /><main className="visitor-main">{children}</main><VisitorBottomNav /></div>;
}
