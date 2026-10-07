import type { ComponentProps } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./Icon";

export interface IconButtonProps extends Omit<ComponentProps<"button">, "children"> {
  icon: IconName;
  /** Required accessible name; also used as the native tooltip. */
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "secondary" | "primary";
  /** For toggle buttons (e.g. spoiler reveal, favorite). */
  pressed?: boolean;
}

const sizes = { sm: "size-8 [&_svg]:size-4", md: "size-10 [&_svg]:size-5", lg: "size-12 [&_svg]:size-6" };
const variants = {
  ghost: "text-text-2 hover:bg-surface-2 hover:text-text aria-pressed:text-accent-ink",
  secondary: "bg-surface border border-line-strong text-text hover:bg-surface-2",
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
};

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "ghost",
  pressed,
  className,
  type = "button",
  title,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={title ?? label}
      aria-pressed={pressed}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-k-sm transition-[background-color,color,transform]",
        "duration-(--k-dur-1) ease-k-out active:scale-95 disabled:pointer-events-none disabled:opacity-45",
        sizes[size],
        variants[variant],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
