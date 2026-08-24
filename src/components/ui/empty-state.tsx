import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

type EmptyStateProps = { title: string; description: string; icon?: IconName; action?: ReactNode; className?: string };

export function EmptyState({ title, description, icon = "search", action, className }: EmptyStateProps) {
  return (
    <div className={cn("empty-state", className)}>
      <span className="empty-state__icon"><Icon name={icon} size={27} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
