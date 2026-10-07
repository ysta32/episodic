import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cx } from "@/components/ui/cx";
import { REACTIONS, type Reaction } from "@/lib/social/types";
import { SpoilerRow } from "./SpoilerRow";

/*
 * Live product previews rendered with the real Kinescope primitives and static sample data.
 * The show is a real, public series (Severance, Apple TV+). No counts, users or quotes are invented:
 * reaction chips have no numbers, and the pulse curve is labelled as an illustration.
 */

const SHOW = "Severance";
const SEASON = 2;
const TOTAL = 10;
const EPISODES = [
  { n: 3, title: "Who Is Alive?", state: "watched" as const },
  { n: 4, title: "Woe's Hollow", state: "next" as const },
  { n: 5, title: "Trojan's Horse", state: "shielded" as const },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** A typographic stand-in for a poster: 2:3, printed-card radius, no image request, no layout shift. */
export function TitleCard({ title, line, className }: { title: string; line: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cx(
        "relative flex aspect-[2/3] flex-col justify-between overflow-hidden rounded-k-sm bg-[#1d2a2c] p-2.5 text-[#e9efe9]",
        "shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]",
        className,
      )}
    >
      <span className="k-slate text-[0.5625rem] text-[#9fb5b0]">{line}</span>
      <span className="font-display text-[1.05rem] font-medium italic leading-[1.05] tracking-[-0.01em]">{title}</span>
      <span aria-hidden className="absolute -right-6 top-6 size-16 rounded-full border border-[#e9efe9]/15" />
    </div>
  );
}

export function UpNextPreview() {
  return (
    <Card padding="none" className="overflow-hidden shadow-k-2">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="inline-flex items-center gap-2 text-k-sm font-semibold">
          <Icon name="queue" size={16} className="text-accent-ink" />
          Up next
        </span>
        <span className="k-slate text-text-3">Sample</span>
      </div>
      <div className="flex gap-4 p-4">
        <TitleCard title={SHOW} line={`S${pad(SEASON)}`} className="w-[76px] shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-k-lg font-medium italic leading-tight tracking-[-0.01em]">{SHOW}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-k-sm text-text-2">
            <Badge mono tone="accent">
              S{pad(SEASON)} · E{pad(4)}
            </Badge>
            <span className="truncate">Woe&apos;s Hollow</span>
          </p>
          <div className="mt-4">
            <ProgressBar value={3} max={TOTAL} segments={TOTAL} label={`${SHOW} season ${SEASON} progress`} valueText={`3 of ${TOTAL} episodes`} />
            <p className="k-tabular mt-1.5 text-k-xs text-text-3">3 of {TOTAL} watched</p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line bg-surface-2/60 px-4 py-3">
        <span className="inline-flex h-8 items-center gap-1.5 rounded-k-sm bg-accent px-3 text-k-sm font-semibold text-on-accent">
          <Icon name="check" size={16} />
          Mark watched
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-k-xs text-text-3">
          Press <kbd className="k-slate rounded-k-xs border border-line-strong bg-surface px-1.5 py-0.5 text-text-2">X</kbd>
        </span>
      </div>
    </Card>
  );
}

/** Episode list with the watched stamp, the next episode, and a Spoiler Shield row you can reveal (CSS only). */
export function EpisodeListPreview() {
  return (
    <Card padding="none" className="overflow-hidden shadow-k-2">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-k-sm font-semibold">
          <i className="font-display text-k-md font-medium">{SHOW}</i> <span className="text-text-3">· Season {SEASON}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-k-xs text-text-2">
          <Icon name="spoiler" size={14} />
          Spoilers past E4 hidden
        </span>
      </div>
      <ul className="divide-y divide-line">
        {EPISODES.map((ep) => (
          <li key={ep.n} className="relative">
            {ep.state === "shielded" ? (
              <SpoilerRow
                slate={`E${pad(ep.n)}`}
                title={ep.title}
                synopsis="Lumon's next move lands where the team least expects it."
              />
            ) : (
              <div className={cx("flex items-center gap-3 px-4 py-3.5", ep.state === "next" && "bg-accent-wash/50")}>
                <span className="k-slate w-11 shrink-0 text-text-3">E{pad(ep.n)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-k-base font-medium">{ep.title}</p>
                  <p className="text-k-xs text-text-3">{ep.state === "watched" ? "Watched" : "Next to watch"}</p>
                </div>
                {ep.state === "watched" ? (
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-success-wash text-success">
                    <Icon name="check" size={18} strokeWidth={2.25} className="k-stamp" label="Watched" />
                  </span>
                ) : (
                  <Badge tone="accent">Up next</Badge>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

const REACTION_LABEL: Record<Reaction, string> = {
  love: "Loved it",
  lol: "Laughed",
  shocked: "Shocked",
  sad: "Sad",
  angry: "Angry",
  bored: "Bored",
};

/** The real reaction set from the social contract, as a native radio group. No invented counts. */
export function ReactionPreview() {
  return (
    <Card padding="none" className="overflow-hidden shadow-k-2">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-k-sm font-semibold">
          How was <i className="font-display text-k-md font-medium">E03</i>?
        </span>
        <span className="k-slate text-text-3">Try it</span>
      </div>
      <fieldset className="flex flex-wrap gap-2 p-4">
        <legend className="sr-only">React to {SHOW} season 2 episode 3</legend>
        {REACTIONS.map((r) => (
          <label
            key={r}
            className={cx(
              "relative inline-flex h-9 cursor-pointer select-none items-center rounded-k-pill border border-line-strong px-3.5 text-k-sm font-medium text-text-2",
              "transition-[transform,background-color,color,border-color] duration-(--k-dur-1) ease-k-out active:scale-95",
              "hover:border-text-3 hover:text-text has-[:checked]:border-accent has-[:checked]:bg-accent has-[:checked]:text-on-accent",
              "has-[:focus-visible]:shadow-(--k-focus-ring)",
            )}
          >
            <input type="radio" name="k-reaction-demo" value={r} className="sr-only" defaultChecked={r === "shocked"} />
            {REACTION_LABEL[r]}
          </label>
        ))}
      </fieldset>
      <div className="border-t border-line px-4 pb-4 pt-3">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-k-xs font-semibold text-text-2">
            <Icon name="pulse" size={14} className="text-danger" />
            Episode Pulse
          </span>
          <span className="k-slate text-text-3">Illustration</span>
        </div>
        <PulseLine />
        <div className="k-slate mt-1 flex justify-between text-text-3">
          <span>Cold open</span>
          <span>Credits</span>
        </div>
      </div>
    </Card>
  );
}

/** Illustrative reaction density over an episode's runtime. Shape only, no values. */
export function PulseLine({ className }: { className?: string }) {
  const d =
    "M0 34 C 20 33, 34 30, 48 31 S 80 28, 96 26 S 120 30, 136 22 S 156 8, 166 6 S 180 24, 196 27 S 228 25, 244 20 S 262 2, 272 3 S 288 18, 300 22";
  return (
    <svg viewBox="0 0 300 40" className={cx("mt-2 h-10 w-full overflow-visible", className)} aria-hidden preserveAspectRatio="none">
      <path d={`${d} L300 40 L0 40 Z`} fill="var(--k-danger-wash)" opacity="0.7" />
      <path d={d} fill="none" stroke="var(--k-danger)" strokeWidth="1.75" vectorEffect="non-scaling-stroke" className="k-pulse-line" />
    </svg>
  );
}
