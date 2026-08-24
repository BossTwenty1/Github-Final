import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode; icon?: IconName; trailing?: ReactNode };

export function Input({ className, id, label, hint, icon, trailing, ...props }: InputProps) {
  const inputId = id || props.name || "gravenav-input";

  return (
    <label className="input-field" htmlFor={inputId}>
      {label && <span className="input-label">{label}</span>}
      <span className="input-wrap">
        {icon && <Icon className="input-icon" name={icon} size={19} />}
        <input className={cn("input-control", icon && "input-control--with-icon", Boolean(trailing) && "input-control--with-trailing", className)} id={inputId} {...props} />
        {trailing && <span className="input-trailing">{trailing}</span>}
      </span>
      {hint && <span className="input-hint">{hint}</span>}
    </label>
  );
}
