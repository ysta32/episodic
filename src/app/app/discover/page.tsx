"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState } from "react";
import { SEARCH_INPUT_ID } from "@/components/app/Nav";
import { InlineNotice, PosterCard } from "@/components/app/Poster";
import { errorMessage, meta, mediaHref, useOnline, useSearch } from "@/components/app/useMeta";
import {
  Badge,
  Button,
  cx,
  EmptyState,
  Icon,
  IconButton,
  Kbd,
  LoadingRegion,
  Segmented,
  SkeletonPoster,
  useToast,
} from "@/components/ui";
import { db } from "@/lib/db";
import { follow, unfollow } from "@/lib/library";
import type { SearchResult } from "@/lib/meta/types";
import type { LibraryEntry, TrackStatus } from "@/lib/types";

type Filter = "all" | "show" | "movie";

const SUGGESTIONS = ["Severance", "The Bear", "Slow Horses", "Shōgun", "Mad Men", "Columbo"];

const STATUS_LABEL: Record<TrackStatus, string> = {
  watching: "Following",
  watchlist: "On watchlist",
  completed: "Completed",
  paused: "Paused",
  dropped: "Dropped",
};

const GRID = "grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]";

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const online = useOnline();
  const { state, retry } = useSearch(query);

  // Restore ?q= on load, and honour "/" from other pages (?focus=1).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) setQuery(q);
    if (params.get("focus") === "1") inputRef.current?.focus();
  }, []);

  // Keep the URL shareable and back-button friendly without a navigation per keystroke.
  const settled = state.status === "done" || state.status === "error" ? state.query : state.status === "idle" ? "" : null;
  useEffect(() => {
    if (settled === null) return;
    const url = new URL(window.location.href);
    if (settled) url.searchParams.set("q", settled);
    else url.searchParams.delete("q");
    url.searchParams.delete("focus");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [settled]);

  const library = useLiveQuery(() => db().library.toArray(), []);
  const byId = useMemo(() => new Map((library ?? []).map((e) => [e.id, e])), [library]);

  const results = useMemo(() => (state.status === "done" ? state.results : []), [state]);
  const counts = useMemo(
    () => ({ show: results.filter((r) => r.kind === "show").length, movie: results.filter((r) => r.kind === "movie").length }),
    [results],
  );
  const visible = filter === "all" ? results : results.filter((r) => r.kind === filter);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex max-w-[68ch] flex-col gap-2">
        <span className="k-slate text-text-3">Discover</span>
        <h1 className="font-display text-k-3xl font-medium leading-[1.05] tracking-[-0.02em] text-text">
          What are we watching <span className="italic">next</span>?
        </h1>
        <p className="text-k-md text-text-2">Search TVmaze for shows and TMDB for films. Anything you follow is saved on this device.</p>
      </header>

      <div className="flex flex-col gap-4">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            inputRef.current?.blur();
          }}
          className="relative max-w-2xl"
        >
          <label htmlFor={SEARCH_INPUT_ID} className="sr-only">
            Search shows and movies
          </label>
          <Icon name="search" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-3" />
          <input
            ref={inputRef}
            id={SEARCH_INPUT_ID}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                setQuery("");
              }
            }}
            placeholder="Title, like Severance or Columbo"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className={cx(
              "h-14 w-full rounded-k-sm border border-line-strong bg-surface pl-12 pr-24 text-k-md text-text",
              "shadow-[inset_0_1px_0_var(--k-highlight)] placeholder:text-text-3",
              "transition-[border-color] duration-(--k-dur-1) hover:border-text-3 focus-visible:border-accent",
              "[&::-webkit-search-cancel-button]:hidden",
            )}
          />
          <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {query ? (
              <IconButton
                icon="close"
                label="Clear search"
                size="md"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
              />
            ) : (
              <Kbd className="mr-2 hidden md:inline-flex">/</Kbd>
            )}
          </span>
        </form>

        {state.status === "done" && results.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented<Filter>
              label="Filter results"
              size="sm"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: <>All <span className="k-tabular text-text-3">{results.length}</span></> },
                { value: "show", label: <>Shows <span className="k-tabular text-text-3">{counts.show}</span></> },
                { value: "movie", label: <>Films <span className="k-tabular text-text-3">{counts.movie}</span></> },
              ]}
            />
          </div>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {state.status === "done" ? `${results.length} results for ${state.query}` : state.status === "error" ? "Search failed" : ""}
        </p>
      </div>

      {state.status === "idle" && <Idle onPick={(q) => setQuery(q)} />}

      {state.status === "loading" && state.previous?.length ? (
        <ul className={cx(GRID, "pointer-events-none opacity-55 transition-opacity duration-(--k-dur-2)")} inert aria-busy="true" aria-label={`Searching for ${state.query}`}>
          {state.previous.map((item) => (
            <li key={item.id}>
              <ResultCard item={item} entry={byId.get(item.id)} />
            </li>
          ))}
        </ul>
      ) : null}

      {state.status === "loading" && !state.previous?.length && (
        <LoadingRegion label={`Searching for ${state.query}`} className={GRID}>
          {Array.from({ length: 12 }, (_, i) => (
            <SkeletonPoster key={i} delay={120} />
          ))}
        </LoadingRegion>
      )}

      {state.status === "error" && (
        <InlineNotice
          icon={online ? "alert" : "offline"}
          className="max-w-2xl"
          action={
            <Button variant="secondary" size="sm" leadingIcon="undo" onClick={retry} disabled={!online}>
              Retry
            </Button>
          }
        >
          {online
            ? "Couldn't reach TVmaze. Your library is fine; try again in a moment."
            : "You're offline. Search needs a connection, but your library works as usual."}
        </InlineNotice>
      )}

      {state.status === "done" && visible.length === 0 && (
        <EmptyState
          icon="search"
          title={results.length ? `No ${filter === "show" ? "shows" : "films"} for “${state.query}”` : `No matches for “${state.query}”`}
          action={
            results.length ? (
              <Button variant="secondary" onClick={() => setFilter("all")}>
                Show all results
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setQuery("")}>
                Clear search
              </Button>
            )
          }
        >
          {results.length
            ? "Switch the filter to see everything that matched."
            : "Try the original title, drop the year, or check the spelling. Films need TMDB, which may not be connected on this server."}
        </EmptyState>
      )}

      {state.status === "done" && visible.length > 0 && (
        <ul className={GRID} aria-label={`Results for ${state.query}`}>
          {visible.map((item, i) => (
            <li key={item.id} className="k-enter-up" style={{ animationDelay: `${Math.min(i, 12) * 24}ms` }}>
              <ResultCard item={item} entry={byId.get(item.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Idle({ onPick }: { onPick: (q: string) => void }) {
  return (
    <section aria-labelledby="discover-try" className="flex flex-col gap-3">
      <h2 id="discover-try" className="text-k-sm font-semibold uppercase tracking-[0.06em] text-text-3">
        Try one of these
      </h2>
      <ul className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className={cx(
                "inline-flex h-11 items-center rounded-k-pill border border-line bg-surface px-4 text-k-base italic text-text-2",
                "transition-[background-color,color,border-color] duration-(--k-dur-1) hover:border-line-strong hover:bg-surface-2 hover:text-text",
              )}
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResultCard({ item, entry }: { item: SearchResult; entry: LibraryEntry | undefined }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<null | "follow" | "watchlist" | "remove">(null);
  const kindLabel = item.kind === "show" ? "Show" : "Film";

  const prefetch = async () => {
    try {
      if (item.kind === "show") await Promise.all([meta().getShow(item.id), meta().getEpisodes(item.id)]);
      else if (!item.id.startsWith("imdb:")) await meta().getMovie(item.id);
    } catch (cause) {
      toast({
        tone: "info",
        title: `Saved ${item.title}. Episode details will load when TVmaze is reachable.`,
        description: errorMessage(cause),
      });
    }
  };

  const add = async (status: TrackStatus, kind: "follow" | "watchlist") => {
    setBusy(kind);
    try {
      await follow({ id: item.id, kind: item.kind, title: item.title, ids: item.ids, status });
      void prefetch();
    } catch (cause) {
      toast({ tone: "danger", title: `Couldn't save ${item.title}. Nothing changed.`, description: errorMessage(cause) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!entry) return;
    const prev = entry;
    setBusy("remove");
    try {
      await unfollow(prev.id);
      toast({
        title: `Removed ${prev.title} from your library.`,
        undo: () => {
          db()
            .library.put(prev)
            .catch((cause: unknown) => toast({ tone: "danger", title: "Couldn't restore it.", description: errorMessage(cause) }));
        },
      });
    } catch (cause) {
      toast({ tone: "danger", title: `Couldn't remove ${prev.title}.`, description: errorMessage(cause) });
    } finally {
      setBusy(null);
    }
  };

  const actions = entry ? (
    <Button
      variant="ghost"
      size="sm"
      leadingIcon="check"
      loading={busy === "remove"}
      onClick={remove}
      aria-label={`${STATUS_LABEL[entry.status]}: remove ${item.title} from your library`}
      title="Remove from library"
      className="w-full justify-start text-success hover:text-danger"
    >
      {STATUS_LABEL[entry.status]}
    </Button>
  ) : item.kind === "show" ? (
    <div className="flex gap-1.5">
      <Button
        variant="secondary"
        size="sm"
        leadingIcon="plus"
        loading={busy === "follow"}
        disabled={busy !== null}
        onClick={() => add("watching", "follow")}
        aria-label={`Follow ${item.title}`}
        className="min-h-11 flex-1 sm:min-h-8"
      >
        Follow
      </Button>
      <IconButton
        icon="list"
        variant="secondary"
        size="sm"
        label={`Add ${item.title} to your watchlist`}
        title="Watchlist"
        disabled={busy !== null}
        onClick={() => add("watchlist", "watchlist")}
        className="size-11 sm:size-8"
      />
    </div>
  ) : (
    <Button
      variant="secondary"
      size="sm"
      leadingIcon="plus"
      loading={busy === "watchlist"}
      disabled={busy !== null}
      onClick={() => add("watchlist", "watchlist")}
      aria-label={`Add ${item.title} to your watchlist`}
      className="min-h-11 w-full sm:min-h-8"
    >
      Watchlist
    </Button>
  );

  return (
    <PosterCard
      href={mediaHref(item.kind, item.id)}
      title={item.title}
      year={item.year}
      poster={item.poster}
      meta={<span>{kindLabel}</span>}
      badge={
        entry ? (
          <Badge tone="success" className="shadow-k-1">
            <Icon name="check" />
            In library
          </Badge>
        ) : undefined
      }
      actions={actions}
    />
  );
}
