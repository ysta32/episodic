"use client";

import { useEffect, useRef, useState } from "react";
import type { Comment } from "@/lib/social/types";
import { Skeleton } from "@/components/ui";

type Gif = NonNullable<Comment["gif"]>;

const KEY = process.env.NEXT_PUBLIC_GIPHY_KEY;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Giphy serves from media0..4.giphy.com; the thread API only accepts media.giphy.com. */
function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !/^media\d*\.giphy\.com$/.test(u.hostname)) return null;
    u.hostname = "media.giphy.com";
    u.search = "";
    return u.toString();
  } catch {
    return null;
  }
}

function parseGifs(json: unknown): Gif[] {
  if (!isRecord(json) || !Array.isArray(json.data)) return [];
  const out: Gif[] = [];
  for (const item of json.data) {
    if (!isRecord(item) || !isRecord(item.images) || !isRecord(item.images.fixed_height)) continue;
    const img = item.images.fixed_height;
    const url = typeof img.url === "string" ? canonicalUrl(img.url) : null;
    const width = Number(img.width);
    const height = Number(img.height);
    if (url && Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0) {
      out.push({ url, width, height, provider: "giphy" });
    }
  }
  return out;
}

export function gifPickerEnabled(): boolean {
  return Boolean(KEY);
}

export function GifPicker({ onPick, onClose }: { onPick: (gif: Gif) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<Gif[] | null>(null);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    if (!KEY) return;
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      const q = query.trim();
      const endpoint = q ? "search" : "trending";
      const params = new URLSearchParams({ api_key: KEY, limit: "12", rating: "pg-13" });
      if (q) params.set("q", q);
      try {
        const res = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params}`, { signal: ctl.signal });
        if (!res.ok) throw new Error("giphy");
        setGifs(parseGifs(await res.json()));
        setFailed(false);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setFailed(true);
          setGifs([]);
        }
      }
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [query]);

  if (!KEY) return null;

  return (
    <div
      className="k-enter-up rounded-k-md border border-line bg-surface p-3 shadow-k-2"
      role="group"
      aria-label="Add a GIF"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search GIPHY"
          aria-label="Search GIFs"
          className="h-11 min-w-0 flex-1 rounded-k-sm border border-line-strong bg-bg px-3 text-k-base text-text placeholder:text-text-3"
        />
        <button
          type="button"
          onClick={onClose}
          className="h-11 rounded-k-sm px-3 text-k-sm font-semibold text-text-2 hover:bg-surface-2 hover:text-text"
        >
          Close
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-live="polite">
        {gifs === null &&
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        {gifs?.map((g) => (
          <button
            key={g.url}
            type="button"
            onClick={() => onPick(g)}
            aria-label="Use this GIF"
            className="overflow-hidden rounded-k-sm bg-surface-2 hover:opacity-90"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- remote animated GIF, no optimizer */}
            <img src={g.url} width={g.width} height={g.height} alt="" loading="lazy" className="h-24 w-full object-cover" />
          </button>
        ))}
      </div>
      {gifs?.length === 0 && (
        <p className="mt-2 text-k-sm text-text-2">
          {failed ? "Couldn't reach GIPHY. Your comment is safe; try again in a moment." : `No GIFs for "${query.trim()}".`}
        </p>
      )}
      <p className="k-slate mt-2 text-text-3">Powered by GIPHY</p>
    </div>
  );
}
