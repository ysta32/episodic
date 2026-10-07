"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CommandPalette, cx, Dialog, Icon, Kbd, type IconName, type PaletteCommand } from "@/components/ui";
import { db } from "@/lib/db";
import { updateSettings } from "@/lib/lists";
import type { TrackStatus } from "@/lib/types";
import { mediaHref, useOnline } from "./useMeta";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Second key of the "g" chord. */
  chord: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/app", label: "Up Next", icon: "queue", chord: "u" },
  { href: "/app/calendar", label: "Calendar", icon: "calendar", chord: "c" },
  { href: "/app/discover", label: "Discover", icon: "compass", chord: "d" },
  { href: "/app/library", label: "Library", icon: "library", chord: "l" },
  { href: "/app/profile", label: "Profile", icon: "user", chord: "p" },
];

const STATUS_LABEL: Record<TrackStatus, string> = {
  watching: "Watching",
  watchlist: "Watchlist",
  completed: "Completed",
  paused: "Paused",
  dropped: "Dropped",
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app" || pathname === "/app/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Shortcuts never fire while the user is typing or a modal owns the keyboard. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "reset", "range"].includes(type);
  }
  return target.getAttribute("role") === "slider" || target.getAttribute("role") === "combobox";
}

function resolvedTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export const SEARCH_INPUT_ID = "discover-search";

// ---------------------------------------------------------------------------

function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/app" className={cx("inline-flex items-baseline gap-1.5 rounded-k-xs", className)} aria-label="Episodic, Up Next">
      <span className="font-display text-k-xl font-medium italic tracking-[-0.02em] text-text">Episodic</span>
      <span aria-hidden className="size-1.5 translate-y-[-0.1em] rounded-full bg-accent" />
    </Link>
  );
}

function OfflinePill({ className }: { className?: string }) {
  const online = useOnline();
  if (online) return null;
  return (
    <span
      role="status"
      className={cx(
        "k-enter-fade inline-flex h-7 items-center gap-1.5 rounded-k-pill border border-line-strong bg-surface px-2.5",
        "text-k-xs font-medium text-text-2",
        className,
      )}
    >
      <Icon name="offline" size={14} className="text-danger" />
      Offline · changes saved locally
    </span>
  );
}

function Sidebar({ pathname, onOpenPalette, apple }: { pathname: string; onOpenPalette: () => void; apple: boolean }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-bg md:flex">
      <div className="flex h-16 items-center px-5">
        <Wordmark />
      </div>
      <div className="px-3">
        <button
          type="button"
          onClick={onOpenPalette}
          className={cx(
            "flex h-10 w-full items-center gap-2.5 rounded-k-sm border border-line bg-surface px-3 text-k-base text-text-3",
            "shadow-[inset_0_1px_0_var(--k-highlight)] transition-colors duration-(--k-dur-1) hover:border-line-strong hover:text-text-2",
          )}
        >
          <Icon name="search" size={16} />
          <span className="flex-1 text-left">Search or jump to…</span>
          <Kbd apple={apple} keys={["mod", "K"]} />
        </button>
      </div>
      <nav aria-label="Primary" className="mt-4 flex-1 px-3">
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "group relative flex h-10 items-center gap-3 rounded-k-sm px-3 text-k-base font-medium",
                    "transition-colors duration-(--k-dur-1) ease-k-out",
                    active ? "bg-surface-2 text-text" : "text-text-2 hover:bg-surface-2/60 hover:text-text",
                  )}
                >
                  {active && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-k-pill bg-accent" />}
                  <Icon name={item.icon} size={18} className={active ? "text-accent-ink" : "text-text-3 group-hover:text-text-2"} />
                  <span className="flex-1">{item.label}</span>
                  <span className="hidden items-center gap-0.5 opacity-0 transition-opacity duration-(--k-dur-1) group-hover:opacity-100 lg:inline-flex">
                    <Kbd>G</Kbd>
                    <Kbd>{item.chord.toUpperCase()}</Kbd>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="flex flex-col items-start gap-3 border-t border-line px-5 py-4">
        <OfflinePill />
        <p className="text-k-xs leading-relaxed text-text-3">
          Your library lives on this device. <Link href="/app/export" className="underline decoration-line-strong underline-offset-2 hover:text-text-2">Export anytime</Link>.
        </p>
      </div>
    </aside>
  );
}

function MobileHeader({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3 border-b border-line bg-bg/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:px-6 md:hidden">
      <Wordmark />
      <OfflinePill className="ml-auto max-[379px]:hidden" />
      <button
        type="button"
        onClick={onOpenPalette}
        aria-label="Search or jump to"
        className="-mr-1.5 ml-auto inline-flex size-11 items-center justify-center rounded-k-sm text-text-2 hover:bg-surface-2 hover:text-text"
      >
        <Icon name="search" size={20} />
      </button>
    </header>
  );
}

function TabBar({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "relative flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-k-sm text-[0.6875rem] font-semibold tracking-[0.01em]",
                  "transition-colors duration-(--k-dur-1)",
                  active ? "text-accent-ink" : "text-text-3 hover:text-text-2",
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    "absolute inset-x-5 top-0 h-0.5 rounded-b-k-pill bg-accent transition-transform duration-(--k-dur-2) ease-k-out",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
                <Icon name={item.icon} size={22} />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["mod", "K"], label: "Search or jump to anything" },
  { keys: ["/"], label: "Search shows and movies" },
  { keys: ["g", "u"], label: "Up Next" },
  { keys: ["g", "c"], label: "Calendar" },
  { keys: ["g", "d"], label: "Discover" },
  { keys: ["g", "l"], label: "Library" },
  { keys: ["g", "p"], label: "Profile" },
  { keys: ["t"], label: "Switch light and dark theme" },
  { keys: ["?"], label: "Show this list" },
];

