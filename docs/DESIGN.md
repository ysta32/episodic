# Episodic design: the Kinescope system

Episodic is a local-first TV and film tracker for people who lost TV Time on July 15, 2026. This document covers what
we learned from the category, where we beat it, and the design system ("Kinescope") that every surface uses.
Tokens live in `src/design/tokens.css`, fonts in `src/design/fonts.ts`, and primitives in `src/components/ui/`.

> Research note: this pass was written from first-hand product knowledge (as of mid-2026) rather than a fresh web crawl,
> because no web tool was available in the session. Re-verify specific claims (pricing, feature availability) before
> quoting them on the marketing site. We never quote competitors' numbers as fact.

---

## 1. Research findings

| Product | What it does well | Where it falls short |
|---|---|---|
| **TV Time** (closed) | One-tap "mark watched", per-episode reactions and emotion votes, episode comment threads, a strong "Up next" (watchlist) home, a calendar of upcoming airings, and stats ("time spent watching"). | Ad-heavy, slow, account-locked data, recurring sync bugs, and an export that people had to fight for. When the service died, 25M histories were stranded. |
| **Letterboxd** | Diary as identity: a dated log, ratings in half-stars, reviews as writing, and a yearly "Year in Review". Editorial typography, poster-first grid, and lists as a social object. Restrained palette with three signature accent dots. | Films only, no episode tracking. Social layer is the product, so it can't work offline. Some depth is behind Pro/Patron. |
| **Trakt** | Deep data: scrobbling from Plex, Kodi and others, a history API, lists, a calendar, and "Year in Review". Power-user favorite. | Dense, dated UI. Limited free tier since 2024-25 (list/collection caps). Server-bound. |
| **Serializd** | "Letterboxd for TV": season and episode reviews, a diary, and a clean social feed. | Thin on tracking mechanics (up next, calendar). Network-only. |
| **Sofa** (iOS) | Calm, beautiful organization: custom lists with icons, a "queue" mindset, and fast native gestures. | Apple-only. Not a progress tracker. No import from other services. |
| **Simkl** | Broad import (TV Time, Trakt, MAL), anime support, auto-tracking. | Busy UI, ads, and heavy upsell. Data still lives on their server. |

**Craft references (what we borrow from each)**
- **Linear**: keyboard-first workflow, `Cmd-K` palette as the universal verb, crisp 150-200 ms motion, and optimistic UI everywhere.
- **Things 3**: calm density, tactile checkmarks with a satisfying micro-animation, and generous but deliberate whitespace.
- **Arc**: personality in small moments (copy, easing), with settings that read like a conversation.
- **Raycast**: a palette with sections, inline shortcuts in rows, and fuzzy match highlighting.
- **Apple HIG**: 44 pt touch targets, safe areas, Dynamic Type-like scaling, and reduced-motion rules.
- **Readwise**: import-first onboarding ("bring your history, see value in 60 seconds") and resurfacing old data as a feature.

**Table stakes we must match:** mark episodes and seasons watched (bulk and single), an Up Next queue, an airing calendar,
progress per show, ratings, a diary or history, lists, search and discover, stats, episode threads and reactions, import
from the big services, and export.

## 2. Gaps we beat

1. **Lock-in.** Every competitor holds your history hostage on a server. Episodic stores it on your device, and full
   export is one click to open formats.
2. **Import as onboarding.** Competitors treat import as a buried settings page. For us, it's the first-run experience.
3. **Spoilers.** Threads and synopses on other services show spoilers based on the page, not on you.
4. **Speed.** IndexedDB-local reads are instant, and the app works offline on a train.
5. **Craft.** The category is dominated by dated, ad-cluttered UIs. Letterboxd is the only one with editorial taste, and
   it doesn't do TV.

## 3. Standout features (local-first and unique)

1. **Rewind**: a scrollable timeline of your whole viewing life, built from imported history (TV Time, Trakt, Simkl,
   Letterboxd, IMDb). Group by year, then month, then binge streaks ("You watched 9 episodes of *Severance* in 2 days").
   It's computed locally, so it's private by default. It's shareable as a generated image, never as a hosted profile.
2. **Spoiler Shield**: the app knows exactly where you are in each show. Synopses, stills, thread posts and episode
   titles beyond your progress are blurred and set in Kinescope "redacted" style. You can reveal them one at a time, and
   the shield updates the moment you mark an episode watched.
