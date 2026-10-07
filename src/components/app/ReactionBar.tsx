"use client";

import { REACTIONS, type Reaction, type ReactionCounts } from "@/lib/social/types";
import { cx } from "@/components/ui";

const LABEL: Record<Reaction, string> = {
  love: "Loved it",
  lol: "Laughed",
  shocked: "Shocked",
  sad: "Sad",
  angry: "Angry",
  bored: "Bored",
};

const TONE: Record<Reaction, string> = {
  love: "bg-accent",
  lol: "bg-success",
  shocked: "bg-info",
  sad: "bg-text-3",
  angry: "bg-danger",
  bored: "bg-line-strong",
};

export interface ReactionBarProps {
  counts: ReactionCounts | null;
  mine: Reaction | null;
  onPick: (r: Reaction) => void;
  disabled?: boolean;
  /** Episode Pulse stays redacted until the episode is watched. */
  shielded: boolean;
}

/** Six reactions plus Episode Pulse: how the room split, as one proportional strip. */
export function ReactionBar({ counts, mine, onPick, disabled, shielded }: ReactionBarProps) {
  const total = counts ? REACTIONS.reduce((n, r) => n + counts[r], 0) : 0;
  return (
    <section aria-labelledby="reactions-h" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="reactions-h" className="k-slate text-text-2">How did it land?</h2>
        <span className="k-tabular text-k-xs text-text-3">{total === 1 ? "1 reaction" : `${total} reactions`}</span>
      </div>
      <div role="group" aria-label="Your reaction" className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-3">
        {REACTIONS.map((r) => {
          const on = mine === r;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onPick(r)}
              className={cx(
                "flex min-h-11 items-center justify-between gap-2 rounded-k-sm border px-3 text-k-sm font-semibold",
                "transition-[background-color,border-color,transform] duration-(--k-dur-1) ease-k-out active:translate-y-px",
                "disabled:pointer-events-none disabled:opacity-45",
                on
                  ? "border-accent-ink bg-accent-wash text-accent-ink"
                  : "border-line-strong bg-surface text-text hover:bg-surface-2",
              )}
            >
              <span>{LABEL[r]}</span>
              <span className="k-tabular font-mono text-k-xs text-text-2">
                {shielded ? "·" : (counts?.[r] ?? 0)}
                <span className="sr-only">{shielded ? " hidden until you have watched" : ""}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="k-slate text-text-3">Episode pulse</span>
          {shielded && <span className="text-k-xs text-text-3">Hidden until you&apos;ve watched</span>}
        </div>
        {shielded || total === 0 ? (
          <div
            className={cx("h-2 rounded-k-pill bg-surface-2", shielded && "k-skeleton")}
            role="img"
            aria-label={shielded ? "Episode pulse hidden to avoid spoilers" : "No reactions yet"}
          />
        ) : (
          <div
            role="img"
            aria-label={`Reactions: ${REACTIONS.filter((r) => counts && counts[r] > 0)
              .map((r) => `${LABEL[r]} ${counts?.[r] ?? 0}`)
              .join(", ")}`}
            className="flex h-2 gap-0.5 overflow-hidden rounded-k-pill"
          >
            {REACTIONS.map((r) => {
              const n = counts?.[r] ?? 0;
              return n > 0 ? (
                <span
                  key={r}
                  className={cx("h-full origin-left", TONE[r])}
                  style={{ flexGrow: n, flexBasis: 0 }}
                />
              ) : null;
            })}
          </div>
        )}
      </div>
    </section>
  );
}
