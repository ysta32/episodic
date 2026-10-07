"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/Icon";

const KEY = "episodic:theme";
const listeners = new Set<() => void>();

function resolved(): "light" | "dark" {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
  };
}

/** Flips between light and dark and remembers the choice (read before paint by the root layout). */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, resolved, () => null);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(KEY, next);
        } catch {
          // Private mode or storage disabled: the toggle still applies for this visit.
        }
        listeners.forEach((l) => l());
      }}
      aria-label={theme ? `Switch to ${next} theme` : "Toggle theme"}
      title={theme ? `Switch to ${next} theme` : "Toggle theme"}
      className="inline-flex size-10 items-center justify-center rounded-k-sm text-text-2 transition-colors duration-(--k-dur-1) hover:bg-surface-2 hover:text-text"
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={18} className={theme ? undefined : "opacity-0"} />
    </button>
  );
}
