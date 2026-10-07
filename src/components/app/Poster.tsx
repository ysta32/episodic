"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cx, Icon, Skeleton, SkeletonPoster, SkeletonText, type IconName } from "@/components/ui";

export interface PosterProps {
  src?: string;
  title: string;
  year?: number;
  className?: string;
  /** Load eagerly (above-the-fold hero posters). */
  priority?: boolean;
}

/**
 * 2:3 poster with a fixed aspect box (no layout shift). Missing or broken artwork falls back to a printed
 * title card, set like a repertory-cinema slate, rather than a grey void.
 */
export function Poster({ src, title, year, className, priority = false }: PosterProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const showImage = Boolean(src) && failed !== src;
  return (
    <span
      className={cx(
        "relative block aspect-[2/3] w-full overflow-hidden rounded-k-sm border border-line bg-surface-2",
        "shadow-[inset_0_1px_0_var(--k-highlight)]",
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote TVmaze/TMDB art; next/image would need a remotePatterns config this task doesn't own
        <img
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          onError={() => setFailed(src ?? null)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span aria-hidden className="absolute inset-0 flex flex-col justify-between p-3">
          <span className="k-slate text-text-3">{year ?? "Episodic"}</span>
          <span className="line-clamp-4 font-display text-k-lg font-medium italic leading-tight tracking-[-0.01em] text-text-2">
            {title}
          </span>
          <span className="h-px w-8 bg-accent" />
        </span>
      )}
    </span>
  );
}

export interface PosterCardProps {
  href: string;
  title: string;
  year?: number;
  poster?: string;
  /** Small slate line under the title, e.g. "Show" or "Watching". */
  meta?: ReactNode;
  /** Overlay badge in the poster's top-left corner. */
  badge?: ReactNode;
  /** Actions rendered below the card (outside the link, so they stay separate tab stops). */
  actions?: ReactNode;
  className?: string;
}

/** Poster-first grid card: the poster and title are one link; actions sit beneath as their own controls. */
export function PosterCard({ href, title, year, poster, meta, badge, actions, className }: PosterCardProps) {
  return (
    <div className={cx("group flex min-w-0 flex-col gap-2", className)}>
      <Link href={href} className="flex flex-col gap-2 rounded-k-sm">
        <span className="relative block">
          <Poster
            src={poster}
            title={title}
            year={year}
            className="transition-[transform,border-color] duration-(--k-dur-2) ease-k-out group-hover:-translate-y-0.5 group-hover:border-line-strong motion-reduce:group-hover:translate-y-0"
          />
          {badge && <span className="absolute left-2 top-2">{badge}</span>}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-k-base font-medium leading-snug text-text">
            <span className="italic">{title}</span>
          </span>
          {(year || meta) && (
            <span className="mt-0.5 flex items-center gap-1.5 text-k-sm text-text-2">
              {year && <span className="k-tabular">{year}</span>}
              {year && meta && <span aria-hidden className="text-text-3">·</span>}
              {meta}
            </span>
          )}
        </span>
      </Link>
      {actions}
    </div>
  );
}

export interface MediaHeroProps {
  title: string;
  year?: number;
  poster?: string;
  backdrop?: string;
  /** Slate line above the title, e.g. "Show · HBO". */
  eyebrow: ReactNode;
  /** Badges and meta under the title. */
  meta?: ReactNode;
  summary?: string;
  /** Primary controls (follow, rating). */
  children?: ReactNode;
}

/**
 * Show/movie header: backdrop (or the poster, defocused) under a paper-toned scrim, the poster as a printed card,
 * and an editorial title. The scrim is the only gradient Kinescope allows.
 */
export function MediaHero({ title, year, poster, backdrop, eyebrow, meta, summary, children }: MediaHeroProps) {
  const art = backdrop ?? poster;
  return (
    <section className="relative isolate -mx-4 overflow-hidden border-b border-line sm:mx-0 sm:rounded-k-md sm:border">
      {art && (
        // eslint-disable-next-line @next/next/no-img-element -- remote TVmaze/TMDB art (see Poster)
        <img
          src={art}
          alt=""
          aria-hidden
          decoding="async"
          className={cx(
            "absolute inset-0 -z-20 size-full object-cover",
            backdrop ? "object-[center_25%] opacity-60" : "scale-125 opacity-40 blur-2xl",
          )}
        />
      )}
      <span
        aria-hidden
        className={cx(
          "absolute inset-0 -z-10",
          art
            ? "bg-[linear-gradient(to_top,var(--k-bg)_18%,color-mix(in_oklab,var(--k-bg)_82%,transparent)_55%,color-mix(in_oklab,var(--k-bg)_45%,transparent))] sm:bg-[linear-gradient(to_right,var(--k-bg)_20%,color-mix(in_oklab,var(--k-bg)_85%,transparent)_55%,color-mix(in_oklab,var(--k-bg)_40%,transparent))]"
            : "bg-surface",
        )}
      />
      <div className="grid grid-cols-[minmax(0,7rem)_1fr] items-end gap-4 px-4 pb-6 pt-10 sm:grid-cols-[10rem_1fr] sm:gap-6 sm:p-8 sm:pt-16 lg:grid-cols-[13rem_1fr] lg:gap-8 lg:p-10 lg:pt-24">
        <Poster src={poster} title={title} year={year} priority className="shadow-k-2" />
        <div className="k-enter-up flex min-w-0 flex-col gap-2 self-end sm:gap-3">
          <div className="k-slate flex flex-wrap items-center gap-x-2 text-text-2">{eyebrow}</div>
          <h1 className="font-display text-k-2xl font-medium italic leading-[1.05] tracking-[-0.02em] text-text [overflow-wrap:anywhere] sm:text-k-3xl">
            {title}
          </h1>
          {meta && <div className="flex flex-wrap items-center gap-1.5">{meta}</div>}
        </div>
      </div>
      {(summary || children) && (
        <div className="flex flex-col gap-5 px-4 pb-6 sm:px-8 sm:pb-8 lg:px-10 lg:pb-10">
          {summary && <p className="max-w-[68ch] text-k-md leading-relaxed text-text-2">{summary}</p>}
          {children}
        </div>
      )}
    </section>
  );
}

export function MediaHeroSkeleton() {
  return (
    <div aria-hidden className="-mx-4 border-b border-line bg-surface sm:mx-0 sm:rounded-k-md sm:border">
      <div className="grid grid-cols-[minmax(0,7rem)_1fr] items-end gap-4 px-4 pb-6 pt-10 sm:grid-cols-[10rem_1fr] sm:gap-6 sm:p-8 sm:pt-16 lg:grid-cols-[13rem_1fr] lg:gap-8 lg:p-10 lg:pt-24">
        <SkeletonPoster withTitle={false} delay={120} />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-32" delay={120} />
          <Skeleton className="h-9 w-3/4" delay={120} />
          <Skeleton className="h-5 w-40" delay={120} />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-4 pb-6 sm:px-8 sm:pb-8 lg:px-10">
        <SkeletonText lines={3} delay={120} className="max-w-[68ch]" />
        <Skeleton className="h-10 w-56" delay={120} />
      </div>
    </div>
  );
}

/** Inline banner with a danger hairline: what happened, what's safe, and a retry. */
export function InlineNotice({
  tone = "danger",
  icon = "alert",
  children,
  action,
  className,
}: {
  tone?: "danger" | "info";
  icon?: IconName;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "flex flex-col gap-3 rounded-k-md border p-4 sm:flex-row sm:items-center",
        tone === "danger" ? "border-danger/40 bg-danger-wash/40" : "border-line bg-surface",
        className,
      )}
    >
      <Icon name={icon} size={20} className={cx("shrink-0", tone === "danger" ? "text-danger" : "text-info")} />
      <div className="flex-1 text-k-base text-text">{children}</div>
      {action}
    </div>
  );
}
