"use client";

import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

export interface RatingProps {
  /** 0 = unrated; 0.5 to 5 in half steps. */
  value: number;
  onChange?: (value: number) => void;
  /** Accessible name, e.g. "Your rating for The Bear S3 E2". */
  label: string;
  size?: number;
  readOnly?: boolean;
  className?: string;
}

const STARS = [1, 2, 3, 4, 5];
const clampHalf = (v: number) => Math.min(5, Math.max(0, Math.round(v * 2) / 2));

function describe(v: number) {
  return v === 0 ? "Not rated" : `${v} out of 5 stars`;
}

/** Half-star rating. Keyboard: arrows ±0.5, 1-5 sets whole stars, Home clears, End = 5, Backspace/Delete clears. */
export function Rating({ value, onChange, label, size = 22, readOnly = false, className }: RatingProps) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const interactive = !readOnly && Boolean(onChange);

  const stars = STARS.map((s) => {
    const name = shown >= s ? "star-filled" : shown >= s - 0.5 ? "star-half" : "star";
    return (
      <span key={s} data-star={s} className={cx("inline-flex", shown >= s - 0.5 ? "text-accent" : "text-line-strong")}>
        <Icon name={name} size={size} />
      </span>
    );
  });

  if (!interactive) {
    return (
      <span role="img" aria-label={`${label}: ${describe(value)}`} className={cx("inline-flex gap-0.5", className)}>
        {stars}
      </span>
    );
  }

  const set = (v: number) => onChange?.(clampHalf(v));

  const valueFromPointer = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    return Math.max(0.5, Math.ceil((x / rect.width) * 10) / 2);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = value + 0.5;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = value - 0.5;
    else if (e.key === "Home" || e.key === "Backspace" || e.key === "Delete" || e.key === "0") next = 0;
    else if (e.key === "End") next = 5;
    else if (/^[1-5]$/.test(e.key)) next = Number(e.key);
    else if (e.key === ".") next = value > 0 && value % 1 === 0 ? value - 0.5 : value;
    if (next === null) return;
    e.preventDefault();
    set(next);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value}
      aria-valuetext={describe(value)}
      onKeyDown={onKeyDown}
      onPointerMove={(e) => e.pointerType === "mouse" && setHover(valueFromPointer(e))}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        const v = valueFromPointer(e);
        set(v === value ? 0 : v);
      }}
      className={cx("inline-flex cursor-pointer touch-manipulation gap-0.5 rounded-k-sm py-1", className)}
    >
      {stars}
    </div>
  );
}
