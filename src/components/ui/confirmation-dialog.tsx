import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { Icon } from "./icons";

type ConfirmationDialogProps = { open: boolean; title: string; description: ReactNode; confirmLabel?: string; cancelLabel?: string; variant?: "primary" | "danger"; onConfirm: () => void; onClose: () => void };

export function ConfirmationDialog({ open, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "primary", onConfirm, onClose }: ConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirmation-dialog-title" aria-describedby="confirmation-dialog-description" onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-topline">
          <span className="dialog-icon"><Icon name="alert" size={22} /></span>
          <button aria-label="Close confirmation dialog" className="icon-button" onClick={onClose} type="button"><Icon name="x" size={20} /></button>
        </div>
        <h2 id="confirmation-dialog-title">{title}</h2>
        <div className="dialog-description" id="confirmation-dialog-description">{description}</div>
        <div className="dialog-actions">
          <Button ref={cancelButtonRef} onClick={onClose} variant="secondary">{cancelLabel}</Button>
          <Button onClick={onConfirm} variant={variant === "danger" ? "danger" : "primary"}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
