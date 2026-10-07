"use client";

import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { ActionLink } from "@/components/app/EmptyState";
import { buttonClasses, EmptyState, Icon, LoadingRegion, Skeleton } from "@/components/ui";
import { getSettings } from "@/lib/lists";
import { computeStats, type Stats } from "@/lib/stats";

const nf = new Intl.NumberFormat();

function duration(minutes: number): { value: string; unit: string; sub: string } {
  const hours = minutes / 60;
  if (hours >= 48) return { value: (hours / 24).toFixed(1), unit: "days", sub: `${nf.format(Math.round(hours))} hours of watching` };
  return { value: nf.format(Math.round(hours)), unit: "hours", sub: `${nf.format(minutes)} minutes` };
}

/** The last 12 months ending this month, zero-filled so gaps read as gaps. */
function lastMonths(byMonth: Record<string, number>, now = new Date()) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { key: k, short: d.toLocaleDateString(undefined, { month: "short" }), long: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }), count: byMonth[k] ?? 0 };
  });
}

function Stat({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-k-md border border-line bg-surface p-4 shadow-[inset_0_1px_0_var(--k-highlight)]">
      <dt className="k-slate text-text-3">{label}</dt>
      <dd className="flex flex-col">
        <span className="font-display text-k-3xl font-medium leading-none tracking-[-0.02em] k-tabular">
          {value}
          {unit && <span className="ml-1.5 text-k-md font-normal italic text-text-2">{unit}</span>}
        </span>
        {sub && <span className="mt-2 text-k-sm text-text-2">{sub}</span>}
      </dd>
    </div>
  );
}

function MonthChart({ byMonth }: { byMonth: Record<string, number> }) {
  const months = lastMonths(byMonth);
  const max = Math.max(1, ...months.map((m) => m.count));
  const W = 480;
  const H = 160;
  const bar = W / months.length;
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex items-baseline justify-between">
        <span className="k-slate text-text-3">Watches per month, last 12 months</span>
        <span className="k-slate k-tabular text-text-3">peak {nf.format(max)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label={`Bar chart of watches per month. Peak month had ${max}.`} className="w-full overflow-visible">
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--k-line-strong)" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--k-line)" strokeDasharray="2 4" />
        {months.map((m, i) => {
          const h = m.count ? Math.max(3, (m.count / max) * (H - 8)) : 0;
          const isPeak = m.count === max && m.count > 0;
          return (
            <g key={m.key}>
              <title>{`${m.long}: ${m.count}`}</title>
              <rect x={i * bar + 4} y={H - h} width={bar - 8} height={h} rx="2" fill={isPeak ? "var(--k-accent)" : "var(--k-text-3)"} opacity={isPeak ? 1 : 0.55} />
              <text x={i * bar + bar / 2} y={H + 14} textAnchor="middle" fontSize="10" fill="var(--k-text-2)" fontFamily="var(--k-font-mono)">
                {m.short.slice(0, 3)}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>Watches per month</caption>
        <tbody>
          {months.map((m) => (
            <tr key={m.key}>
              <th scope="row">{m.long}</th>
              <td>{m.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function Genres({ genres }: { genres: Stats["topGenres"] }) {
  if (!genres.length) return <p className="text-k-base text-text-2">Genres appear once your shows have metadata.</p>;
  const max = genres[0][1];
  return (
    <ol className="flex flex-col gap-2.5">
      {genres.slice(0, 6).map(([name, n]) => (
        <li key={name} className="grid grid-cols-[7rem_1fr_3rem] items-center gap-3 text-k-sm">
          <span className="truncate text-text">{name}</span>
          <span className="h-2 overflow-hidden rounded-k-pill bg-surface-3" aria-hidden>
            <span className="block h-full origin-left rounded-k-pill bg-accent" style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className="k-slate k-tabular text-right text-text-2">{nf.format(n)}</span>
        </li>
      ))}
    </ol>
  );
}

export default function StatsPage() {
  const stats = useLiveQuery(() => computeStats());
  const settings = useLiveQuery(() => getSettings());

  if (stats === undefined) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="mb-6 font-display text-k-2xl font-medium tracking-[-0.02em]">Stats</h1>
        <LoadingRegion label="Crunching your stats" className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} delay={120} rounded="md" className="h-28" />
            ))}
          </div>
          <Skeleton delay={120} rounded="md" className="h-52 w-full" />
        </LoadingRegion>
      </div>
    );
  }

  if (stats.episodes + stats.movies === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="mb-6 font-display text-k-2xl font-medium tracking-[-0.02em]">Stats</h1>
        <EmptyState icon="pulse" title="No watches to count yet" action={<ActionLink href="/app/import?source=tvtime">Bring your TV Time history</ActionLink>}>
          Mark an episode watched, or import your history, and your numbers show up here. They&apos;re computed on this device.
        </EmptyState>
      </div>
    );
  }

  const time = duration(stats.minutes);
  const year = new Date().getFullYear();
  const yearWatches = Object.entries(stats.byMonth).filter(([k]) => k.startsWith(`${year}-`)).reduce((a, [, n]) => a + n, 0);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <h1 className="mb-6 font-display text-k-2xl font-medium tracking-[-0.02em]">Stats</h1>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Episodes" value={nf.format(stats.episodes)} sub={`across ${nf.format(stats.shows)} ${stats.shows === 1 ? "show" : "shows"}`} />
        <Stat label="Movies" value={nf.format(stats.movies)} />
        <Stat label="Time watched" value={time.value} unit={time.unit} sub={time.sub} />
        <Stat label="Current streak" value={nf.format(stats.streakDays)} unit={stats.streakDays === 1 ? "day" : "days"} sub={stats.streakDays ? "Keep it going" : "Watch something today to start one"} />
      </dl>

      <section className="mt-6 rounded-k-md border border-line bg-surface p-4 sm:p-6">
        <MonthChart byMonth={stats.byMonth} />
      </section>

      <section className="mt-6 rounded-k-md border border-line bg-surface p-4 sm:p-6" aria-labelledby="genres">
        <h2 id="genres" className="k-slate mb-4 text-text-3">Top genres</h2>
        <Genres genres={stats.topGenres} />
      </section>

      <section className="mt-6 flex flex-col gap-3 rounded-k-md border border-dashed border-line-strong p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="recap">
        <div className="flex flex-col gap-1">
          <h2 id="recap" className="font-display text-k-lg font-medium">Your {year} recap</h2>
          {settings?.supporter ? (
            <p className="max-w-[60ch] text-k-base text-text-2">
              {nf.format(yearWatches)} {yearWatches === 1 ? "watch" : "watches"} so far this year. The full recap is being built and will appear here.
            </p>
          ) : (
            <p className="max-w-[60ch] text-k-base text-text-2">
              A year of your viewing, in one scroll: most-watched shows, busiest months and binge streaks. Part of supporter, still free to read about.
            </p>
          )}
        </div>
        {!settings?.supporter && (
          <Link href="/app/supporter" className={buttonClasses("secondary", "md", "shrink-0")}>
            <Icon name="star" />
            See supporter
          </Link>
        )}
      </section>
    </div>
  );
}
