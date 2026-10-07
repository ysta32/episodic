"use client";

import Link from "next/link";
import { Icon, cx } from "@/components/ui";
import type { UpNextItem } from "@/lib/library";
import { ShowPoster } from "./ShowPoster";

export function slate(season: number, number: number): string {
  return `S${season} E${number}`;
}

export interface UpNextCardProps {
  item: UpNextItem;
  onWatched: (item: UpNextItem) => void;
  /** Briefly true after a tap so the phosphor stamp plays while the card leaves. */
  stamped?: boolean;
}

export function UpNextCard({ item, onWatched, stamped }: UpNextCardProps) {
  const { show, next, remaining } = item;
  const after = remaining - 1;
  return (
    <li
      data-upnext
      className={cx(
        "group flex items-stretch gap-3 rounded-k-md border border-line bg-surface p-2.5 pr-2 shadow-[inset_0_1px_0_var(--k-highlight)]",
        "transition-[border-color,background-color] duration-(--k-dur-2) ease-k-out hover:border-line-strong",
        stamped && "border-success bg-success-wash",
      )}
    >
      <Link
        href={`/app/show/${encodeURIComponent(show.id)}`}
        className="w-16 shrink-0 rounded-k-sm sm:w-20"
        aria-label={`Open ${show.title}`}
        tabIndex={-1}
      >
        <ShowPoster src={show.poster} title={show.title} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <Link
          href={`/app/show/${encodeURIComponent(show.id)}`}
          className="truncate font-display text-k-md font-medium italic tracking-[-0.01em] text-text hover:underline"
        >
          {show.title}
        </Link>
        <Link
          href={`/app/episode/${encodeURIComponent(next.id)}`}
          className="flex min-w-0 items-baseline gap-2 rounded-k-xs text-k-sm text-text-2 hover:text-text"
        >
          <span className="k-slate shrink-0 text-accent-ink">{slate(next.season, next.number)}</span>
          <span className="truncate">{next.title ?? `Episode ${next.number}`}</span>
        </Link>
        <p className="k-slate text-text-3">
          {after > 0 ? `${after} more after this` : "Last one aired so far"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onWatched(item)}
        data-watched-button
        aria-label={`Mark ${show.title} ${slate(next.season, next.number)} watched`}
        title="Mark watched (x)"
        className={cx(
          "grid size-11 shrink-0 cursor-pointer self-center place-items-center rounded-k-pill border border-line-strong text-text-2",
          "transition-[background-color,color,border-color,transform] duration-(--k-dur-1) ease-k-out",
          "hover:border-success hover:bg-success-wash hover:text-success active:scale-95",
          stamped && "border-success bg-success text-bg",
        )}
      >
        <Icon name="check" size={20} className={stamped ? "k-stamp" : undefined} />
      </button>
    </li>
  );
}
