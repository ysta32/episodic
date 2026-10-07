import type { ComponentProps } from "react";
import { cx } from "./cx";

export interface BadgeProps extends ComponentProps<"span"> {
  tone?: "neutral" | "accent" | "success" | "danger" | "info" | "outline";
  /** Broadcast-slate style: mono, caps. Use for S02 · E05, runtimes, "NEW", "LIVE". */
  mono?: boolean;
}

const tones = {
  neutral: "bg-surface-2 text-text-2",
  accent: "bg-accent-wash text-accent-ink",
  success: "bg-success-wash text-success",
  danger: "bg-danger-wash text-danger",
  info: "bg-info-wash text-info",
  outline: "border border-line-strong text-text-2",
};

export function Badge({ tone = "neutral", mono = false, className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-k-xs px-1.5 [&_svg]:size-3",
        mono ? "k-slate" : "text-k-xs font-semibold",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}