3. **Episode Pulse**: a small sparkline per episode built from thread reactions over the episode's runtime, so you can
   see where the room gasped. It's spoiler-shielded until you've watched.
4. **Zero lock-in export** (a principle, also a feature): JSON plus CSV in Trakt- and Letterboxd-compatible shapes,
   always available with no account and no wait.

---

## 4. Kinescope design system

*A kinescope was a film recording of a live TV broadcast, the medium where cinema met television.* The system borrows
from film stock, broadcast slates and printed TV listings. It is warm, editorial and precise, not neon-and-gradient
"AI app".

### 4.1 Type

| Role | Face | Why | Token |
|---|---|---|---|
| Display / titles | **Newsreader** (variable, optical size, italics) | Editorial serif with a TV-listings and newspaper heritage. Italic for show titles, the way magazines set them. | `--font-display` |
| UI / text | **Schibsted Grotesk** | Crisp newsroom grotesk with more character than Inter, and very readable at 13-15 px. | `--font-text` |
| Data / timecode | **Martian Mono** | Wide broadcast-slate mono for `S02 · E05`, runtimes, dates and shortcut keys. Use it sparingly at small sizes. | `--font-mono` |

- **Scale** (rem, 1.200 minor-third, with a fluid display): `xs .75` · `sm .8125` · `base .9375` · `md 1.0625` · `lg 1.25` ·
  `xl 1.5` · `2xl clamp(1.75, 3vw, 2.25)` · `3xl clamp(2.25, 5vw, 3.5)` · `hero clamp(2.75, 8vw, 6)`.
- **Rules:** display in Newsreader 500 with `-0.02em` tracking. Show titles are always italic in body copy. Labels
  are Schibsted 600 in caps with `+0.06em` tracking. Use `tabular-nums` for counts. Never set body copy in the serif
  below 17 px.

### 4.2 Color: "Film stock"

The palette uses warm paper and warm ink, not cold grey. Tungsten amber (a stage light) is the single brand accent.
Darkroom safelight red marks danger and live states. Phosphor green marks watched or success. Cyan dye is reserved for
links in long-form text and for info. No gradients except the poster scrim.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--k-bg` | `#F4F0E8` paper | `#100F0D` ink | page |
| `--k-surface` | `#FBF8F2` | `#191714` | cards, sheets |
| `--k-surface-2` | `#ECE6DA` | `#22201C` | wells, hover |
| `--k-line` | `#DCD4C4` | `#302C26` | hairlines |
| `--k-text` | `#1A1814` | `#F2EDE3` | primary text |
| `--k-text-2` | `#5E574B` | `#ABA393` | secondary (AA on bg and surface) |
| `--k-text-3` | `#857C6C` | `#7A7366` | tertiary or meta (large or non-essential text only) |
| `--k-accent` | `#E59A2B` tungsten | `#F0AA3C` | primary fills (ink text on top) |
| `--k-accent-ink` | `#8A5300` | `#F5B95A` | accent as text or icon (AA) |
| `--k-danger` | `#C2381F` safelight | `#F06A4F` | destructive, live |
| `--k-success` | `#2A7247` phosphor | `#5BC489` | watched, success |
| `--k-info` | `#1F6F86` cyan dye | `#62B6CC` | info, links in prose |

Contrast: text on bg is at least 12:1 in both themes. `--k-text-2` is at least 5.5:1. Accent fills carry `--k-on-accent`
(`#1A1206`) text, which is at least 8:1. Never use amber text on paper (use `--k-accent-ink`).

### 4.3 Spacing, radius, elevation

- **Spacing** (4 px base): `0.5=2 · 1=4 · 2=8 · 3=12 · 4=16 · 5=20 · 6=24 · 8=32 · 10=40 · 12=48 · 16=64 · 24=96`.
  Section rhythm on marketing pages is 96/64. App gutters are 16 (mobile), 24 (tablet) and 32 (desktop).
- **Radius:** `--k-radius-xs 3px` (badges, kbd) · `sm 6px` (inputs, buttons) · `md 10px` (cards) · `lg 16px`
  (sheets) · `pill 999px` (segmented, chips). Posters use `sm`, like a printed card rather than a bubble. No "rounded-2xl
  everything".
- **Elevation** (warm-tinted shadows, never pure black on light):
  `--k-shadow-1` hairline lift for cards on hover · `--k-shadow-2` popovers and toasts · `--k-shadow-3` dialogs and the
  palette. In dark mode, elevation is mostly a lighter surface plus a 1 px top highlight (`--k-highlight`), not a shadow.

