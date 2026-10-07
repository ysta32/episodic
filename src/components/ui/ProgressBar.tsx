import { cx } from "./cx";

export interface ProgressBarProps {
  value: number;
  max?: number;
  /** Accessible name, e.g. "Severance progress". */
  label: string;
  /** Human text for screen readers, e.g. "14 of 19 episodes". */
  valueText?: string;
  /** Render discrete ticks (one per episode) instead of a continuous fill. Capped at 60 for legibility. */
  segments?: number;
  tone?: "accent" | "success";
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  valueText,
  segments,
  tone = "accent",
  size = "sm",
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const pct = (clamped / safeMax) * 100;
  const fill = tone === "success" ? "bg-success" : "bg-accent";
  const height = size === "md" ? "h-2" : "h-1";
  const common = {
    role: "progressbar" as const,
    "aria-label": label,
    "aria-valuemin": 0,
    "aria-valuemax": safeMax,
    "aria-valuenow": clamped,
    "aria-valuetext": valueText ?? `${Math.round(pct)}%`,
  };

  if (segments && segments > 0 && segments <= 60) {
    const done = Math.round((clamped / safeMax) * segments);
    return (
      <div {...common} className={cx("flex w-full gap-0.5", height, className)}>
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={cx("flex-1 rounded-[1px]", i < done ? fill : "bg-surface-3")} />
        ))}
      </div>
    );
  }

  return (
    <div {...common} className={cx("w-full overflow-hidden rounded-k-pill bg-surface-3", height, className)}>
      <div
        className={cx("h-full origin-left rounded-k-pill transition-transform duration-(--k-dur-4) ease-k-out", fill)}
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}
