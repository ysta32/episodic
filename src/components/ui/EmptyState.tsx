import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  /** Exactly one primary action, plus an optional quiet secondary. */
  action?: ReactNode;
  secondary?: ReactNode;
  /** Left-aligned in content areas (default); centered only for full-page voids. */
  align?: "start" | "center";
  className?: string;
}

export function EmptyState({ icon = "slate", title, children, action, secondary, align = "start", className }: EmptyStateProps) {
  const centered = align === "center";
  return (
    <section
      className={cx(
        "flex flex-col gap-3 rounded-k-md border border-dashed border-line-strong px-5 py-8 sm:px-8",
        centered ? "items-center text-center" : "items-start",
        className,
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-k-sm bg-surface-2 text-accent-ink">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="font-display text-k-xl font-medium tracking-[-0.01em] text-text">{title}</h3>
      {children && <div className="max-w-[52ch] text-k-base text-text-2">{children}</div>}
      {(action || secondary) && (
        <div className={cx("mt-2 flex flex-wrap items-center gap-3", centered && "justify-center")}>
          {action}
          {secondary}
        </div>
      )}
    </section>
  );
}
