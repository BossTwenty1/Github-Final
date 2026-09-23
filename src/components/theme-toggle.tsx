"use client";

import { useLayoutEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const STORAGE_KEY = "gravenav-theme";

function storedTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function resolveTheme(): Theme {
  return storedTheme() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function applyTheme(theme: Theme, persist: boolean) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The selected theme still applies for this page when storage is unavailable.
    }
  }
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useLayoutEffect(() => {
    const syncTheme = () => {
      const current = resolveTheme();
      applyTheme(current, false);
      setTheme(current);
    };
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      if (storedTheme()) return;
      const next = media.matches ? "dark" : "light";
      applyTheme(next, false);
      setTheme(next);
    };
    const syncStoredTheme = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = event.newValue === "light" || event.newValue === "dark" ? event.newValue : media.matches ? "dark" : "light";
      applyTheme(next, false);
      setTheme(next);
    };

    syncTheme();
    media.addEventListener("change", syncSystemTheme);
    window.addEventListener("storage", syncStoredTheme);
    return () => {
      media.removeEventListener("change", syncSystemTheme);
      window.removeEventListener("storage", syncStoredTheme);
    };
  }, []);

  function chooseTheme(next: Theme) {
    applyTheme(next, true);
    setTheme(next);
  }

  if (compact) {
    const activeTheme = theme ?? "dark";
    const nextTheme: Theme = activeTheme === "dark" ? "light" : "dark";
    return (
      <button
        aria-label={`Switch to ${nextTheme} mode`}
        className="theme-toggle-button"
        onClick={() => chooseTheme(nextTheme)}
        title={`Switch to ${nextTheme} mode`}
        type="button"
      >
        <Icon name={activeTheme === "dark" ? "moon" : "sun"} size={17} />
      </button>
    );
  }

  return (
    <div aria-label="Color theme" className={cn("theme-toggle")} role="group">
      <button aria-label="Use light mode" aria-pressed={theme === "light"} className="theme-toggle__option" onClick={() => chooseTheme("light")} type="button">
        <Icon name="sun" size={16} />
        <span>Light</span>
      </button>
      <button aria-label="Use dark mode" aria-pressed={theme === "dark"} className="theme-toggle__option" onClick={() => chooseTheme("dark")} type="button">
        <Icon name="moon" size={16} />
        <span>Dark</span>
      </button>
    </div>
  );
}
