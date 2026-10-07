import type { ComponentProps } from "react";
import { cx } from "./cx";

export interface CardProps extends ComponentProps<"div"> {
  /** plain: static surface; interactive: hover lift (wrap in a link/button for semantics); inset: recessed well. */
  variant?: "plain" | "interactive" | "inset";
  padding?: "none" | "sm" | "md" | "lg";
}

const pads = { none: "", sm: "p-3", md: "p-4 sm:p-5", lg: "p-6 sm:p-8" };
const variants = {
  plain: "bg-surface border border-line shadow-[inset_0_1px_0_var(--k-highlight)]",
  interactive:
    "bg-surface border border-line shadow-[inset_0_1px_0_var(--k-highlight)] transition-[transform,box-shadow,border-color] " +
    "duration-(--k-dur-2) ease-k-out hover:-translate-y-0.5 hover:border-line-strong hover:shadow-k-1 motion-reduce:hover:translate-y-0",
  inset: "bg-surface-2 border border-transparent",
};

export function Card({ variant = "plain", padding = "md", className, ...rest }: CardProps) {
  return <div className={cx("rounded-k-md text-text", variants[variant], pads[padding], className)} {...rest} />;
}
