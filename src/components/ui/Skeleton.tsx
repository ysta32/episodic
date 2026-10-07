"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "./cx";

export interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  /** Render nothing until this many ms have elapsed, to avoid flashing on fast loads. */
  delay?: number;
  rounded?: "xs" | "sm" | "md" | "pill";
}

const radius = { xs: "rounded-k-xs", sm: "rounded-k-sm", md: "rounded-k-md", pill: "rounded-k-pill" };

function useDelayed(delay: number) {
  const [shown, setShown] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return;
    const t = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);
  return shown;
}

/** Geometry-matched placeholder. Keep the final layout's dimensions to avoid layout shift. */
export function Skeleton({ className, style, delay = 0, rounded = "sm" }: SkeletonProps) {
  const shown = useDelayed(delay);
  return (
    <span
      aria-hidden
      className={cx("block", shown && "k-skeleton", radius[rounded], className)}
      style={style}
    />
  );
}

export function SkeletonText({ lines = 3, className, delay = 0 }: { lines?: number; className?: string; delay?: number }) {
  return (
    <span className={cx("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} delay={delay} className={cx("h-3", i === lines - 1 && lines > 1 ? "w-3/5" : "w-full")} />
      ))}
    </span>
  );
}

/** 2:3 poster placeholder with a title line underneath. */
export function SkeletonPoster({ className, delay = 0, withTitle = true }: { className?: string; delay?: number; withTitle?: boolean }) {
  return (
    <span className={cx("flex flex-col gap-2", className)} aria-hidden>
      <Skeleton delay={delay} className="aspect-[2/3] w-full" />
      {withTitle && <Skeleton delay={delay} className="h-3 w-4/5" />}
    </span>
  );
}

/** Wrap a group of skeletons so assistive tech hears one "Loading" instead of nothing. */
export function LoadingRegion({ label = "Loading", children, className }: { label?: string; children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