### 4.4 Motion: "Cut, don't dissolve"

Editing language: things *cut* in quickly and settle. Nothing floats or bounces.

| Token | Value | Use |
|---|---|---|
| `--k-ease-out` | `cubic-bezier(.2,.8,.2,1)` | entrances, most UI |
| `--k-ease-in-out` | `cubic-bezier(.65,0,.35,1)` | sheets, tab indicator |
| `--k-ease-snap` | `cubic-bezier(.3,1.4,.5,1)` | the watched-check stamp only |
| `--k-dur-1` | 90 ms | press, hover color |
| `--k-dur-2` | 160 ms | popovers, toasts, tabs |
| `--k-dur-3` | 240 ms | sheets, dialogs |
| `--k-dur-4` | 420 ms | progress fills, Rewind transitions |

- Only `transform` and `opacity` are animated (60 fps). Never animate layout or box-shadow on scroll.
- The signature moment is the **watched stamp**: the check draws its stroke in 240 ms with `ease-snap`, and the row
  tints phosphor for 600 ms.
- **Reduced motion:** all durations collapse to 0.01 ms, skeleton shimmer becomes a static tone, and stamps appear
  without drawing. Respect both `prefers-reduced-motion` and `[data-motion="reduce"]`, which can be set from Settings.

### 4.5 Iconography

There is one custom set in `src/components/ui/Icon.tsx`: a 24 px grid, 1.75 px stroke, round caps and joins, and
`currentColor`. Each icon has a slight film-slate geometry with square-ish terminals and no filled blobs. The set covers
check, check-double (season), plus, close, search, play, calendar, queue (up next), library, compass (discover), user,
settings, star, star-half, spoiler (eye-slash), pulse, rewind, import, export, undo, chevron L/R/D, more, alert, offline,
command, filter, list, trash, external, sun, moon and grip. Decorative icons get `aria-hidden`, and icon-only buttons
require a `label`. **No emoji anywhere in the UI chrome.**

### 4.6 Voice and tone

We sound like a friend who works at a repertory cinema: knowledgeable, warm, brief and a little wry. We never sound
like a growth marketer.

| Do | Don't |
|---|---|
| "Bring your TV Time history. It stays on this device." | "Unlock the power of your viewing data!" |
| "Marked S2 · E5 watched. Undo" | "Success! Episode updated successfully." |
| "Nothing airing this week. Good time to start something from your list." | "No data found." |
| "Couldn't reach TVmaze. Your library is fine, and we'll retry when you're back online." | "Error 503: request failed." |
| "Export everything (JSON + CSV)" | "Supercharge your workflow with seamless export" |
| "Spoilers past E4 are hidden." | "Spoiler alert!!" |

Rules: use sentence case everywhere. Use numerals ("3 episodes"). Write "you" and "your". Never blame the user. Errors
say what happened, what's safe, and what to do next. Button labels are verbs ("Import", "Mark watched"). Banned words:
supercharge, unlock, revolutionize, seamless, effortless, game-changer, magic, "AI-powered", leverage.

### 4.7 Component inventory (`src/components/ui`)

`Button` (primary / secondary / ghost / danger, sizes sm/md/lg, loading keeps width) · `IconButton` (required label,
tooltip via `title`) · `Card` (plain / interactive / inset) · `Skeleton` (+ `SkeletonText`, `SkeletonPoster`) ·
`Toast` (`ToastProvider`, `useToast`, with undo action and a pause on hover or focus) · `Dialog` and `Sheet` (native
`<dialog>`, focus trap, Esc, scroll lock, bottom sheet on mobile, side sheet ≥md) · `Tabs` (roving tabindex, arrow keys) ·
`Segmented` (radiogroup) · `Badge` (neutral / accent / success / danger / outline, plus the `mono` slate variant) ·
`ProgressBar` (determinate, with a `segments` mode for per-episode ticks) · `EmptyState` (icon, title, body, action) ·
`CommandPalette` (`Cmd/Ctrl-K`) · `Kbd` · `Rating` (half-star, keyboard arrows, clearable).
Next in product tasks: PosterCard, EpisodeRow (with the watched stamp), ShowHeader, SpoilerShield, PulseSparkline,
RewindTimeline, AppShell (sidebar plus bottom tabs).

### 4.8 State patterns

