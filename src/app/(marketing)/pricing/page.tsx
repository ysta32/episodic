import type { Metadata } from "next";
import { SUPPORTER_PERKS, SUPPORTER_PRICE } from "@/lib/billing/flags";
import { ClosingCta } from "@/components/marketing/Article";
import { OpenAppButton } from "@/components/marketing/Buttons";

export const metadata: Metadata = {
  title: "Pricing: free forever, optional Supporter plan",
  description: `Episodic's core tracker is free forever. Supporter is $${SUPPORTER_PRICE.monthly}/month or $${SUPPORTER_PRICE.yearly}/year and funds an open source project.`,
  alternates: { canonical: "/pricing" },
  openGraph: { url: "/pricing", title: "Episodic pricing", description: "Free core forever. Optional Supporter plan." },
};

const FREE = [
  "Unlimited shows, movies and lists",
  "One-click TV Time, Trakt, Simkl, Letterboxd and IMDb import",
  "Per-episode reactions and threads",
  "Up Next, calendar and progress tracking",
  "Installable PWA with offline use",
  "Full data export, anytime",
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-center text-4xl font-extrabold tracking-tight sm:text-5xl">Free forever. Pay only if you want to.</h1>
      <p className="mx-auto mt-5 max-w-2xl text-center text-lg text-muted">
        We watched a beloved tracker disappear overnight. Episodic is open source and local-first, so the core app can never be taken away from you.
      </p>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <section aria-labelledby="free" className="rounded-3xl border border-border bg-surface p-8">
          <h2 id="free" className="text-xl font-bold">Free</h2>
          <p className="mt-2 text-4xl font-extrabold">$0 <span className="text-base font-normal text-muted">forever</span></p>
          <ul className="mt-6 space-y-3 text-muted">
            {FREE.map((f) => (
              <li key={f} className="flex gap-3"><span aria-hidden className="text-accent">✓</span>{f}</li>
            ))}
          </ul>
          <div className="mt-8"><OpenAppButton /></div>
        </section>
        <section aria-labelledby="supporter" className="rounded-3xl border border-accent/60 bg-gradient-to-br from-surface to-accent2/20 p-8">
          <h2 id="supporter" className="text-xl font-bold">Supporter</h2>
          <p className="mt-2 text-4xl font-extrabold">
            ${SUPPORTER_PRICE.monthly}<span className="text-base font-normal text-muted">/month</span>
          </p>
          <p className="text-sm text-muted">or ${SUPPORTER_PRICE.yearly}/year ({SUPPORTER_PRICE.currency})</p>
          <ul className="mt-6 space-y-3 text-muted">
            <li className="flex gap-3"><span aria-hidden className="text-accent">✓</span>Everything in Free</li>
            {SUPPORTER_PERKS.map((p) => (
              <li key={p} className="flex gap-3"><span aria-hidden className="text-accent">✓</span>{p}</li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-muted">Supporter checkout is rolling out. It keeps the project independent and the free tier generous.</p>
        </section>
      </div>
      <h2 className="mt-16 text-2xl font-bold">Why a paid plan at all?</h2>
      <p className="mt-3 max-w-3xl leading-relaxed text-muted">
        Servers for sync and the social features cost money. Rather than ads or selling your data, a small group of Supporters covers the bills. Nothing you rely on is ever moved behind the paywall, and you can export your entire history at any time.
      </p>
      <div className="mt-12 -mx-4 sm:-mx-6"><ClosingCta title="Start tracking in a minute" /></div>
    </div>
  );
}
