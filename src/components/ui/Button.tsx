import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a busy indicator, keeps the width stable, and blocks clicks. */
  loading?: boolean;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  children?: ReactNode;
}

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold " +
  "rounded-k-sm transition-[background-color,color,border-color,transform] duration-(--k-dur-1) ease-k-out " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-busy:cursor-progress";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-[inset_0_-1px_0_rgb(0_0_0/0.14)]",
  secondary: "bg-surface text-text border border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-text-2 hover:bg-surface-2 hover:text-text",
  danger: "bg-danger text-[#fff8f2] hover:brightness-110",
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-k-sm [&_svg]:size-4",
  md: "h-10 px-4 text-k-base [&_svg]:size-[18px]",
  lg: "h-12 px-5 text-k-md [&_svg]:size-5",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cx(base, variants[variant], buttonSizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  disabled,
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled}
      aria-busy={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      {...rest}
    >
      <span className={cx("inline-flex items-center gap-2", loading && "invisible")}>
        {leadingIcon && <Icon name={leadingIcon} />}
        {children}
        {trailingIcon && <Icon name={trailingIcon} />}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none"
                style={{ animationDelay: `${i * 120}ms` }}
              />
            ))}
          </span>
        </span>
      )}
    </button>
  );
}
