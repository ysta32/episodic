import Link from "next/link";
import { REPO_URL, APP_HREF } from "./site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-sm text-white">
            E
          </span>
          Episodic
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-4 text-sm sm:gap-6">
          <Link href="/tv-time-alternative" className="hidden text-muted hover:text-text sm:inline">
            TV Time alternative
          </Link>
          <Link href="/import-tv-time-data" className="hidden text-muted hover:text-text sm:inline">
            Import guide
          </Link>
          <Link href="/pricing" className="text-muted hover:text-text">
            Pricing
          </Link>
          <Link href={APP_HREF} className="rounded-full bg-text px-4 py-2 font-semibold text-bg">
            Open app
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const col = "flex flex-col gap-2 text-sm text-muted";
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3 sm:px-6">
        <div>
          <p className="text-lg font-bold">Episodic</p>
          <p className="mt-2 max-w-xs text-sm text-muted">
            A free, local-first, open source TV tracker for everyone TV Time left behind.
          </p>
        </div>
        <nav aria-label="Guides" className={col}>
          <Link href="/tv-time-alternative" className="hover:text-text">TV Time alternative</Link>
          <Link href="/import-tv-time-data" className="hover:text-text">Import your TV Time data</Link>
          <Link href="/pricing" className="hover:text-text">Pricing</Link>
        </nav>
        <nav aria-label="Project" className={col}>
          <Link href={APP_HREF} className="hover:text-text">Open app</Link>
          <a href={REPO_URL} className="hover:text-text" rel="noopener">Source on GitHub</a>
          <a href={`${REPO_URL}/issues`} className="hover:text-text" rel="noopener">Report an issue</a>
        </nav>
      </div>
      <p className="border-t border-border px-4 py-5 text-center text-xs text-muted">
        Episodic is not affiliated with TV Time, Trakt, Simkl or TMDB. Open source under its repository license.
      </p>
    </footer>
  );
}
