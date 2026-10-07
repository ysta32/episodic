"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./cx";
import { useNativeDialog } from "./Dialog";
import { fuzzyMatch } from "./fuzzy";
import { Icon, type IconName } from "./Icon";
import { Kbd } from "./Kbd";

export interface PaletteCommand {
  id: string;
  label: string;
  /** Section heading; groups render in first-seen order. */
  group?: string;
  /** Secondary text on the right, e.g. "Show" or "S02 · E05". */
  hint?: string;
  /** Extra search terms that don't render. */
  keywords?: string[];
  /** Shortcut chord shown on the row, e.g. ["g", "u"] or ["mod", "shift", "e"]. */
  shortcut?: string[];
  icon?: IconName;
  disabled?: boolean;
  run: () => void;
}

export interface CommandPaletteProps {
  commands: PaletteCommand[];
  /** Controlled open state (optional). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Bind Cmd/Ctrl-K globally. Default true. */
  hotkey?: boolean;
  placeholder?: string;
}

interface Ranked {
  cmd: PaletteCommand;
  indices: number[];
  score: number;
}

function Highlight({ text, indices }: { text: string; indices: number[] }): ReactNode {
  if (indices.length === 0) return text;
  const set = new Set(indices);
  return Array.from(text).map((ch, i) =>
    set.has(i) ? (
      <mark key={i} className="bg-transparent font-semibold text-text">
        {ch}
      </mark>
    ) : (
      <span key={i}>{ch}</span>
    ),
  );
}

export function CommandPalette({ commands, open: openProp, onOpenChange, hotkey = true, placeholder = "Type a command or search…" }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const [apple, setApple] = useState(true);
  useEffect(() => {
    setApple(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey, open, setOpen]);

  if (!open) return null;
  return <PaletteDialog commands={commands} onClose={() => setOpen(false)} placeholder={placeholder} apple={apple} />;
}

function PaletteDialog({ commands, onClose, placeholder, apple }: { commands: PaletteCommand[]; onClose: () => void; placeholder: string; apple: boolean }) {
  const ref = useNativeDialog(true, onClose);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const base = useId();

  const ranked = useMemo<Ranked[]>(() => {
    const out: Ranked[] = [];
    for (const cmd of commands) {
      if (cmd.disabled) continue;
      const m = fuzzyMatch(query, cmd.label);
      if (m) {
        out.push({ cmd, indices: m.indices, score: m.score });
        continue;
      }
      const extra = [cmd.hint, cmd.group, ...(cmd.keywords ?? [])].filter((s): s is string => Boolean(s));
      const best = extra.map((k) => fuzzyMatch(query, k)).find((x) => x !== null);
      if (best) out.push({ cmd, indices: [], score: best.score - 5 });
    }
    if (!query.trim()) return out;
    return out.sort((a, b) => b.score - a.score);
  }, [commands, query]);

  // Grouped view keeps first-seen group order; with a query, the best group floats up because ranked is sorted.
  const groups = useMemo(() => {
    const map = new Map<string, Ranked[]>();
    for (const r of ranked) {
      const g = r.cmd.group ?? "";
      const list = map.get(g);
      if (list) list.push(r);
      else map.set(g, [r]);
    }
    return Array.from(map.entries());
  }, [ranked]);
  const flat = useMemo(() => groups.flatMap(([, rows]) => rows), [groups]);

  const clampedActive = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);
  const activeId = clampedActive >= 0 ? `${base}-opt-${flat[clampedActive].cmd.id}` : undefined;

  useEffect(() => {
    if (!activeId) return;
    const el = document.getElementById(activeId);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const run = (cmd: PaletteCommand) => {
    onClose();
    // Defer so focus restoration happens before the command navigates or opens something else.
    window.setTimeout(() => cmd.run(), 0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
      e.preventDefault();
      if (flat.length) setActive((clampedActive + 1) % flat.length);
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
      e.preventDefault();
      if (flat.length) setActive((clampedActive - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (clampedActive >= 0) run(flat[clampedActive].cmd);
    }
  };

  let index = -1;
  return (
    <dialog
      ref={ref}
      aria-label="Command palette"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={cx(
        "k-dialog m-0 mx-auto mt-[12vh] w-[calc(100%-1.5rem)] max-w-[600px] overflow-hidden rounded-k-lg border border-line",
        "bg-surface p-0 text-text shadow-k-3 backdrop:bg-transparent",
      )}
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Icon name="search" size={18} className="text-text-3" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={`${base}-list`}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label="Search commands"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          className="h-14 min-w-0 flex-1 bg-transparent text-k-md text-text outline-none placeholder:text-text-3 focus-visible:shadow-none"
        />
        <Kbd apple={apple} keys={["esc"]} className="hidden sm:inline-flex" />
      </div>
      <ul
        ref={listRef}
        id={`${base}-list`}
        role="listbox"
        aria-label="Commands"
        className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain p-2"
      >
        {flat.length === 0 && (
          <li role="presentation" className="px-3 py-8 text-center text-k-base text-text-2">
            No matches for &ldquo;{query.trim()}&rdquo;
          </li>
        )}
        {groups.map(([group, rows]) => (
          <li key={group || "_"} role="presentation">
            {group && (
              <div role="presentation" className="k-slate px-3 pb-1 pt-3 text-text-3">
                {group}
              </div>
            )}
            <ul role="group" aria-label={group || undefined}>
              {rows.map((r) => {
                index += 1;
                const i = index;
                const selected = i === clampedActive;
                return (
                  <li
                    key={r.cmd.id}
                    id={`${base}-opt-${r.cmd.id}`}
                    role="option"
                    aria-selected={selected}
                    onPointerMove={() => {
                      if (!selected) setActive(i);
                    }}
                    onClick={() => run(r.cmd)}
                    className={cx(
                      "flex h-11 cursor-pointer items-center gap-3 rounded-k-sm px-3 text-k-base",
                      selected ? "bg-surface-2 text-text" : "text-text-2",
                    )}
                  >
                    {r.cmd.icon ? (
                      <Icon name={r.cmd.icon} size={18} className={selected ? "text-accent-ink" : "text-text-3"} />
                    ) : (
                      <span className="w-[18px]" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      <Highlight text={r.cmd.label} indices={r.indices} />
                    </span>
                    {r.cmd.hint && <span className="truncate text-k-sm text-text-3">{r.cmd.hint}</span>}
                    {r.cmd.shortcut && <Kbd apple={apple} keys={r.cmd.shortcut} className="hidden sm:inline-flex" />}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
      <div className="hidden items-center gap-4 border-t border-line px-4 py-2 text-k-xs text-text-3 sm:flex">
        <span className="inline-flex items-center gap-1.5">
          <Kbd apple={apple} keys={["up"]} />
          <Kbd apple={apple} keys={["down"]} /> to move
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Kbd apple={apple} keys={["enter"]} /> to run
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <Kbd apple={apple} keys={["mod", "K"]} /> to toggle
        </span>
      </div>
    </dialog>
  );
}
