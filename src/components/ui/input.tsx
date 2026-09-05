import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "./icons";

type InputProps = InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement>; label?: string; hint?: ReactNode; icon?: IconName; trailing?: ReactNode };

export function Input({ className, id, label, hint, icon, trailing, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const hintId = `${inputId}-hint`;

  return (
    <label className="input-field" htmlFor={inputId}>
      {label && <span className="input-label">{label}</span>}
      <span className="input-wrap">
        {icon && <Icon className="input-icon" name={icon} size={19} />}
        <input className={cn("input-control", icon && "input-control--with-icon", Boolean(trailing) && "input-control--with-trailing", className)} id={inputId} {...props} aria-describedby={[props["aria-describedby"], hint ? hintId : null].filter(Boolean).join(" ") || undefined} />
        {trailing && <span className="input-trailing">{trailing}</span>}
      </span>
      {hint && <span id={hintId} className="input-hint">{hint}</span>}
    </label>
  );
}
