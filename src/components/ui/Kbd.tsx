import type { ComponentProps } from "react";
import { cx } from "./cx";

/** Keyboard key cap. Pass `keys` to render a chord, e.g. keys={["mod", "K"]}. "mod" renders ⌘ on Apple, Ctrl elsewhere. */
export interface KbdProps extends ComponentProps<"kbd"> {
  keys?: string[];
  /** Override platform detection (useful for SSR-stable output). */
  apple?: boolean;
}

const glyphs: Record<string, string> = {
  shift: "⇧",
  enter: "↵",
  esc: "Esc",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  alt: "⌥",
};

function label(key: string, apple: boolean) {
  const k = key.toLowerCase();
  if (k === "mod") return apple ? "⌘" : "Ctrl";
  if (k === "alt" && !apple) return "Alt";
  return glyphs[k] ?? (key.length === 1 ? key.toUpperCase() : key);
}

const cap =
  "inline-flex h-5 min-w-5 items-center justify-center rounded-k-xs border border-line-strong border-b-2 " +
  "bg-surface px-1 font-mono text-[0.625rem] leading-none text-text-2";

export function Kbd({ keys, apple = true, className, children, ...rest }: KbdProps) {
  if (!keys) return <kbd className={cx(cap, className)} {...rest}>{children}</kbd>;
  return (
    <kbd className={cx("inline-flex items-center gap-0.5", className)} {...rest}>
      {keys.map((k, i) => (
        <kbd key={`${k}-${i}`} className={cap}>
          {label(k, apple)}
        </kbd>
      ))}
    </kbd>
  );
}
