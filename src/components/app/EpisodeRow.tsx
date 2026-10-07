"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cx, Icon, Skeleton } from "@/components/ui";
import type { Episode, Settings } from "@/lib/types";
import { episodeHref, slate } from "./useMeta";

/** Format an ISO date ("2026-10-07") as a local calendar day without timezone drift. */
export function formatAirdate(iso: string | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, opts);
}

export interface EpisodeRowProps {
  episode: Episode;
  watched: boolean;
  aired: boolean;
  /** Spoiler Shield: true when this episode is past the viewer's progress. */
  shielded: boolean;
  spoilerMode: Settings["spoilerMode"];
  onToggle: (episode: Episode, next: boolean) => void;
  showTitle?: string;
}

/** 56px+ episode row: watched stamp, slate, title (links to the episode thread), shielded synopsis. */
export function EpisodeRow({ episode, watched, aired, shielded, spoilerMode, onToggle, showTitle }: EpisodeRowProps) {
  const [stampKey, setStampKey] = useState(0);
  const [tint, setTint] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const label = slate(episode.season, episode.number);
  const guard = shielded && spoilerMode !== "show" && !revealed;
  const hideTitle = guard && spoilerMode === "hide";
  const title = episode.title?.trim() || `Episode ${episode.number}`;
  const airs = formatAirdate(episode.airdate, { month: "short", day: "numeric" });
  const airsLong = formatAirdate(episode.airdate);

  useEffect(() => {
    if (!tint) return;
    const t = window.setTimeout(() => setTint(false), 600);
    return () => window.clearTimeout(t);
  }, [tint]);

  const toggle = () => {
    const next = !watched;
    if (next) {
      setStampKey((k) => k + 1);
      setTint(true);
    }
    onToggle(episode, next);
  };

  const actionLabel = `${watched ? "Mark unwatched" : "Mark watched"}: ${label}${hideTitle ? "" : `, ${title}`}`;

  return (
    <li
      className={cx(
        "group relative flex min-h-14 items-start gap-3 rounded-k-sm px-2 py-2 sm:gap-4 sm:px-3",
        "transition-colors duration-(--k-dur-2) ease-k-out hover:bg-surface-2",
        tint && "bg-success-wash hover:bg-success-wash",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={!aired && !watched}
        aria-pressed={watched}
        aria-label={actionLabel}
        title={!aired && !watched ? "Not aired yet" : actionLabel}
        className={cx(
          "relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-k-sm",
          "transition-[background-color,color,transform,border-color] duration-(--k-dur-1) ease-k-out active:scale-95",
          "disabled:cursor-not-allowed disabled:opacity-45",
          watched
            ? "bg-success text-bg"
            : "border border-line-strong text-text-3 hover:border-success hover:text-success",
        )}
      >
        {watched ? (
          <Icon key={stampKey} name="check" size={20} strokeWidth={2.25} className={stampKey > 0 ? "k-stamp" : undefined} />
        ) : aired ? (
          <Icon name="check" size={18} className="opacity-0 transition-opacity duration-(--k-dur-1) group-hover:opacity-60" />
        ) : (
          <Icon name="calendar" size={18} />
        )}
      </button>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="k-slate shrink-0 text-text-3">{label}</span>
          <Link
            href={episodeHref(episode.id)}
            className={cx(
              "min-w-0 truncate rounded-k-xs text-k-base font-medium text-text",
              "after:absolute after:inset-0 after:rounded-k-sm after:content-['']",
              hideTitle && "text-text-3",
            )}
            aria-label={hideTitle ? `${label}${showTitle ? ` of ${showTitle}` : ""}, title hidden. Open discussion` : undefined}
          >
            {hideTitle ? "Title hidden" : title}
          </Link>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-k-sm text-text-2">
          {aired ? (
            airs && <time dateTime={episode.airdate}>{airsLong}</time>
          ) : (
            <span className="font-medium text-accent-ink">{airs ? `Airs ${airs}` : "Air date to be announced"}</span>
          )}
          {episode.runtime ? (
            <>
              {airs && <span aria-hidden className="text-text-3">·</span>}
              <span className="k-tabular">{episode.runtime} min</span>
            </>
          ) : null}
        </div>
        {episode.summary &&
          (guard ? (
            <div className="relative z-10 mt-1.5 flex items-start gap-2">
              {spoilerMode === "blur" && (
                <p aria-hidden className="line-clamp-2 min-w-0 flex-1 select-none text-k-sm text-text-2 blur-[5px]">
                  {episode.summary}
                </p>
              )}
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className={cx(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-k-sm px-2 text-k-sm font-medium text-text-2",
                  "transition-colors duration-(--k-dur-1) hover:bg-surface-3 hover:text-text",
                  spoilerMode === "blur" && "absolute left-0 top-1/2 -translate-y-1/2 bg-surface/90 shadow-k-1",
                )}
                aria-label={`Reveal spoilers for ${label}`}
              >
                <Icon name="spoiler" size={16} />
                {spoilerMode === "blur" ? "Reveal" : "Spoiler hidden · Reveal"}
              </button>
            </div>
          ) : (
            <p className="mt-1.5 line-clamp-3 max-w-[68ch] text-k-sm text-text-2">{episode.summary}</p>
          ))}
      </div>

      <Icon
        name="chevron-right"
        size={18}
        className="mt-3 hidden text-text-3 transition-transform duration-(--k-dur-1) group-hover:translate-x-0.5 sm:block"
      />
    </li>
  );
}

/** Geometry-matched placeholder for a row (56px). */
export function EpisodeRowSkeleton({ delay = 120 }: { delay?: number }) {
  return (
    <li aria-hidden className="flex min-h-14 items-start gap-3 px-2 py-2 sm:gap-4 sm:px-3">
      <Skeleton className="size-11" delay={delay} />
      <div className="flex flex-1 flex-col gap-2 py-1">
        <Skeleton className="h-3.5 w-2/5" delay={delay} />
        <Skeleton className="h-3 w-1/4" delay={delay} />
      </div>
    </li>
  );
}
