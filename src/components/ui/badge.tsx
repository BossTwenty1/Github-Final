import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

type BadgeProps = { children: ReactNode; variant?: "neutral" | "success" | "warning" | "danger" | "info"; icon?: IconName; className?: string };

export function Badge({ children, variant = "neutral", icon, className }: BadgeProps) {
  return <span className={cn("badge", `badge--${variant}`, className)}>{icon && <Icon name={icon} size={14} />}{children}</span>;
}
