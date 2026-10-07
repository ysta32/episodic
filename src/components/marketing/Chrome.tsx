import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { APP_HREF, IMPORT_HREF, REPO_URL } from "./site";
import { ThemeToggle } from "./ThemeToggle";

/** Wordmark: the name set as a title card, with a tungsten frame marker. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className ?? ""}`}>
      <span aria-hidden className="inline-block size-2.5 translate-y-[-0.05em] rounded-[2px] bg-accent" />
      <span className="font-display text-[1.375rem] font-medium italic leading-none tracking-[-0.02em]">Episodic</span>
    </span>
  );
}

const NAV = [
  { href: "/tv-time-alternative", label: "Why Episodic" },
  { href: "/import-tv-time-data", label: "Import guide" },
  { href: "/pricing", label: "Pricing" },
] as const;

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-k-sm focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-on-accent"
    >
      Skip to content
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg">
      <div className="mx-auto flex h-16 max-w-(--k-content-max) items-center justify-between gap-4 px-(--k-gutter)">
        <Link href="/" aria-label="Episodic home" className="rounded-k-sm py-1">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 text-k-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="hidden rounded-k-sm px-3 py-2 text-text-2 transition-colors duration-(--k-dur-1) hover:text-text md:inline-block"
            >
              {n.label}
            </Link>
          ))}
          <Link href="/pricing" className="rounded-k-sm px-3 py-2 text-text-2 hover:text-text md:hidden">
            Pricing
          </Link>
          <ThemeToggle />
          <Link href={APP_HREF} className={buttonClasses("primary", "sm", "ml-1")}>
            Open app
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const link = "text-text-2 transition-colors duration-(--k-dur-1) hover:text-text";
  return (
    <footer className="k-grain border-t border-line bg-surface">
      <div className="mx-auto grid max-w-(--k-content-max) gap-10 px-(--k-gutter) py-16 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-[34ch] text-k-sm leading-relaxed text-text-2">
            A free, local-first, open source tracker for TV and film. Built after TV Time went dark on July 15, 2026.
          </p>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-2.5 text-k-sm">
          <p className="k-slate mb-1 text-text-3">Product</p>
          <Link href={APP_HREF} className={link}>Open the app</Link>
          <Link href={IMPORT_HREF} className={link}>Import from TV Time</Link>
          <Link href="/pricing" className={link}>Pricing</Link>
        </nav>
        <nav aria-label="Guides" className="flex flex-col gap-2.5 text-k-sm">
          <p className="k-slate mb-1 text-text-3">Guides</p>
          <Link href="/tv-time-alternative" className={link}>TV Time alternatives</Link>
          <Link href="/import-tv-time-data" className={link}>Export your TV Time data</Link>
        </nav>
        <nav aria-label="Project" className="flex flex-col gap-2.5 text-k-sm">
          <p className="k-slate mb-1 text-text-3">Project</p>
          <a href={REPO_URL} className={link} rel="noopener">Source code</a>
          <a href={`${REPO_URL}/issues`} className={link} rel="noopener">Report an issue</a>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-(--k-content-max) px-(--k-gutter) py-5 text-k-xs text-text-3">
          Episodic is not affiliated with TV Time, Trakt, Simkl, Letterboxd, IMDb, TVmaze or TMDB. Show names appear for identification only.
        </p>
      </div>
    </footer>
  );
}
