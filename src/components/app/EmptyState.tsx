import Link from "next/link";
import { buttonClasses, EmptyState, Icon, type IconName } from "@/components/ui";

const sources: ReadonlyArray<{ id: string; label: string; hint: string; icon: IconName }> = [
  { id: "trakt", label: "Trakt", hint: "Export file or backup", icon: "import" },
  { id: "simkl", label: "Simkl", hint: "JSON export", icon: "import" },
  { id: "letterboxd", label: "Letterboxd", hint: "Diary and ratings CSV", icon: "import" },
  { id: "imdb", label: "IMDb", hint: "Ratings and watchlist CSV", icon: "import" },
];

/** Full-bleed first run: import is the onboarding. Shown on /app when the library is empty. */
export function FirstRun() {
  return (
    <div className="k-enter-up mx-auto flex max-w-3xl flex-col gap-10 py-6 sm:py-12">
      <header className="flex flex-col gap-4">
        <p className="k-slate text-accent-ink">Welcome to Episodic</p>
        <h1 className="font-display text-k-3xl font-medium leading-[1.02] tracking-[-0.02em] text-text">
          Bring your TV Time history.
          <span className="block italic text-text-2">It stays on this device.</span>
        </h1>
        <p className="max-w-[56ch] text-k-md text-text-2">
          Drop in your export and see your shows, your progress and what to watch next in about a minute.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link href="/app/import?source=tvtime" className={buttonClasses("primary", "lg")}>
            <Icon name="import" />
            Import from TV Time
          </Link>
          <Link
            href="/app/discover"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-k-sm px-2 text-k-base font-medium text-text-2 underline decoration-line-strong underline-offset-4 hover:text-text"
          >
            Start fresh
            <Icon name="chevron-right" size={16} />
          </Link>
        </div>
      </header>

      <section aria-labelledby="other-sources" className="flex flex-col gap-3">
        <h2 id="other-sources" className="k-slate text-text-3">
          Coming from somewhere else
        </h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {sources.map((s) => (
            <li key={s.id}>
              <Link
                href={`/app/import?source=${s.id}`}
                className="flex min-h-14 items-center gap-3 rounded-k-md border border-line bg-surface px-4 py-3 transition-[border-color,background-color] duration-(--k-dur-1) hover:border-line-strong hover:bg-surface-2"
              >
                <Icon name={s.icon} className="text-text-3" />
                <span className="flex flex-col">
                  <span className="text-k-base font-semibold text-text">{s.label}</span>
                  <span className="text-k-sm text-text-2">{s.hint}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="border-t border-line pt-4 text-k-sm text-text-2">
        Your data never leaves this device unless you export it.
      </p>
    </div>
  );
}

/** Inline error banner: what happened, what is safe, what to do. */
export function ErrorBanner({ children, onRetry }: { children: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-k-md border border-danger bg-danger-wash px-4 py-3">
      <Icon name="alert" className="shrink-0 text-danger" />
      <p className="min-w-0 flex-1 text-k-base text-text">{children}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 cursor-pointer rounded-k-sm border border-line-strong px-4 text-k-base font-semibold text-text hover:bg-surface-2"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export { EmptyState };

export function ActionLink({ href, children, variant = "primary" }: { href: string; children: string; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={buttonClasses(variant, "md")}>
      {children}
    </Link>
  );
}
