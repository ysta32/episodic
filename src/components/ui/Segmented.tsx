"use client";

import { useRef, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";
import { nextIndex } from "./roving";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: IconName;
  /** Required when label is icon-only. */
  ariaLabel?: string;
}

export interface SegmentedProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** Single-choice pill control (radiogroup). Arrow keys move and select. */
export function Segmented<T extends string>({ options, value, onChange, label, size = "md", className }: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const current = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("inline-flex rounded-k-pill border border-line bg-surface-2 p-0.5", className)}
    >
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={o.ariaLabel}
            tabIndex={i === current ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              const n = nextIndex(e.key, i, options.length, "both");
              if (n === null) return;
              e.preventDefault();
              onChange(options[n].value);
              refs.current[n]?.focus();
            }}
            className={cx(
              "inline-flex items-center justify-center gap-1.5 rounded-k-pill font-medium",
              "transition-[background-color,color,box-shadow] duration-(--k-dur-2) ease-k-out",
              size === "sm" ? "h-7 px-3 text-k-sm [&_svg]:size-4" : "h-8 px-3.5 text-k-base [&_svg]:size-[18px]",
              checked ? "bg-surface text-text shadow-k-1" : "text-text-2 hover:text-text",
            )}
          >
            {o.icon && <Icon name={o.icon} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
