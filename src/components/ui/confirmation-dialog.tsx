import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./button";
import { Icon } from "./icons";

type ConfirmationDialogProps = { open: boolean; title: string; description: ReactNode; confirmLabel?: string; cancelLabel?: string; variant?: "primary" | "danger"; onConfirm: () => void; onClose: () => void };

export function ConfirmationDialog({ open, title, description, confirmLabel = "Confirm", cancelLabel = "Cancel", variant = "primary", onConfirm, onClose }: ConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || []).filter((element) => element.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
    function containFocus(event: FocusEvent) {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) cancelButtonRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", containFocus);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div ref={dialogRef} tabIndex={-1} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onMouseDown={(event) => event.stopPropagation()}>
        <div className="dialog-topline">
          <span className="dialog-icon"><Icon name="alert" size={22} /></span>
          <button aria-label="Close confirmation dialog" className="icon-button" onClick={onClose} type="button"><Icon name="x" size={20} /></button>
        </div>
        <h2 id={titleId}>{title}</h2>
        <div className="dialog-description" id={descriptionId}>{description}</div>
        <div className="dialog-actions">
          <Button ref={cancelButtonRef} onClick={onClose} variant="secondary">{cancelLabel}</Button>
          <Button onClick={onConfirm} variant={variant === "danger" ? "danger" : "primary"}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