function ShortcutSheet({ open, onClose, apple }: { open: boolean; onClose: () => void; apple: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" description="They pause while you're typing in a field.">
      <ul className="divide-y divide-line">
        {SHORTCUTS.map((s) => (
          <li key={s.label} className="flex h-11 items-center justify-between gap-4 text-k-base text-text-2">
            <span>{s.label}</span>
            {s.keys.length === 2 && s.keys[0] === "g" ? (
              <span className="inline-flex items-center gap-1 text-k-xs text-text-3">
                <Kbd>G</Kbd> then <Kbd>{s.keys[1].toUpperCase()}</Kbd>
              </span>
            ) : (
              <Kbd apple={apple} keys={s.keys} />
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

/** App chrome: sidebar (md and up) or header + bottom tabs, the command palette, and global shortcuts. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/app";
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [apple, setApple] = useState(true);

  useEffect(() => {
    setApple(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
  }, []);

  const focusSearch = useCallback(() => {
    const input = document.getElementById(SEARCH_INPUT_ID);
    if (input instanceof HTMLInputElement) {
      input.focus();
      input.select();
    } else {
      router.push("/app/discover?focus=1");
    }
  }, [router]);

  const toggleTheme = useCallback(async () => {
    const next = resolvedTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    await updateSettings({ theme: next });
  }, []);

  // Global shortcuts: "g" chords, "/", "t", "?". Cmd/Ctrl-K is bound by the palette itself.
  const chordAt = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      if (isTypingTarget(e.target) || paletteOpen || helpOpen) return;
      if (document.querySelector("dialog[open]")) return;
      const key = e.key.toLowerCase();
      const now = Date.now();
      if (chordAt.current && now - chordAt.current < 1200) {
        chordAt.current = 0;
        const item = NAV_ITEMS.find((n) => n.chord === key);
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (key === "g" && !e.shiftKey) {
        chordAt.current = now;
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        focusSearch();
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (key === "t" && !e.shiftKey) {
        e.preventDefault();
        void toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, focusSearch, toggleTheme, paletteOpen, helpOpen]);

  const library = useLiveQuery(() => db().library.orderBy("updatedAt").reverse().limit(300).toArray(), []);

  const commands = useMemo<PaletteCommand[]>(() => {
    const go: PaletteCommand[] = NAV_ITEMS.map((item) => ({
      id: `go:${item.href}`,
      label: item.label,
      group: "Go to",
      icon: item.icon,
      shortcut: ["g", item.chord],
      run: () => router.push(item.href),
    }));
    const pages: PaletteCommand[] = [
      { id: "go:lists", label: "Lists", group: "Go to", icon: "list", run: () => router.push("/app/lists") },
      { id: "go:import", label: "Import history", group: "Go to", icon: "import", keywords: ["tv time", "trakt", "letterboxd"], run: () => router.push("/app/import") },
      { id: "go:export", label: "Export everything (JSON + CSV)", group: "Go to", icon: "export", keywords: ["backup", "download"], run: () => router.push("/app/export") },
    ];
    const actions: PaletteCommand[] = [
      { id: "act:search", label: "Search shows and movies", group: "Actions", icon: "search", shortcut: ["/"], keywords: ["find", "add", "follow"], run: focusSearch },
      { id: "act:theme", label: "Switch light and dark theme", group: "Actions", icon: "moon", shortcut: ["t"], keywords: ["appearance", "dark mode"], run: () => void toggleTheme() },
      { id: "act:help", label: "Keyboard shortcuts", group: "Actions", icon: "command", shortcut: ["?"], run: () => setHelpOpen(true) },
    ];
    const titles: PaletteCommand[] = (library ?? []).map((entry) => ({
      id: `lib:${entry.id}`,
      label: entry.title,
      group: "Your library",
      hint: `${entry.kind === "show" ? "Show" : "Movie"} · ${STATUS_LABEL[entry.status]}`,
      icon: entry.kind === "show" ? "tv" : "play",
      keywords: [entry.status],
      run: () => router.push(mediaHref(entry.kind, entry.id)),
    }));
    return [...go, ...pages, ...actions, ...titles];
  }, [library, router, focusSearch, toggleTheme]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  return (
    <div className="min-h-dvh bg-bg text-text">
      <a
        href="#main"
        className="sr-only z-50 rounded-k-sm bg-accent px-3 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <Sidebar pathname={pathname} onOpenPalette={openPalette} apple={apple} />
      <MobileHeader onOpenPalette={openPalette} />
      <main
        id="main"
        tabIndex={-1}
        className="min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom))] focus-visible:shadow-none md:pb-16 md:pl-60"
      >
        <div className="mx-auto w-full max-w-[1120px] px-4 pt-5 sm:px-6 sm:pt-6 md:pt-8 lg:px-8 min-[1440px]:max-w-[1280px] min-[1920px]:max-w-[1440px] min-[1920px]:px-10">
          {children}
        </div>
      </main>
      <TabBar pathname={pathname} />
      <CommandPalette
        commands={commands}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        placeholder="Jump to a page or a title in your library…"
      />
      <ShortcutSheet open={helpOpen} onClose={() => setHelpOpen(false)} apple={apple} />
    </div>
  );
}
