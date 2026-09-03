import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "quiet"; size?: "sm" | "md" | "lg"; icon?: IconName; iconAfter?: IconName; children?: ReactNode };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ className, variant = "primary", size = "md", icon, iconAfter, children, type = "button", ...props }, ref) {
  return (
    <button className={cn("button", `button--${variant}`, `button--${size}`, className)} ref={ref} type={type} {...props}>
      {icon && <Icon name={icon} size={size === "sm" ? 16 : 18} />}
      <span>{children}</span>
      {iconAfter && <Icon name={iconAfter} size={size === "sm" ? 16 : 18} />}
    </button>
  );
});
