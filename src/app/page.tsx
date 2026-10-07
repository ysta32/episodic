import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/marketing/Chrome";
import { CtaPair, ImportButton } from "@/components/marketing/Buttons";
import { Comparison } from "@/components/marketing/Comparison";
import { Faq } from "@/components/marketing/Faq";
import { JsonLd } from "@/components/marketing/JsonLd";
import { REPO_URL, SITE_URL } from "@/components/marketing/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const FEATURES = [
  { t: "One-click TV Time import", d: "Drop in your TV Time export and your shows, watched episodes and dates come back in seconds." },
  { t: "Per-episode reactions", d: "Keep the part TV Time got right: react to every episode and see how others felt, spoiler-safe." },
  { t: "Local-first", d: "Your library lives on your device. It is fast, works offline and never depends on our servers." },
  { t: "Install as an app", d: "A full PWA: add it to your home screen for Up Next, calendar and notifications." },
  { t: "Export anytime", d: "Your history is yours. Download everything as files whenever you like, no paywall." },
  { t: "Open source", d: "Read the code, self-host it, or send a pull request. No lock-in, no surprise shutdowns." },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-30 focus:bg-accent focus:p-3 focus:text-accent-ink">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 size-[640px] -translate-x-1/2 rounded-full bg-accent2/25 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute top-40 -right-20 size-72 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-28">
            <p className="mx-auto inline-block rounded-full border border-border bg-surface px-4 py-1.5 text-sm text-muted">
              TV Time closed on July 15, 2026. <span className="text-text">Bring your history with you.</span>
            </p>
            <h1 className="mt-6 text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
              Your shows survived TV Time. Your history should too.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
              Episodic is the free, local-first, open source TV tracker built for the 25 million people TV Time left stranded. Import in one click, keep every reaction.
            </p>
            <div className="mt-9 flex justify-center">
              <CtaPair />
            </div>
            <p className="mt-4 text-sm text-muted">Free forever. No account needed to start.</p>
          </div>
        </section>

        <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="features" className="text-center text-3xl font-bold tracking-tight">Everything you loved, none of the risk</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.t} className="rounded-2xl border border-border bg-surface p-6">
                <span aria-hidden className="block h-1 w-10 rounded-full bg-gradient-to-r from-accent to-accent2" />
                <h3 className="mt-4 text-lg font-semibold">{f.t}</h3>
                <p className="mt-2 leading-relaxed text-muted">{f.d}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="compare" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="compare" className="text-3xl font-bold tracking-tight">An honest comparison</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Trakt and Simkl are good services with real trade-offs. Here is where each one stands.{" "}
            <Link href="/tv-time-alternative" className="text-accent underline">Read the full breakdown</Link>.
          </p>
          <div className="mt-8"><Comparison /></div>
        </section>

        <Faq />

        <section aria-label="Get started" className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-surface to-accent2/25 p-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Your watch history is waiting.</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">
              Need your export first? Our <Link href="/import-tv-time-data" className="text-accent underline">step-by-step guide</Link> shows how to request it.
            </p>
            <div className="mt-6 flex justify-center"><ImportButton /></div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Episodic",
          applicationCategory: "EntertainmentApplication",
          operatingSystem: "Web, iOS, Android",
          url: SITE_URL,
          codeRepository: REPO_URL,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }}
      />
    </div>
  );
}
