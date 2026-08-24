import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

type AlertVariant = "info" | "success" | "warning" | "danger";
const alertIcons: Record<AlertVariant, IconName> = { info: "info", success: "check", warning: "alert", danger: "alert" };
type AlertProps = { title?: string; children: ReactNode; variant?: AlertVariant; icon?: IconName; className?: string };

export function Alert({ title, children, variant = "info", icon, className }: AlertProps) {
  return (
    <div className={cn("alert", `alert--${variant}`, className)} role="status">
      <Icon className="alert-icon" name={icon || alertIcons[variant]} size={19} />
      <div className="alert-body">
        {title && <p className="alert-title">{title}</p>}
        <div className={cn("alert-copy", title && "alert-copy--with-title")}>{children}</div>
      </div>
    </div>
  );
}
