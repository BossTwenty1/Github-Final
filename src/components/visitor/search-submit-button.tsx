"use client";

import { useFormStatus } from "react-dom";
import { Icon } from "@/components/ui/icons";

export function SearchSubmitButton({ compact = false, label }: { compact?: boolean; label: string }) {
  const { pending } = useFormStatus();
  return <button aria-live="polite" className={compact ? "public-results-search__submit" : "button button--primary button--lg button--full"} disabled={pending} type="submit"><Icon name="search" size={compact ? 15 : 18} /><span>{pending ? "Searching…" : label}</span></button>;
}