| State | Pattern |
|---|---|
| **First-run** | Full-bleed "Bring your history" screen. It shows four importer tiles (TV Time, Trakt, Simkl, Letterboxd/IMDb), a "Start fresh" text link, and the line "Your data never leaves this device unless you export it." |
| **Empty** | `EmptyState` with a custom icon, a one-line title, one sentence of help, and exactly one primary action. Left-aligned in content areas and centered only in full-page voids. |
| **Loading** | Skeletons that match the final geometry (posters 2:3, rows 56 px). No spinners except inside a busy `Button`. Show skeletons only after 120 ms to avoid flashing. |
| **Error** | Inline banner with `--k-danger` hairline, plus what's safe and a Retry button. Never a blank page. Route-level errors use the same voice. |
| **Offline** | Persistent quiet pill in the shell ("Offline · changes saved locally"). Metadata fetches queue, and threads show cached posts read-only. |
| **Success** | Optimistic first. Show a toast with Undo for 6 s on destructive or bulk actions. Small actions get only the micro-animation, with no toast. |

### 4.9 Keyboard and command palette

Global shortcuts: `Cmd/Ctrl-K` palette · `/` search · `g u` Up Next · `g c` Calendar · `g d` Discover · `g l` Library ·
`g r` Rewind · `?` shortcut sheet · `t` toggle theme. Lists: `j`/`k` move · `x` or `Space` mark watched · `Shift-X` mark
season · `r` rate (then `1-5`, `.` for half) · `Enter` open · `Esc` back or close. Shortcuts are ignored while typing in
inputs.

**Palette spec.** It opens with `Cmd/Ctrl-K` and closes with `Esc` or a backdrop click. It accepts `commands: {id, label,
group?, hint?, keywords?, shortcut?, icon?, run}[]`. Fuzzy match is subsequence-based with prefix and word-start
bonuses, and matched characters are bolded. Results are grouped by `group` in the order given. `↑`/`↓` move, `Enter`
runs, and the active row scrolls into view. The palette is ARIA `combobox` + `listbox` with `aria-activedescendant`.
Focus is restored to the opener on close. The empty result reads "No matches for "…"".

### 4.10 Layout grid

| Range | Columns | Gutter | Shell |
|---|---|---|---|
| 320-639 | 4 | 16 | bottom tab bar (safe-area aware), sheets from bottom |
| 640-1023 | 8 | 24 | bottom tabs, 2-3 poster columns |
| 1024-1439 | 12 | 32 | 240 px sidebar, content max 1120 |
| 1440-1919 | 12 | 32 | sidebar, content max 1280, optional right rail (thread, details) |
| ≥1920 | 12 | 40 | content max 1440 with the rail. Posters scale by count, not size (auto-fill minmax(148px,1fr)). |

Posters are always 2:3 with an aspect-ratio box (zero layout shift). Text measure is 68ch maximum.

### 4.11 Banned tells

Purple or blue AI gradients, coral+violet, gradient-blob heroes, glassmorphism stacks, emoji section headers,
"Supercharge/Unlock/Revolutionize" copy, everything centered, identical 3-up feature cards, default shadcn grey with
`rounded-xl` everywhere, lorem or placeholder copy, fake testimonials, user counts, logos or press quotes, spinners where
skeletons belong, unstyled focus rings or scrollbars, layout shift from late images or fonts, toast spam for trivial
actions, and modals for things that should be inline.

### 4.12 Applying the system (for the restyle tasks)

1. In `globals.css`, add `@import "../design/tokens.css";` right after `@import "tailwindcss";`, then delete the
   starter `:root`, `@theme` and `body` rules.
2. In `layout.tsx`, swap Geist for `fontVariables` from `@/design/fonts` on `<html>`. Add
   `suppressHydrationWarning` and a tiny inline script that sets `data-theme` from localStorage before paint.
3. Use the theme utilities: `bg-bg` and `bg-surface`, `text-text` and `text-text-2`, `border-line`, `bg-accent` with
   `text-on-accent`, `text-accent-ink`, `font-display`, `text-k-xl`, `rounded-k-md`, `shadow-k-2`, `ease-k-out`, and
   `duration-(--k-dur-2)`. Helper classes: `k-slate` (mono label), `k-tabular`, `k-skeleton`, `k-enter-up`, `k-stamp`.
4. Mount `<ToastProvider>` once in the app shell, and mount `<CommandPalette commands={...} />` once per surface.
