"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { nextIndex } from "./roving";

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Optional count shown after the label. */
  count?: number;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  /** Controlled selection. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string) => void;
  /** Accessible name for the tab list. */
  label: string;
  className?: string;
}

/** WAI-ARIA tabs with automatic activation, roving tabindex, Home/End. */
export function Tabs({ items, value, defaultValue, onValueChange, label, className }: TabsProps) {
  const base = useId();
  const enabled = items.filter((i) => !i.disabled);
  const isEnabled = (id: string | undefined) => id !== undefined && enabled.some((i) => i.id === id);
  const [internal, setInternal] = useState(() => (isEnabled(defaultValue) ? defaultValue : enabled[0]?.id) ?? "");
  const selected = value ?? internal;
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (id: string) => {
    if (value === undefined) setInternal(id);
    onValueChange?.(id);
  };

  const onKeyDown = (e: KeyboardEvent, id: string) => {
    const pos = enabled.findIndex((i) => i.id === id);
    const n = nextIndex(e.key, pos, enabled.length);
    if (n === null) return;
    e.preventDefault();
    const target = enabled[n];
    select(target.id);
    refs.current[items.indexOf(target)]?.focus();
  };

  // Never resolve to a disabled tab: fall back to the first enabled one.
  const active = enabled.find((i) => i.id === selected) ?? enabled[0];

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]">
        {items.map((item, i) => {
          const isSel = item.id === active?.id;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.id}`}
              aria-selected={isSel}
              aria-controls={`${base}-panel-${item.id}`}
              tabIndex={isSel ? 0 : -1}
              disabled={item.disabled}
              onClick={() => select(item.id)}
              onKeyDown={(e) => onKeyDown(e, item.id)}
              className={cx(
                "relative -mb-px inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-k-base font-medium",
                "transition-colors duration-(--k-dur-1) disabled:opacity-45",
                "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:origin-center after:rounded-k-pill after:bg-accent",
                "after:transition-transform after:duration-(--k-dur-2) after:ease-k-out",
                isSel ? "text-text after:scale-x-100" : "text-text-2 hover:text-text after:scale-x-0",
              )}
            >
              {item.label}
              {item.count !== undefined && <span className="font-mono text-[0.6875rem] text-text-3 k-tabular">{item.count}</span>}
            </button>
          );
        })}
      </div>
      {active && (
        <div
          role="tabpanel"
          id={`${base}-panel-${active.id}`}
          aria-labelledby={`${base}-tab-${active.id}`}
          tabIndex={0}
          className="pt-4 focus-visible:rounded-k-sm"
        >
          {active.content}
        </div>
      )}
    </div>
  );
}
