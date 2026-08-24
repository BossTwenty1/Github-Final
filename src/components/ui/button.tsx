import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "quiet"; size?: "sm" | "md" | "lg"; icon?: IconName; iconAfter?: IconName; children?: ReactNode };

export function Button({ className, variant = "primary", size = "md", icon, iconAfter, children, ...props }: ButtonProps) {
  return (
    <button className={cn("button", `button--${variant}`, `button--${size}`, className)} {...props}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      <span>{children}</span>
      {iconAfter && <Icon name={iconAfter} size={size === "sm" ? 16 : 18} />}
    </button>
  );
}
